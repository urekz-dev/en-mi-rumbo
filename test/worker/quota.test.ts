// Scenarios of docs/specs/deployment.md, "Anti-abuse counters live in a
// Durable Object and never in PostgreSQL (v2)", and docs/specs/
// public-directory.md, "The search endpoint has a per-IP quota (v2)": what a
// quota counts (src/core/quota/subject.ts), how it counts
// (src/core/quota/window.ts), the Durable Object that keeps the counters in
// memory (src/lib/quota/counter.ts) and how a page asks for it
// (src/lib/quota/quota.ts). The results page over its quota is served in
// test/e2e/search.spec.ts. Every address is from the ranges reserved for
// documentation (RFC 5737 and RFC 3849), so none is a real person's.
import { env } from "cloudflare:workers";
import { abortAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  isQuotaPurpose,
  MAX_WINDOW_SECONDS,
  QUOTAS,
  type QuotaPurpose,
} from "../../src/core/quota/quotas.ts";
import { quotaSubject } from "../../src/core/quota/subject.ts";
import { FixedWindowCounters, MAX_COUNTERS } from "../../src/core/quota/window.ts";
import { MAX_TIMER_MS, type QuotaCounter } from "../../src/lib/quota/counter.ts";
import { CLIENT_IP_HEADER, overQuotaHeaders, takeQuota } from "../../src/lib/quota/quota.ts";
import { db } from "./fixtures.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const SEARCH = QUOTAS.search;
const MINUTE = 60_000;

/** The headers of a request from `address`, as Cloudflare writes them. */
const from = (address: string) => new Headers({ [CLIENT_IP_HEADER]: address });

/** The counter of the search, the object every search request reaches. */
const searchCounter = () => env.QUOTA_COUNTER.getByName("search");

/** What the counter of the search keeps in memory, read from inside it. */
const kept = () =>
  runInDurableObject(searchCounter(), (instance: QuotaCounter) => ({
    keys: instance["counters"].keys(),
    timerAt: instance["timerAt"],
  }));

/** Takes the search quota `times` times from `address`; the last answer. */
async function search(address: string, times = 1) {
  let last = await takeQuota(env, from(address), "search");
  for (let n = 1; n < times; n++) last = await takeQuota(env, from(address), "search");
  return last;
}

describe("What a quota counts", () => {
  it("an IPv4 address, as is", () => {
    expect(quotaSubject("192.0.2.10")).toBe("192.0.2.10");
    expect(quotaSubject(" 198.51.100.7 ")).toBe("198.51.100.7");
  });

  it("an IPv6 address, by its /64: the rest of it is the visitor's to change", () => {
    const subject = "2001:db8:1:2::/64";
    expect(quotaSubject("2001:db8:1:2::1")).toBe(subject);
    expect(quotaSubject("2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd")).toBe(subject);
    expect(quotaSubject("2001:db8:1:2:ffff::")).toBe(subject);
    expect(quotaSubject("2001:db8:1:3::1")).not.toBe(subject);
    expect(quotaSubject("2001:db8::")).toBe("2001:db8:0:0::/64");
    expect(quotaSubject("::2")).toBe("0:0:0:0::/64");
    expect(quotaSubject("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("an IPv4 address mapped into IPv6 is its IPv4 address", () => {
    expect(quotaSubject("::ffff:192.0.2.10")).toBe("192.0.2.10");
    expect(quotaSubject("::ffff:c000:20a")).toBe("192.0.2.10");
  });

  it("this machine is not counted: Cloudflare never writes a loopback address", () => {
    for (const address of [
      "127.0.0.1",
      "127.12.0.9",
      "::1",
      "0:0:0:0:0:0:0:1",
      "::ffff:127.0.0.1",
    ]) {
      expect(quotaSubject(address), address).toBeNull();
    }
    expect(quotaSubject("128.0.0.1")).toBe("128.0.0.1");
  });

  it("no address counts nothing; anything else is counted as written", () => {
    expect(quotaSubject(null)).toBeNull();
    expect(quotaSubject("")).toBeNull();
    expect(quotaSubject("   ")).toBeNull();
    expect(quotaSubject("2001:db8::1::2")).toBe("2001:db8::1::2");
    expect(quotaSubject("Not-An-Address")).toBe("not-an-address");
  });
});

describe("Fixed windows, counted in memory", () => {
  const quota = { limit: 3, windowSeconds: 600 };

  it("allows the limit in a window, then refuses until it ends", () => {
    const counters = new FixedWindowCounters();
    const start = 1_000_000;
    for (let n = 0; n < 3; n++)
      expect(counters.take("a", quota, start + n)).toEqual({ allowed: true });
    expect(counters.take("a", quota, start + 5 * MINUTE)).toEqual({
      allowed: false,
      retryAfterSeconds: 300,
    });
    // A refused request is not counted and does not move the window.
    expect(counters.take("a", quota, start + 10 * MINUTE - 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(counters.take("a", quota, start + 10 * MINUTE)).toEqual({ allowed: true });
  });

  it("each key counts apart", () => {
    const counters = new FixedWindowCounters();
    for (let n = 0; n < 3; n++) counters.take("a", quota, 0);
    expect(counters.take("a", quota, 0).allowed).toBe(false);
    expect(counters.take("b", quota, 0).allowed).toBe(true);
  });

  it("a counter is deleted when its window ends, and the next end is known", () => {
    const counters = new FixedWindowCounters();
    counters.take("a", quota, 0);
    counters.take("b", quota, MINUTE);
    expect(counters.nextEnd()).toBe(10 * MINUTE);
    counters.sweep(10 * MINUTE - 1);
    expect(counters.keys()).toEqual(["a", "b"]);
    counters.sweep(10 * MINUTE);
    expect(counters.keys()).toEqual(["b"]);
    expect(counters.nextEnd()).toBe(11 * MINUTE);
    counters.sweep(11 * MINUTE);
    expect(counters.size).toBe(0);
    expect(counters.nextEnd()).toBeNull();
  });

  it("past its capacity it forgets the oldest counter, never refusing a new address", () => {
    const counters = new FixedWindowCounters(2);
    for (let n = 0; n < 3; n++) counters.take("old", quota, 0);
    counters.take("b", quota, 1);
    expect(counters.take("c", quota, 2)).toEqual({ allowed: true });
    expect(counters.keys()).toEqual(["b", "c"]);
    expect(counters.take("old", quota, 3)).toEqual({ allowed: true });
    expect(MAX_COUNTERS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("The search endpoint has a per-IP quota (v2)", () => {
  it("its own purpose, within an hour", () => {
    expect(isQuotaPurpose("search")).toBe(true);
    expect(isQuotaPurpose("toString")).toBe(false);
    for (const [purpose, { limit, windowSeconds }] of Object.entries(QUOTAS)) {
      expect(limit, purpose).toBeGreaterThan(0);
      expect(windowSeconds, purpose).toBeGreaterThan(0);
      expect(windowSeconds, purpose).toBeLessThanOrEqual(MAX_WINDOW_SECONDS);
    }
    expect(SEARCH).toEqual({ limit: 100, windowSeconds: 600 });
  });

  // Scenarios: within the quota; over the quota
  it("every search within the quota goes on, and the next one waits for the window", async () => {
    const address = "192.0.2.21";
    expect(await search(address, SEARCH.limit)).toEqual({ allowed: true });
    const over = await search(address);
    expect(over.allowed).toBe(false);
    if (over.allowed) return;
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
    expect(over.retryAfterSeconds).toBeLessThanOrEqual(SEARCH.windowSeconds);
    expect(overQuotaHeaders(over)).toEqual({
      "Retry-After": String(over.retryAfterSeconds),
      "Cache-Control": "no-store",
    });
    // Another address is not affected.
    expect(await search("192.0.2.22")).toEqual({ allowed: true });
  });

  it("many searches at the same time are counted one by one", async () => {
    const address = "192.0.2.23";
    const answers = await Promise.all(
      Array.from({ length: SEARCH.limit + 15 }, () => search(address)),
    );
    expect(answers.filter((answer) => answer.allowed)).toHaveLength(SEARCH.limit);
  });

  it("the addresses of one IPv6 /64 share a quota", async () => {
    expect(await search("2001:db8:5:1::1", SEARCH.limit)).toEqual({ allowed: true });
    expect((await search("2001:db8:5:1::2")).allowed).toBe(false);
    expect(await search("2001:db8:5:2::1")).toEqual({ allowed: true });
  });

  it("a request without the address of its visitor, or from this machine, is not counted", async () => {
    const before = (await kept()).keys.length;
    for (let n = 0; n < SEARCH.limit + 5; n++) {
      expect(await takeQuota(env, new Headers(), "search")).toEqual({ allowed: true });
      expect(await takeQuota(env, from("127.0.0.1"), "search")).toEqual({ allowed: true });
    }
    expect((await kept()).keys.length).toBe(before);
  });

  it("when the counter cannot answer, the search goes on and the address is not logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      QUOTA_COUNTER: {
        getByName: () => {
          throw new Error("Durable Object is overloaded");
        },
      },
    } as unknown as Pick<Env, "QUOTA_COUNTER">;
    expect(await takeQuota(broken, from("192.0.2.24"), "search")).toEqual({ allowed: true });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("192.0.2.24");
  });
});

describe("Anti-abuse counters live in a Durable Object and never in PostgreSQL (v2)", () => {
  // Scenario: the key
  it("each purpose has its own code for an address, and no key holds the address", async () => {
    const address = "198.51.100.31";
    await search(address);
    const { keys } = await kept();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{32}$/);
      expect(key).not.toContain(address);
      expect(key).not.toContain("198");
    }
    const codes = await runInDurableObject(searchCounter(), (instance: QuotaCounter) =>
      Promise.all([
        instance["code"]("search", address),
        instance["code"]("search", address),
        instance["code"]("report" as QuotaPurpose, address),
        instance["code"]("search", "198.51.100.32"),
      ]),
    );
    expect(codes[0]).toBe(codes[1]);
    expect(new Set(codes).size).toBe(3);
  });

  // Scenario: the end of the window
  it("a timer deletes each counter when its window ends", async () => {
    await search("198.51.100.34");
    const { timerAt } = await kept();
    expect(timerAt).toBeLessThanOrEqual(Date.now() + MAX_TIMER_MS);
    const left = await runInDurableObject(searchCounter(), (instance: QuotaCounter) => {
      instance["sweep"](Date.now() + SEARCH.windowSeconds * 1000);
      return { keys: instance["counters"].keys(), timerAt: instance["timerAt"] };
    });
    expect(left.keys).toEqual([]);
    expect(left.timerAt).toBe(Number.POSITIVE_INFINITY);
  });

  it("the counters and the key live in memory only: nothing is written to storage", async () => {
    await search("198.51.100.35", 3);
    const stored = await runInDurableObject(searchCounter(), async (_instance, state) => ({
      entries: (await state.storage.list()).size,
      tables: state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .map(({ name }) => name)
        .filter((name) => !name.startsWith("_cf_") && !name.startsWith("sqlite_")),
    }));
    expect(stored).toEqual({ entries: 0, tables: [] });
  });

  it("a restart forgets every counter and the key, so a quota can only forget", async () => {
    const address = "198.51.100.36";
    await search(address, SEARCH.limit);
    expect((await search(address)).allowed).toBe(false);
    // A deploy or a crash restarts the object. (An idle eviction waits for
    // the sweep timer, which is what keeps the counters in memory.)
    await abortAllDurableObjects();
    expect(await search(address)).toEqual({ allowed: true });
  });

  // Scenario: nothing in the database
  it("no column of the database is meant for an address", async () => {
    const columns = await db(async (tx) => {
      const result = await tx.execute(
        sql`SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name ~* '(^|_)(ip|ips|ip_hash|address_hash|quota)(_|$)'`,
      );
      return result.rows;
    });
    expect(columns).toEqual([]);
  });
});

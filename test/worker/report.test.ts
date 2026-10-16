// Scenarios of docs/specs/public-directory.md for the reports, below the page:
// what a submission is (src/core/report/submission.ts, src/core/forms/
// honeypot.ts), how it is decided and saved (src/core/report/submit.ts,
// src/core/report/save.ts) with the database and the quota counter, and how
// the action and the page read it (src/lib/report.ts). "Report mini-form
// without an account, with a closed-list reason and optional comment", "The
// server validates the report's reason and comment, and keeps the draft
// without a cookie (v2)", "The report form posts to its own address, which
// names the card (v2)", "The report submission confirms in plain Spanish
// and gives nothing away", "Report anti-abuse without captcha: honeypot,
// per-IP quota and pending cap per business", "The report's per-IP quota is
// counted in the quota counter (v2)", "No data is requested or stored about
// the reporter", "A report changes nothing public" and "The honeypot of the
// report form is trimmed before it is checked (v2)". The form and the page
// are rendered in test/astro/report.test.ts and run end to end, without
// JavaScript, in test/e2e/report.spec.ts.
//
// The cards belong to the fixture localities of this file, which `cleanup`
// removes with their reports. Every address is from the range reserved for
// documentation 203.0.113.0/24, or 2001:db8::/32, so none is a real person's.
import { env } from "cloudflare:workers";
import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { publishedCard } from "../../src/core/business/card.ts";
import { businesses, reports } from "../../src/core/db/schema/index.ts";
import { HONEYPOT_FIELD, isHoneypotFilled } from "../../src/core/forms/honeypot.ts";
import { QUOTAS } from "../../src/core/quota/quotas.ts";
import { MAX_PENDING_REPORTS, reportableCard, saveReport } from "../../src/core/report/save.ts";
import {
  COMMENT_FIELD,
  COMMENT_MAX_LENGTH,
  EMPTY_DRAFT,
  REASON_FIELD,
  readReportSubmission,
  REPORT_ERROR_MESSAGES,
  REPORT_REASON_LABELS,
  reportDraft,
} from "../../src/core/report/submission.ts";
import {
  failureKind,
  submitReport,
  type SubmitReportDeps,
  type SubmitReportOutcome,
} from "../../src/core/report/submit.ts";
import { CLIENT_IP_HEADER, takeQuota } from "../../src/lib/quota/quota.ts";
import {
  REPORT_ROUTE,
  reportActionError,
  reportPageFailure,
  reportTarget,
} from "../../src/lib/report.ts";
import { ActionError } from "astro:actions";
import {
  cleanup,
  createFixture,
  db,
  type Fixture,
  insertBusiness,
  type NewBusiness,
} from "./fixtures.ts";

const STATE = "85";
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(STATE);
});

afterAll(async () => {
  await cleanup(STATE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A form as a browser sends it; a list sends the field once per value. */
function form(fields: Record<string, string | string[] | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of Array.isArray(value) ? value : [value]) data.append(name, one);
  }
  return data;
}

/** A submission with a reason of the list, the empty trap field and `comment`. */
const valid = (comment = "") =>
  form({ [HONEYPOT_FIELD]: "", [REASON_FIELD]: "closed", [COMMENT_FIELD]: comment });

const publish = (overrides: Partial<NewBusiness> = {}) =>
  insertBusiness(f, { status: "published", publishedAt: new Date(), ...overrides });

/** The address of one test, from the range reserved for documentation. */
let lastAddress = 0;
const newAddress = () => `203.0.113.${++lastAddress}`;

/** What the action gives the core: a fresh connection and the report quota of `address`. */
function deps(address: string | null = newAddress()): SubmitReportDeps {
  const headers = new Headers(address === null ? {} : { [CLIENT_IP_HEADER]: address });
  return { useDb: db, takeQuota: () => takeQuota(env, headers, "report") };
}

const submit = (
  businessId: string,
  data: FormData,
  using: SubmitReportDeps = deps(),
  localityCode = f.localityA,
) => submitReport(data, { localityCode, businessId }, using);

/**
 * Dependencies that count what they are asked: connections and quota takes.
 * The quota always lets the submission go on.
 */
function counted() {
  const calls = { connections: 0, quota: 0 };
  const using: SubmitReportDeps = {
    useDb: (run) => {
      calls.connections += 1;
      return db(run);
    },
    takeQuota: async () => {
      calls.quota += 1;
      return { allowed: true };
    },
  };
  return { calls, using };
}

const RECEIVED: SubmitReportOutcome = { kind: "received" };
const NOT_FOUND: SubmitReportOutcome = { kind: "not-found" };
const error = (name: "reason" | "comment" | "quota" | "server"): SubmitReportOutcome => ({
  kind: "error",
  error: name,
});

const reportsOf = (businessId: string) =>
  db((tx) => tx.select().from(reports).where(eq(reports.businessId, businessId)));

const pendingOf = async (businessId: string) => {
  const [row] = await db((tx) =>
    tx
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.businessId, businessId), eq(reports.status, "pending"))),
  );
  return row?.n ?? 0;
};

/** Adds `n` reports of `businessId` straight to the database, in `status`. */
async function addReports(businessId: string, n: number, status: "pending" | "attended") {
  await db((tx) =>
    tx.insert(reports).values(
      Array.from({ length: n }, () => ({
        businessId,
        localityCode: f.localityA,
        reason: "not_real" as const,
        status,
        attendedAt: status === "attended" ? new Date() : null,
      })),
    ),
  );
}

describe("Report mini-form without an account, with a closed-list reason and optional comment", () => {
  it("the closed list has exactly the four reasons, in the form's order, with their labels", () => {
    expect(REPORT_REASON_LABELS).toEqual({
      closed: "Ya cerró",
      not_real: "No es real",
      incorrect_data: "Los datos están mal",
      inappropriate: "Contenido ofensivo o inapropiado",
    });
    expect(Object.keys(REPORT_REASON_LABELS)).toEqual([
      "closed",
      "not_real",
      "incorrect_data",
      "inappropriate",
    ]);
  });

  // Scenario: reporting a business that is not published
  it("only a published card of the locality can be reported: anything else is not found and writes nothing", async () => {
    const inReview = await insertBusiness(f, { status: "in_review" });
    const rejected = await insertBusiness(f, { status: "rejected" });
    const elsewhere = await insertBusiness(f, {
      status: "published",
      publishedAt: new Date(),
      localityCode: f.localityB,
      zoneId: f.zoneB,
    });
    const { calls, using } = counted();
    for (const id of [inReview, rejected, elsewhere, "zzzzzzzzzz"]) {
      expect(await submit(id, valid("No existe"), using), id).toEqual(NOT_FOUND);
      expect(await reportsOf(id), id).toEqual([]);
      expect(await db((tx) => reportableCard(tx, f.localityA, id)), id).toBeNull();
    }
    // Asking about cards that cannot be reported spends no quota.
    expect(calls.quota).toBe(0);
    // The card of the other locality is reported only under its own.
    expect(await db((tx) => reportableCard(tx, f.localityB, elsewhere))).toEqual({
      id: elsewhere,
      name: "Plomería de Prueba",
    });
  });
});

describe("The server validates the report's reason and comment, and keeps the draft without a cookie (v2)", () => {
  // Scenario: submission without choosing a reason; reason outside the list
  it("a submission without exactly one reason of the list is the reason error", () => {
    for (const reason of [undefined, "", "otra", "CLOSED", " closed", ["closed", "not_real"]]) {
      const data = form({ [COMMENT_FIELD]: "Ya no abre" });
      if (reason !== undefined) {
        for (const one of [reason].flat()) data.append(REASON_FIELD, one);
      }
      expect(readReportSubmission(data), JSON.stringify(reason)).toEqual({
        kind: "invalid",
        error: "reason",
      });
    }
    const file = form({ [REASON_FIELD]: new Blob(["closed"]) });
    expect(readReportSubmission(file)).toEqual({ kind: "invalid", error: "reason" });
    expect(REPORT_ERROR_MESSAGES.reason).toBe("Dinos qué pasa con este negocio");
  });

  it("each reason of the list is accepted", () => {
    for (const reason of Object.keys(REPORT_REASON_LABELS)) {
      expect(readReportSubmission(form({ [REASON_FIELD]: reason }))).toEqual({
        kind: "valid",
        reason,
        comment: null,
      });
    }
  });

  // Scenario: comment too long
  it("a comment of more than 300 characters is the comment error; 300 are accepted", () => {
    expect(COMMENT_MAX_LENGTH).toBe(300);
    const at = (comment: string) =>
      readReportSubmission(form({ [REASON_FIELD]: "closed", [COMMENT_FIELD]: comment }));
    expect(at("a".repeat(301))).toEqual({ kind: "invalid", error: "comment" });
    expect(at("a".repeat(300))).toEqual({
      kind: "valid",
      reason: "closed",
      comment: "a".repeat(300),
    });
    // What surrounds it is trimmed before it is measured.
    expect(at(`  ${"a".repeat(300)}\n`)).toMatchObject({ kind: "valid" });
    expect(REPORT_ERROR_MESSAGES.comment).toBe(
      "El comentario es muy largo (máximo 300 caracteres)",
    );
  });

  it("a line break counts as one character, as the field's maxlength counts it", () => {
    // Browsers send each line break of a textarea as CRLF.
    const comment = `${"a".repeat(99)}\r\n`.repeat(3).trim();
    expect(comment.replaceAll("\r\n", "\n").length).toBeLessThanOrEqual(300);
    expect(comment.length).toBeGreaterThan(300);
    expect(
      readReportSubmission(form({ [REASON_FIELD]: "closed", [COMMENT_FIELD]: comment })),
    ).toEqual({ kind: "valid", reason: "closed", comment: comment.replaceAll("\r\n", "\n") });
  });

  it("the reason is checked first, and nothing about the comment is lost", () => {
    expect(readReportSubmission(form({ [COMMENT_FIELD]: "a".repeat(400) }))).toEqual({
      kind: "invalid",
      error: "reason",
    });
  });

  // Scenario: comment of only spaces
  it("an empty comment, or one of only spaces, is no comment", () => {
    for (const comment of ["", "   ", "\n\t \r\n"]) {
      expect(
        readReportSubmission(form({ [REASON_FIELD]: "closed", [COMMENT_FIELD]: comment })),
      ).toEqual({ kind: "valid", reason: "closed", comment: null });
    }
  });

  // Scenario: comment that looks like markup
  it("a comment that looks like markup is kept as text, as is; a NUL is dropped", () => {
    const markup = "<script>alert(1)</script>";
    expect(
      readReportSubmission(form({ [REASON_FIELD]: "inappropriate", [COMMENT_FIELD]: markup })),
    ).toEqual({ kind: "valid", reason: "inappropriate", comment: markup });
    expect(
      readReportSubmission(form({ [REASON_FIELD]: "closed", [COMMENT_FIELD]: "ce\0rró" })),
    ).toMatchObject({ comment: "cerró" });
  });

  // Scenario: what the resident wrote does not stay in the address (v2)
  it("the draft is what the same submission chose and wrote, bounded and never split mid-character", () => {
    expect(reportDraft(form({ [COMMENT_FIELD]: "Ya no abre desde enero" }))).toEqual({
      reason: null,
      comment: "Ya no abre desde enero",
    });
    expect(
      reportDraft(form({ [REASON_FIELD]: "incorrect_data", [COMMENT_FIELD]: "El horario" })),
    ).toEqual({ reason: "incorrect_data", comment: "El horario" });
    // A reason that is not one of the list is not kept.
    expect(reportDraft(form({ [REASON_FIELD]: "<b>otra</b>" })).reason).toBeNull();
    expect(reportDraft(form({ [REASON_FIELD]: ["closed", "not_real"] })).reason).toBeNull();
    // A forged body is not echoed whole, and an emoji is not cut in two.
    expect(reportDraft(form({ [COMMENT_FIELD]: "a".repeat(5000) })).comment).toBe("a".repeat(300));
    const emojis = reportDraft(form({ [COMMENT_FIELD]: `${"a".repeat(299)}🙂🙂` })).comment;
    expect(emojis).toBe("a".repeat(299));
    expect(reportDraft(form({ [COMMENT_FIELD]: new Blob(["x"]) }))).toEqual(EMPTY_DRAFT);
    expect(reportDraft(new FormData())).toEqual(EMPTY_DRAFT);
  });

  it("a markup draft is kept as the text it is; the page escapes it", () => {
    expect(reportDraft(form({ [COMMENT_FIELD]: "</textarea><script>x</script>" })).comment).toBe(
      "</textarea><script>x</script>",
    );
  });

  // Scenarios: comment that looks like markup; report with comment
  it("a report is saved with its comment exactly as it was sent, trimmed", async () => {
    const id = await publish();
    const markup = "<script>alert(1)</script>";
    expect(await submit(id, valid(`  ${markup}\n`))).toEqual(RECEIVED);
    expect((await reportsOf(id)).map((report) => report.comment)).toEqual([markup]);
  });

  // Scenario: comment of only spaces
  it("a report with a comment of only spaces is saved without a comment", async () => {
    const id = await publish();
    expect(await submit(id, valid("    "))).toEqual(RECEIVED);
    expect((await reportsOf(id)).map((report) => report.comment)).toEqual([null]);
  });

  it("a reason or comment error saves nothing and spends no quota", async () => {
    const id = await publish();
    const { calls, using } = counted();
    expect(await submit(id, form({ [COMMENT_FIELD]: "x" }), using)).toEqual(error("reason"));
    const long = form({ [REASON_FIELD]: "closed", [COMMENT_FIELD]: "a".repeat(301) });
    expect(await submit(id, long, using)).toEqual(error("comment"));
    expect(calls).toEqual({ connections: 0, quota: 0 });
    expect(await reportsOf(id)).toEqual([]);
  });

  // The resident sees "No pudimos enviar tu reporte..." without any detail.
  it("a server failure is told without detail, and the log keeps neither the comment nor the address", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(new Error("connection lost while saving «Ya cerró, secreto»"), {
      code: "57P01",
    });
    const outcome = await submit("b5q68b2e72", valid("Comentario secreto de prueba"), {
      useDb: () => Promise.reject(failure),
      takeQuota: () =>
        takeQuota(env, new Headers({ [CLIENT_IP_HEADER]: "203.0.113.200" }), "report"),
    });
    expect(outcome).toEqual(error("server"));
    expect(REPORT_ERROR_MESSAGES.server).toBe(
      "No pudimos enviar tu reporte. Vuelve a intentarlo en un momento.",
    );
    expect(log).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("PostgreSQL 57P01");
    for (const secret of ["secreto", "203.0.113.200", "b5q68b2e72"]) {
      expect(logged).not.toContain(secret);
    }
    expect(failureKind(new TypeError("x"))).toBe("TypeError");
    expect(failureKind("x")).toBe("unknown");
  });
});

describe("The honeypot of the report form is trimmed before it is checked (v2)", () => {
  // Scenario: whitespace only
  it("a trap field empty, absent or of only whitespace counts as empty", () => {
    for (const value of ["", "   ", "\t\n"]) {
      expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: value })), JSON.stringify(value)).toBe(
        false,
      );
    }
    expect(isHoneypotFilled(new FormData())).toBe(false);
  });

  // Scenario: a filled honeypot
  it("any other value counts as filled, in any of its values", () => {
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: "https://spam.example" }))).toBe(true);
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: [" ", "x"] }))).toBe(true);
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: new Blob([""]) }))).toBe(true);
  });

  it("a trap of only spaces leaves the report to be saved", async () => {
    const id = await publish();
    const data = form({ [HONEYPOT_FIELD]: "   ", [REASON_FIELD]: "closed" });
    expect(await submit(id, data)).toEqual(RECEIVED);
    expect(await pendingOf(id)).toBe(1);
  });
});

describe("Report anti-abuse without captcha: honeypot, per-IP quota and pending cap per business", () => {
  // Scenario: bot that fills the honeypot
  it("a filled trap field is received like a report, and touches neither the database nor the quota", async () => {
    const id = await publish();
    const { calls, using } = counted();
    const data = form({ [HONEYPOT_FIELD]: "bot", [REASON_FIELD]: "closed", [COMMENT_FIELD]: "x" });
    expect(await submit(id, data, using)).toEqual(RECEIVED);
    // Even with no valid reason: the trap is checked first.
    expect(await submit(id, form({ [HONEYPOT_FIELD]: "bot" }), using)).toEqual(RECEIVED);
    expect(calls).toEqual({ connections: 0, quota: 0 });
    expect(await reportsOf(id)).toEqual([]);
  });

  // Scenario: per-IP quota exhausted
  it("a fourth report from one address within the hour saves nothing and says so", async () => {
    const [first, second] = [await publish(), await publish()];
    const address = newAddress();
    for (const id of [first, second, first]) {
      expect(await submit(id, valid(), deps(address))).toEqual(RECEIVED);
    }
    expect(await submit(second, valid(), deps(address))).toEqual(error("quota"));
    expect(REPORT_ERROR_MESSAGES.quota).toBe(
      "Ya recibimos varios reportes desde aquí. Espera un rato y vuelve a intentar.",
    );
    expect([await pendingOf(first), await pendingOf(second)]).toEqual([2, 1]);
    // Another address reports normally.
    expect(await submit(second, valid(), deps(newAddress()))).toEqual(RECEIVED);
  });

  // Scenario: business with the pending cap reached
  it("a card with 10 unattended reports takes no more, and the resident is told the same", async () => {
    const id = await publish();
    await addReports(id, MAX_PENDING_REPORTS - 1, "pending");
    await addReports(id, 2, "attended");
    expect(await submit(id, valid("La décima"))).toEqual(RECEIVED);
    expect(await pendingOf(id)).toBe(MAX_PENDING_REPORTS);
    expect(await submit(id, valid("La onceava"))).toEqual(RECEIVED);
    expect(await pendingOf(id)).toBe(MAX_PENDING_REPORTS);
    expect((await reportsOf(id)).map((report) => report.comment)).not.toContain("La onceava");
    expect(
      await db((tx) =>
        saveReport(tx, {
          localityCode: f.localityA,
          businessId: id,
          reason: "closed",
          comment: null,
        }),
      ),
    ).toBe("capped");
  });

  // Scenario: many reports at the same time
  it("fourteen reports at once about one card leave 10; eight at once from one address leave 3", async () => {
    const [crowded, quiet] = [await publish(), await publish()];
    const fromMany = Array.from({ length: 14 }, (_, n) =>
      submit(crowded, valid(`Reporte ${n}`), deps(`2001:db8:85:${n.toString(16)}::1`)),
    );
    const one = `2001:db8:85:ff::1`;
    const fromOne = Array.from({ length: 8 }, () => submit(quiet, valid(), deps(one)));
    const [many, single] = await Promise.all([Promise.all(fromMany), Promise.all(fromOne)]);

    expect(await pendingOf(crowded)).toBe(MAX_PENDING_REPORTS);
    expect(await pendingOf(quiet)).toBe(QUOTAS.report.limit);
    // Each one is told what it would have been told alone: all 14 were
    // received, past the cap or not; of the 8, three were and five are over
    // the quota.
    expect(many).toEqual(Array.from({ length: 14 }, () => RECEIVED));
    expect(single.filter((outcome) => outcome.kind === "received")).toHaveLength(3);
    expect(single.filter((outcome) => outcome.kind === "error")).toEqual(
      Array.from({ length: 5 }, () => error("quota")),
    );
  });

  // Scenario: no auto-unpublishing
  it("the cap reached leaves the card published", async () => {
    const id = await publish();
    await addReports(id, MAX_PENDING_REPORTS, "pending");
    expect(await submit(id, valid())).toEqual(RECEIVED);
    const [row] = await db((tx) =>
      tx.select({ status: businesses.status }).from(businesses).where(eq(businesses.id, id)),
    );
    expect(row?.status).toBe("published");
  });
});

describe("The report's per-IP quota is counted in the quota counter (v2)", () => {
  it("3 reports an hour, in a counter of their own", () => {
    expect(QUOTAS.report).toEqual({ limit: 3, windowSeconds: 3600 });
  });

  // Scenario: the report quota does not consume the creation one (and
  // public-directory, "The search endpoint has a per-IP quota (v2)",
  // scenario: independent counters)
  it("an address over its report quota still searches, and one over its search quota still reports", async () => {
    const id = await publish();
    const reporter = newAddress();
    for (let n = 0; n < QUOTAS.report.limit; n++) await submit(id, valid(), deps(reporter));
    expect(await submit(id, valid(), deps(reporter))).toEqual(error("quota"));
    const headers = new Headers({ [CLIENT_IP_HEADER]: reporter });
    expect(await takeQuota(env, headers, "search")).toEqual({ allowed: true });

    const searcher = newAddress();
    const searches = new Headers({ [CLIENT_IP_HEADER]: searcher });
    for (let n = 0; n <= QUOTAS.search.limit; n++) await takeQuota(env, searches, "search");
    expect((await takeQuota(env, searches, "search")).allowed).toBe(false);
    expect(await submit(id, valid(), deps(searcher))).toEqual(RECEIVED);
  });

  // Scenario: no IP header declared (v2: a request without an address)
  it("a request without its visitor's address is not counted, while the trap and the cap keep working", async () => {
    const id = await publish();
    for (let n = 0; n < MAX_PENDING_REPORTS + 2; n++) {
      expect(await submit(id, valid(), deps(null))).toEqual(RECEIVED);
    }
    expect(await pendingOf(id)).toBe(MAX_PENDING_REPORTS);
  });

  it("when the counter cannot answer, the report is saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      QUOTA_COUNTER: {
        getByName: () => {
          throw new Error("Durable Object is overloaded");
        },
      },
    } as unknown as Pick<Env, "QUOTA_COUNTER">;
    const id = await publish();
    const headers = new Headers({ [CLIENT_IP_HEADER]: newAddress() });
    expect(
      await submit(id, valid(), {
        useDb: db,
        takeQuota: () => takeQuota(broken, headers, "report"),
      }),
    ).toEqual(RECEIVED);
    expect(await pendingOf(id)).toBe(1);
  });
});

describe("The report submission confirms in plain Spanish and gives nothing away", () => {
  // Scenario: the confirmation tells nothing about the business
  it("saved, past the cap or caught by the trap: the action answers the same, with no error", async () => {
    const id = await publish();
    const saved = await submit(id, valid());
    await addReports(id, MAX_PENDING_REPORTS, "pending");
    const capped = await submit(id, valid());
    const trapped = await submit(id, form({ [HONEYPOT_FIELD]: "x", [REASON_FIELD]: "closed" }));
    expect([saved, capped, trapped]).toEqual([RECEIVED, RECEIVED, RECEIVED]);
    for (const outcome of [saved, capped, trapped]) expect(reportActionError(outcome)).toBeNull();
  });
});

describe("No data is requested or stored about the reporter", () => {
  // Scenario: nothing about the reporter is stored
  it("a report keeps its card, its reason, its comment, its state and its dates, and nothing else", async () => {
    const id = await publish();
    const address = newAddress();
    const before = Date.now();
    expect(await submit(id, valid("Ya no abre"), deps(address))).toEqual(RECEIVED);
    const [report] = await reportsOf(id);
    expect(Object.keys(report ?? {}).toSorted()).toEqual(
      [
        "attendedAt",
        "businessId",
        "comment",
        "createdAt",
        "id",
        "localityCode",
        "reason",
        "status",
      ].toSorted(),
    );
    expect(report).toMatchObject({
      businessId: id,
      localityCode: f.localityA,
      reason: "closed",
      comment: "Ya no abre",
      status: "pending",
      attendedAt: null,
    });
    expect(report!.createdAt.getTime()).toBeGreaterThanOrEqual(before - 5000);
    // Scenario: the IP is neither persisted nor logged
    expect(JSON.stringify(report)).not.toContain(address);
  });

  it("the reports table has no column for the sender", async () => {
    const columns = await db(async (tx) => {
      const { rows } = await tx.execute<{ column_name: string }>(
        sql`SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'reports' ORDER BY column_name`,
      );
      return rows.map((row) => row.column_name);
    });
    expect(columns).toEqual([
      "attended_at",
      "business_id",
      "comment",
      "created_at",
      "id",
      "locality_code",
      "reason",
      "status",
    ]);
  });

  // Scenario: the IP is neither persisted nor logged
  it("saving a report writes nothing to the log", async () => {
    const id = await publish();
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "debug"),
    ];
    await submit(id, valid("Comentario de prueba que no se registra"));
    await submit(id, form({ [HONEYPOT_FIELD]: "bot", [REASON_FIELD]: "closed" }));
    const address = newAddress();
    for (let n = 0; n <= QUOTAS.report.limit; n++) await submit(id, valid(), deps(address));
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
});

describe("A report changes nothing public", () => {
  // Scenarios: the reported card stays the same; no trace of reports in the public HTML
  it("the card reads exactly the same after it is reported, past the cap included", async () => {
    const id = await publish({ name: "Herrería Señalada de Prueba" });
    const cardBefore = await db((tx) => publishedCard(tx, f.localityA, id));
    const rowBefore = await db((tx) => tx.select().from(businesses).where(eq(businesses.id, id)));
    for (let n = 0; n < MAX_PENDING_REPORTS + 3; n++) {
      await submit(id, valid(`Comentario ${n}`), deps(null));
    }
    const cardAfter = await db((tx) => publishedCard(tx, f.localityA, id));
    expect(cardAfter).toEqual(cardBefore);
    expect(await db((tx) => tx.select().from(businesses).where(eq(businesses.id, id)))).toEqual(
      rowBefore,
    );
    expect(JSON.stringify(cardAfter)).not.toMatch(/Comentario|closed|report/i);
  });
});

describe("The report form posts to its own address, which names the card (v2)", () => {
  const locality = {
    code: "13069",
    name: "Tizayuca",
    slug: "tizayuca",
    state: { code: "13", name: "Hidalgo", slug: "hidalgo" },
    timeZone: "America/Mexico_City",
    contactWhatsapp: "7719990100",
    othersActive: false,
    seat: null,
  };
  const context = (overrides: Partial<Parameters<typeof reportTarget>[0]> = {}) => ({
    routePattern: REPORT_ROUTE,
    params: { state: "hidalgo", municipality: "tizayuca", card: "plomeria-b5q68b2e72" },
    locals: { locality },
    ...overrides,
  });

  // Scenario: submission with a tampered identifier
  it("the card is the one the page's address names, in the page's locality", () => {
    expect(REPORT_ROUTE).toBe("/[state]/[municipality]/negocio/[card]/reportar");
    expect(reportTarget(context())).toEqual({ localityCode: "13069", businessId: "b5q68b2e72" });
    // Another page, the action's own endpoint, no locality or no identifier: not found.
    expect(reportTarget(context({ routePattern: "/[state]/[municipality]" }))).toBeNull();
    expect(reportTarget(context({ routePattern: "/_actions/[...path]" }))).toBeNull();
    expect(reportTarget(context({ locals: {} }))).toBeNull();
    for (const card of [undefined, "", "plomeria", "plomeria-ZZZZZZZZZZ", "b5q68b2e72x"]) {
      expect(reportTarget(context({ params: { card } })), String(card)).toBeNull();
    }
  });

  it("each outcome reaches the page as what it is", () => {
    const back = (outcome: SubmitReportOutcome) => {
      const thrown = reportActionError(outcome);
      if (thrown === null) return null;
      // What Astro does with the error on its way to the page: it serializes
      // it as JSON and builds it again.
      const { type, code, message } = thrown;
      return reportPageFailure(
        ActionError.fromJson(JSON.parse(JSON.stringify({ type, code, message }))),
      );
    };
    expect(back(RECEIVED)).toBeNull();
    expect(back(NOT_FOUND)).toEqual({ kind: "not-found" });
    for (const name of ["reason", "comment", "quota", "server"] as const) {
      expect(back(error(name))).toEqual({ kind: "form", error: name, keepsDraft: true });
    }
    expect(reportActionError(error("reason"))?.status).toBe(400);
    expect(reportActionError(error("comment"))?.status).toBe(400);
    expect(reportActionError(error("quota"))?.status).toBe(429);
    expect(reportActionError(error("server"))?.status).toBe(500);
    expect(reportActionError(NOT_FOUND)?.status).toBe(404);
  });

  it("an error the action did not throw is the failure to save, without reading the body again", () => {
    for (const thrown of [
      new ActionError({ code: "CONTENT_TOO_LARGE", message: "Request body exceeds 1048576 bytes" }),
      new ActionError({ code: "UNSUPPORTED_MEDIA_TYPE" }),
      new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "reason" }),
      new ActionError({ code: "BAD_REQUEST", message: "server" }),
    ]) {
      expect(reportPageFailure(thrown), thrown.code).toEqual({
        kind: "form",
        error: "server",
        keepsDraft: false,
      });
    }
  });
});

// The Durable Object that keeps the per-IP quotas (ADR 0012; docs/specs/
// deployment.md, "Anti-abuse counters live in a Durable Object and never in
// PostgreSQL (v2)"). There is one object per purpose (`QUOTA_COUNTER`,
// `getByName(purpose)`), so each purpose counts apart.
//
// What the privacy notice promises about the IP address holds here: the
// address is used in memory only, to make a code with a secret key, and that
// code lives in memory only, for less than an hour, and is never written to
// the database ("ese código vive solo en su memoria y por menos de una hora").
// So this object never touches its storage:
//
// - The key is an HMAC-SHA-256 key the object generates in its memory when it
//   starts, never exportable and never written anywhere. A restart (a deploy,
//   an eviction) makes a new key and forgets every counter, so a quota can
//   only ever forget, never block more.
// - The counters are FixedWindowCounters (src/core/quota/window.ts), keyed by
//   that code, which mixes the purpose and the address.
// - A timer deletes each counter when its window ends. A pending timer also
//   keeps the object in memory while it has counters (a timer prevents the
//   eviction of a Durable Object for up to 15 minutes, so it is never set
//   further than `MAX_TIMER_MS` ahead); with no counter left, it may be
//   evicted, and there is nothing to lose.
//
// Nothing here is logged: neither the address nor its code.
import { DurableObject } from "cloudflare:workers";
import { isQuotaPurpose, QUOTAS, type QuotaPurpose } from "../../core/quota/quotas.ts";
import { FixedWindowCounters, type QuotaDecision } from "../../core/quota/window.ts";

/** The longest a sweep timer is set ahead: under the 15 minutes one keeps the object alive. */
export const MAX_TIMER_MS = 10 * 60 * 1000;

/** Bytes of the HMAC kept as the code: 128 bits, as hex. */
const CODE_BYTES = 16;

export class QuotaCounter extends DurableObject<Env> {
  /** Never exportable, never stored: it lives as long as this instance. */
  private readonly key: Promise<CryptoKey> = crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ) as Promise<CryptoKey>;

  private readonly counters = new FixedWindowCounters();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerAt = Number.POSITIVE_INFINITY;

  /**
   * Counts one request of `subject` (src/core/quota/subject.ts) for
   * `purpose`, and says whether it is within the quota of that purpose.
   */
  async take(purpose: QuotaPurpose, subject: string): Promise<QuotaDecision> {
    if (!isQuotaPurpose(purpose)) throw new Error("quota: unknown purpose");
    const code = await this.code(purpose, subject);
    // From here to the return nothing awaits, so the check and the count of
    // one request are never interleaved with another's.
    const now = Date.now();
    const decision = this.counters.take(code, QUOTAS[purpose], now);
    this.schedule(now);
    return decision;
  }

  /** The code of `subject` for `purpose`: neither can be read back from it. */
  private async code(purpose: QuotaPurpose, subject: string): Promise<string> {
    const message = new TextEncoder().encode(`${purpose}\n${subject}`);
    const signature = await crypto.subtle.sign("HMAC", await this.key, message);
    return [...new Uint8Array(signature, 0, CODE_BYTES)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  /** Deletes the counters whose window ended, and sets the timer for the next one. */
  private sweep(now: number): void {
    this.counters.sweep(now);
    this.schedule(now);
  }

  /** Sets the timer for the next window that ends, unless one fires earlier. */
  private schedule(now: number): void {
    const next = this.counters.nextEnd();
    if (next === null) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.timerAt = Number.POSITIVE_INFINITY;
      return;
    }
    const at = Math.min(next, now + MAX_TIMER_MS);
    if (this.timer !== undefined && this.timerAt <= at) return;
    clearTimeout(this.timer);
    this.timerAt = at;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.timerAt = Number.POSITIVE_INFINITY;
        this.sweep(Date.now());
      },
      Math.max(0, at - now),
    );
  }
}

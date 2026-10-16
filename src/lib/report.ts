// The report form between Astro and the core (docs/specs/public-directory.md,
// "The report form posts to its own address, which names the card (v2)" and
// "The server validates the report's reason and comment, and keeps the draft
// without a cookie (v2)"). The form of
// src/pages/[state]/[municipality]/negocio/[card]/reportar.astro posts to its
// own address with the action `report` (src/actions/index.ts), which Astro
// runs before the page; the page then reads its result. So:
//
// - The action only reports the card of that page: the identifier comes from
//   the page's address, never from a field of the submission, and any other
//   way to reach the action (another page, `/_actions/report`) is not found.
// - The outcome of the core (src/core/report/submit.ts) travels to the page as
//   an ActionError, whose status Astro gives the page: 400 for the reason and
//   the comment, 429 over the quota, 500 when it could not be saved, and 404
//   for a card that cannot be reported.
import { ActionError } from "astro:actions";
import { cardIdOf } from "../core/business/card-path.ts";
import type { ServedLocality } from "../core/locality/served.ts";
import type { ReportTarget, SubmitReportOutcome } from "../core/report/submit.ts";
import type { ReportFormError } from "../core/report/submission.ts";

/** The route of the report form, the only page whose submissions the action takes. */
export const REPORT_ROUTE = "/[state]/[municipality]/negocio/[card]/reportar";

/** What the action needs of its context. */
export interface ReportActionContext {
  routePattern: string;
  params: Record<string, string | undefined>;
  locals: { locality?: ServedLocality | undefined };
}

/**
 * The card a submission reports: the one the address of the report form
 * names, in the page's locality; or null when the action was reached any
 * other way, or the address names no identifier.
 */
export function reportTarget(context: ReportActionContext): ReportTarget | null {
  const { locality } = context.locals;
  if (context.routePattern !== REPORT_ROUTE || locality === undefined) return null;
  const businessId = cardIdOf(context.params["card"] ?? "");
  return businessId === null ? null : { localityCode: locality.code, businessId };
}

const ERROR_CODES = {
  reason: "BAD_REQUEST",
  comment: "BAD_REQUEST",
  quota: "TOO_MANY_REQUESTS",
  server: "INTERNAL_SERVER_ERROR",
} as const satisfies Record<ReportFormError, ActionError["code"]>;

/** The error the action throws for an outcome, or null when the report was received. */
export function reportActionError(outcome: SubmitReportOutcome): ActionError | null {
  switch (outcome.kind) {
    case "received":
      return null;
    case "not-found":
      return new ActionError({ code: "NOT_FOUND" });
    case "error":
      // The message is the error's name, never anything the resident wrote.
      return new ActionError({ code: ERROR_CODES[outcome.error], message: outcome.error });
  }
}

/** What the page does with an error of the action. */
export type ReportPageFailure =
  /** The same 404 as a card that does not exist. */
  | { kind: "not-found" }
  /**
   * The form again, with its error. `keepsDraft` says whether the submission
   * reached the action, so its body is a form of a bounded size that the page
   * can read again for the draft.
   */
  | { kind: "form"; error: ReportFormError; keepsDraft: boolean };

const FORM_ERRORS = new Set<string>(["reason", "comment", "quota", "server"]);

/**
 * How the page answers an error of the action. An error the action did not
 * throw (Astro refused a body too large or of another type) comes back as
 * the failure to save, without the draft.
 */
export function reportPageFailure(error: ActionError): ReportPageFailure {
  if (error.code === "NOT_FOUND") return { kind: "not-found" };
  const ours =
    FORM_ERRORS.has(error.message) && ERROR_CODES[error.message as ReportFormError] === error.code;
  if (!ours) return { kind: "form", error: "server", keepsDraft: false };
  return { kind: "form", error: error.message as ReportFormError, keepsDraft: true };
}

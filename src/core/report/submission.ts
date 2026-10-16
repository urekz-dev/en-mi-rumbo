// What a report form sends, read on the server (docs/specs/public-directory.md,
// "Report mini-form without an account, with a closed-list reason and optional
// comment", "The server validates the report's reason and comment, and keeps
// the draft without a cookie (v2)" and "The honeypot of the report form is
// trimmed before it is checked (v2)"). The form works without JavaScript and
// a submission can arrive without it, so every rule is enforced here, on
// whatever arrives: nothing about its shape is trusted. Everything here is
// pure.
import { REPORT_REASONS, type ReportReason } from "../db/schema/index.ts";
import { isHoneypotFilled } from "../forms/honeypot.ts";

/** The names of the form's fields. */
export const REASON_FIELD = "reason";
export const COMMENT_FIELD = "comment";

/** The longest comment, in the units the browser's `maxlength` counts. */
export const COMMENT_MAX_LENGTH = 300;

/**
 * The closed list of reasons, in the order of the form, with the label a
 * resident reads. The stored value is stable (data-model, "The `Report` model
 * stores a resident's notice about a card, with no data about the sender"):
 * the label may change without touching the data.
 */
export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
  closed: "Ya cerró",
  not_real: "No es real",
  incorrect_data: "Los datos están mal",
  inappropriate: "Contenido ofensivo o inapropiado",
};

/** Why the form comes back instead of being received. */
export type ReportFormError = "reason" | "comment" | "quota" | "server";

/** What the form says for each error, in plain Spanish and without detail. */
export const REPORT_ERROR_MESSAGES: Readonly<Record<ReportFormError, string>> = {
  reason: "Dinos qué pasa con este negocio",
  comment: "El comentario es muy largo (máximo 300 caracteres)",
  quota: "Ya recibimos varios reportes desde aquí. Espera un rato y vuelve a intentar.",
  server: "No pudimos enviar tu reporte. Vuelve a intentarlo en un momento.",
};

/** A submission, once read. */
export type ReportSubmission =
  /** The trap field is filled: a bot, which must not learn it was caught. */
  | { kind: "trap" }
  /** A reason or a comment the server does not accept: nothing is saved. */
  | { kind: "invalid"; error: "reason" | "comment" }
  /** What may be saved. */
  | { kind: "valid"; reason: ReportReason; comment: string | null };

/**
 * The reason of a submission: its one value of the reason field, when it is
 * one of the closed list. None, several (a radio group sends one) or any
 * other value is no reason.
 */
function chosenReason(form: FormData): ReportReason | null {
  const values = form.getAll(REASON_FIELD);
  const [value] = values;
  if (values.length !== 1 || typeof value !== "string") return null;
  return (REPORT_REASONS as readonly string[]).includes(value) ? (value as ReportReason) : null;
}

/**
 * The text of the comment field as it arrived: its first value, when it is
 * text. Browsers send a line break as CRLF but `maxlength` counts it as one
 * character, so line breaks become LF. A NUL character, which no person types
 * and PostgreSQL cannot store, is dropped.
 */
function commentText(form: FormData): string {
  const value = form.get(COMMENT_FIELD);
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replaceAll("\0", "");
}

/**
 * Reads a submission of the report form, in this order: the trap field
 * (trimmed), the reason, and the comment: trimmed, of at most
 * COMMENT_MAX_LENGTH characters, and none when nothing is left of it.
 */
export function readReportSubmission(form: FormData): ReportSubmission {
  if (isHoneypotFilled(form)) return { kind: "trap" };
  const reason = chosenReason(form);
  if (reason === null) return { kind: "invalid", error: "reason" };
  const comment = commentText(form).trim();
  if (comment.length > COMMENT_MAX_LENGTH) return { kind: "invalid", error: "comment" };
  return { kind: "valid", reason, comment: comment === "" ? null : comment };
}

/** What the form shows again when it comes back with an error. */
export interface ReportDraft {
  /** The reason the resident chose, when it is one of the list. */
  reason: ReportReason | null;
  /** What the resident wrote in the comment. */
  comment: string;
}

/** The form before anything was written. */
export const EMPTY_DRAFT: ReportDraft = { reason: null, comment: "" };

/**
 * What the resident had chosen and written, read from the same submission,
 * so it never travels in an address or a cookie. The reason is kept only when
 * it is exactly one of the list. The comment is bounded to
 * COMMENT_MAX_LENGTH, never cutting a character in two, so a forged
 * submission cannot make the page echo a large body; the page renders it as
 * text.
 */
export function reportDraft(form: FormData): ReportDraft {
  const text = commentText(form);
  let comment = text.slice(0, COMMENT_MAX_LENGTH);
  if (text.length > COMMENT_MAX_LENGTH && /[\uD800-\uDBFF]$/.test(comment)) {
    comment = comment.slice(0, -1);
  }
  return { reason: chosenReason(form), comment };
}

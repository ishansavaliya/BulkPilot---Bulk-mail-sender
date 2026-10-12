// Shared domain types for the bulk mail sender.

export interface SmtpConfig {
  /** Display name shown to recipients, e.g. "Acme Team" */
  fromName: string;
  /** Gmail address used as the sender / SMTP username */
  fromEmail: string;
  /** Gmail App Password (16 chars, generated with 2FA enabled) */
  appPassword: string;
  /** SMTP host — preset to Gmail but editable */
  host: string;
  /** SMTP port — 465 (SSL) by default */
  port: number;
}

/** An attachment stored as a base64 data URL so it can live in localStorage. */
export interface StoredAttachment {
  id: string;
  filename: string;
  /** MIME type, e.g. application/pdf */
  contentType: string;
  /** size in bytes (for display / quota warnings) */
  size: number;
  /** base64 data URL: data:<mime>;base64,xxxx */
  dataUrl: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  /** Plain-text / simple HTML body. Supports {{placeholder}} tokens. */
  body: string;
  attachments: StoredAttachment[];
  /** Signature appended below the body; undefined = no signature. */
  signatureId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Reusable HTML email signature (e.g. an uploaded .html footer). */
export interface Signature {
  id: string;
  name: string;
  /** Raw HTML, appended as-is below the rendered body. */
  html: string;
  createdAt: number;
  updatedAt: number;
}

export interface Recipient {
  /** validated, lower-cased email */
  email: string;
  /** every other column from the Excel sheet, keyed by header */
  fields: Record<string, string>;
}

export interface RecipientIssue {
  row: number;
  rawEmail: string;
  reason: "invalid" | "duplicate" | "empty";
}

export interface ParsedRecipients {
  valid: Recipient[];
  issues: RecipientIssue[];
  /** column headers detected in the sheet (excluding the email column) */
  columns: string[];
  emailColumn: string | null;
  totalRows: number;
}

export interface SendResult {
  email: string;
  ok: boolean;
  error?: string;
}

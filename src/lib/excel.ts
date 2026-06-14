// Excel/CSV parsing + recipient validation built on the `xlsx` library.

import * as XLSX from "xlsx";
import type { ParsedRecipients, Recipient, RecipientIssue } from "./types";

// Pragmatic email regex — rejects obvious garbage without being RFC-pedantic.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Heuristically find the column that holds email addresses. */
function detectEmailColumn(headers: string[], rows: Record<string, unknown>[]) {
  // 1) header name looks like email
  const byName = headers.find((h) => /e-?mail/i.test(h));
  if (byName) return byName;

  // 2) column whose values mostly look like emails
  let best: { col: string; hits: number } | null = null;
  for (const h of headers) {
    let hits = 0;
    for (const r of rows) {
      const v = String(r[h] ?? "").trim();
      if (EMAIL_RE.test(v)) hits++;
    }
    if (!best || hits > best.hits) best = { col: h, hits };
  }
  return best && best.hits > 0 ? best.col : null;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Parse an array buffer (xlsx/xls/csv) into validated recipients + issues.
 * - validates email format
 * - removes duplicate emails (first occurrence wins; later ones flagged)
 * - flags empty / invalid rows
 */
export function parseRecipientsFromBuffer(
  buffer: ArrayBuffer
): ParsedRecipients {
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheet];

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return {
      valid: [],
      issues: [],
      columns: [],
      emailColumn: null,
      totalRows: 0,
    };
  }

  const headers = Object.keys(rows[0]);
  const emailColumn = detectEmailColumn(headers, rows);

  const valid: Recipient[] = [];
  const issues: RecipientIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    // +2 => account for header row (1) and 0-based index, matching spreadsheet row numbers
    const rowNum = i + 2;
    const rawEmail = emailColumn ? String(row[emailColumn] ?? "").trim() : "";

    // build the "other fields" map (everything except the email column)
    const fields: Record<string, string> = {};
    for (const h of headers) {
      if (h === emailColumn) continue;
      fields[h] = String(row[h] ?? "").trim();
    }

    const allEmpty =
      !rawEmail && Object.values(fields).every((v) => v === "");
    if (allEmpty) return; // silently skip fully-blank spacer rows

    if (!rawEmail) {
      issues.push({ row: rowNum, rawEmail: "(blank)", reason: "empty" });
      return;
    }
    if (!isValidEmail(rawEmail)) {
      issues.push({ row: rowNum, rawEmail, reason: "invalid" });
      return;
    }

    const normalized = rawEmail.toLowerCase();
    if (seen.has(normalized)) {
      issues.push({ row: rowNum, rawEmail, reason: "duplicate" });
      return;
    }

    seen.add(normalized);
    valid.push({ email: normalized, fields });
  });

  return {
    valid,
    issues,
    columns: headers.filter((h) => h !== emailColumn),
    emailColumn,
    totalRows: rows.length,
  };
}

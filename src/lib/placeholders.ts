// Utilities for {{placeholder}} substitution in templates.

import type { Recipient } from "./types";

const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Extract unique placeholder names used in a string, e.g. ["name", "company"]. */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

/**
 * Replace {{token}} with the recipient's field value (case-insensitive match
 * against column headers). Unknown tokens are left blank.
 */
export function render(text: string, recipient: Recipient): string {
  // build a lower-cased lookup of available fields
  const lookup: Record<string, string> = { email: recipient.email };
  for (const [k, v] of Object.entries(recipient.fields)) {
    lookup[k.toLowerCase()] = v;
  }
  return text.replace(TOKEN_RE, (_full, token: string) => {
    const val = lookup[token.toLowerCase()];
    return val ?? "";
  });
}

/**
 * Given the placeholders a template needs and the columns available in the
 * uploaded sheet, report which placeholders cannot be filled.
 */
export function missingPlaceholders(
  needed: string[],
  availableColumns: string[]
): string[] {
  const have = new Set(
    ["email", ...availableColumns].map((c) => c.toLowerCase())
  );
  return needed.filter((p) => !have.has(p.toLowerCase()));
}

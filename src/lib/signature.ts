// Helpers for HTML email signatures appended below the template body.

/** Gmail clips messages over ~102KB, so keep signatures well under that. */
export const MAX_SIGNATURE_BYTES = 100 * 1024;

export function htmlBytes(html: string): number {
  return new TextEncoder().encode(html).length;
}

/**
 * Signature files are often full documents (<html><head>…<body>). Keep only
 * the body content so it nests cleanly inside the mail body.
 */
export function extractBody(html: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return (m ? m[1] : html).trim();
}

/**
 * Append the signature AFTER the body's \n → <br/> conversion, so newlines
 * inside the signature's table markup are never turned into stray <br/>s.
 */
export function appendSignature(
  bodyHtml: string,
  signatureHtml: string | undefined
): string {
  if (!signatureHtml?.trim()) return bodyHtml;
  return `${bodyHtml}<br/><br/><div>${signatureHtml}</div>`;
}

/** Wrap signature HTML in a minimal document for a sandboxed iframe preview. */
export function previewDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:12px;background:#ffffff">${html}</body></html>`;
}

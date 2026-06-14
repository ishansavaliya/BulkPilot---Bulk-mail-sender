// Thin, SSR-safe localStorage wrapper for SMTP config and templates.
// All keys are namespaced under "bms:" (bulk mail sender).

import type { SmtpConfig, Template } from "./types";

const KEY_SMTP = "bms:smtp";
const KEY_TEMPLATES = "bms:templates";

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Most likely the 5MB quota was hit by large attachments.
    throw new Error(
      "Could not save to local storage — you may have exceeded the ~5MB browser quota (large attachments?)."
    );
  }
}

/* ---------------- SMTP config ---------------- */

export function loadSmtp(): SmtpConfig | null {
  return read<SmtpConfig | null>(KEY_SMTP, null);
}

export function saveSmtp(config: SmtpConfig) {
  write(KEY_SMTP, config);
}

export function clearSmtp() {
  if (isBrowser()) window.localStorage.removeItem(KEY_SMTP);
}

/* ---------------- Templates ---------------- */

export function loadTemplates(): Template[] {
  return read<Template[]>(KEY_TEMPLATES, []);
}

export function saveTemplates(templates: Template[]) {
  write(KEY_TEMPLATES, templates);
}

/** Generate a reasonably unique id without external deps. */
export function newId(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  // fallback
  return `id-${Date.now().toString(36)}-${Math.floor(
    performance.now() * 1000
  ).toString(36)}`;
}

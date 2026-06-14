"use client";

import { useEffect, useState } from "react";
import type { SmtpConfig } from "@/lib/types";
import { loadSmtp, saveSmtp, clearSmtp } from "@/lib/storage";

const BLANK: SmtpConfig = {
  fromName: "",
  fromEmail: "",
  appPassword: "",
  host: "smtp.gmail.com",
  port: 465,
};

export default function SmtpStep({
  onConfigured,
}: {
  onConfigured: (configured: boolean) => void;
}) {
  const [form, setForm] = useState<SmtpConfig>(BLANK);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // test-mail state
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  useEffect(() => {
    const existing = loadSmtp();
    if (existing) {
      setForm({ ...BLANK, ...existing });
      onConfigured(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (k: keyof SmtpConfig, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setError(null);
    if (!form.fromEmail.trim() || !form.appPassword.trim()) {
      setError("Sender email and App Password are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.fromEmail.trim())) {
      setError("Sender email doesn't look valid.");
      return;
    }
    const cleaned: SmtpConfig = {
      ...form,
      fromEmail: form.fromEmail.trim(),
      appPassword: form.appPassword.replace(/\s+/g, ""), // gmail shows it spaced
      port: Number(form.port) || 465,
    };
    saveSmtp(cleaned);
    setForm(cleaned);
    setSavedAt(Date.now());
    onConfigured(true);
  };

  const reset = () => {
    clearSmtp();
    setForm(BLANK);
    setSavedAt(null);
    onConfigured(false);
  };

  const sendTest = async () => {
    setTestResult(null);
    if (!form.fromEmail.trim() || !form.appPassword.trim()) {
      setTestResult({
        ok: false,
        message: "Enter your Gmail address and App Password first.",
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: {
            ...form,
            appPassword: form.appPassword.replace(/\s+/g, ""),
            port: Number(form.port) || 465,
          },
          to: testTo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({
          ok: false,
          message: data.detail ? `${data.error} — ${data.detail}` : data.error,
        });
      } else {
        setTestResult({
          ok: true,
          message: `Test email sent to ${data.to}. Check the inbox.`,
        });
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Network error.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* form */}
      <div className="panel p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">
          Configure your sender
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          We use Gmail SMTP with a 16-character{" "}
          <span className="font-mono">App Password</span>. Your credentials are
          saved only in this browser&rsquo;s local storage and travel directly
          to Gmail at send time.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Sender name</label>
            <input
              className="field-input"
              placeholder="Acme Outreach Team"
              value={form.fromName}
              onChange={(e) => update("fromName", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label">Gmail address (from)</label>
            <input
              className="field-input"
              type="email"
              placeholder="you@gmail.com"
              value={form.fromEmail}
              onChange={(e) => update("fromEmail", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label">App password</label>
            <div className="flex gap-2">
              <input
                className="field-input font-mono tracking-widest"
                type={showPw ? "text" : "password"}
                placeholder="xxxx xxxx xxxx xxxx"
                value={form.appPassword}
                onChange={(e) => update("appPassword", e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="field-label">SMTP host</label>
            <input
              className="field-input"
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Port</label>
            <input
              className="field-input"
              type="number"
              value={form.port}
              onChange={(e) => update("port", Number(e.target.value))}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 border-2 border-ember-deep bg-ember/10 px-3 py-2 font-mono text-xs text-ember-deep">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={save}>
            Save configuration
          </button>
          <button className="btn-ghost" onClick={reset}>
            Clear
          </button>
          {savedAt && (
            <span className="font-mono text-xs text-moss">
              ✓ Saved to this browser
            </span>
          )}
        </div>

        {/* test mail */}
        <div className="mt-7 border-t-2 border-dashed border-ink/20 pt-5">
          <label className="field-label">
            Send a test email (verify before bulk sending)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field-input"
              type="email"
              placeholder={form.fromEmail || "test-to@example.com (defaults to yourself)"}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost shrink-0"
              onClick={sendTest}
              disabled={testing}
            >
              {testing ? "Sending…" : "Send test mail"}
            </button>
          </div>
          {testResult && (
            <p
              className={`mt-3 border-2 px-3 py-2 font-mono text-xs ${
                testResult.ok
                  ? "border-moss bg-moss/10 text-moss"
                  : "border-ember-deep bg-ember/10 text-ember-deep"
              }`}
            >
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.message}
            </p>
          )}
        </div>
      </div>

      {/* help card */}
      <aside className="panel h-fit bg-ink p-6 text-paper md:p-7">
        <h3 className="font-display text-lg font-semibold text-ember">
          How to get an App Password
        </h3>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-paper/80">
          <li>
            <span className="font-mono text-ember">01</span> &nbsp;Enable
            2-Step Verification on your Google account.
          </li>
          <li>
            <span className="font-mono text-ember">02</span> &nbsp;Visit{" "}
            <span className="font-mono text-paper">
              myaccount.google.com/apppasswords
            </span>
            .
          </li>
          <li>
            <span className="font-mono text-ember">03</span> &nbsp;Create a
            password for &ldquo;Mail&rdquo; and copy the 16 characters.
          </li>
          <li>
            <span className="font-mono text-ember">04</span> &nbsp;Paste it
            above. Spaces are removed automatically.
          </li>
        </ol>
        <p className="mt-5 border-t border-paper/20 pt-4 font-mono text-[11px] leading-relaxed text-paper/55">
          Port 465 = SSL · Port 587 = STARTTLS. Nothing is stored on any server.
        </p>
      </aside>
    </div>
  );
}

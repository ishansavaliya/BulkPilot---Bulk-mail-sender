"use client";

import { useMemo, useState } from "react";
import type {
  ParsedRecipients,
  SendResult,
  SmtpConfig,
  Template,
} from "@/lib/types";
import {
  extractPlaceholders,
  missingPlaceholders,
  render,
} from "@/lib/placeholders";

interface SendResponse {
  sent: number;
  failed: number;
  results: SendResult[];
  error?: string;
  detail?: string;
}

export default function SendStep({
  smtp,
  templates,
  parsed,
}: {
  smtp: SmtpConfig | null;
  templates: Template[];
  parsed: ParsedRecipients | null;
}) {
  const [templateId, setTemplateId] = useState<string>(
    templates[0]?.id ?? ""
  );
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<SendResponse | null>(null);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  const recipients = parsed?.valid ?? [];
  const columns = parsed?.columns ?? [];

  const missing = useMemo(() => {
    if (!template) return [];
    const needed = extractPlaceholders(
      `${template.subject} ${template.body}`
    );
    return missingPlaceholders(needed, columns);
  }, [template, columns]);

  const preview = useMemo(() => {
    if (!template || recipients.length === 0) return null;
    const r = recipients[0];
    return {
      to: r.email,
      subject: render(template.subject, r),
      body: render(template.body, r),
    };
  }, [template, recipients]);

  const blockers: string[] = [];
  if (!smtp) blockers.push("SMTP is not configured (Step 1).");
  if (!template) blockers.push("Select a template.");
  if (recipients.length === 0)
    blockers.push("No valid recipients loaded (Step 3).");

  const send = async () => {
    if (!smtp || !template || recipients.length === 0) return;
    setSending(true);
    setResponse(null);

    const messages = recipients.map((r) => ({
      to: r.email,
      subject: render(template.subject, r),
      html: render(template.body, r).replace(/\n/g, "<br/>"),
    }));

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp,
          messages,
          attachments: template.attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            dataUrl: a.dataUrl,
          })),
        }),
      });
      const data = (await res.json()) as SendResponse;
      if (!res.ok) {
        setResponse({
          sent: 0,
          failed: messages.length,
          results: [],
          error: data.error || "Send failed.",
          detail: data.detail,
        });
      } else {
        setResponse(data);
      }
    } catch (e) {
      setResponse({
        sent: 0,
        failed: messages.length,
        results: [],
        error: e instanceof Error ? e.message : "Network error.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* controls */}
      <div className="panel p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">Review &amp; send</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Each recipient receives the same template with their own{" "}
          <span className="font-mono">{"{{placeholders}}"}</span> filled in.
        </p>

        <div className="mt-6">
          <label className="field-label">Template</label>
          <select
            className="field-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— choose —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.attachments.length ? `(📎${t.attachments.length})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* summary */}
        <div className="mt-6 space-y-2 border-2 border-ink/15 bg-white/40 p-4 font-mono text-[13px]">
          <Row label="Recipients" value={String(recipients.length)} />
          <Row
            label="Attachments"
            value={String(template?.attachments.length ?? 0)}
          />
          <Row
            label="Sender"
            value={smtp ? smtp.fromEmail : "— not set —"}
          />
        </div>

        {missing.length > 0 && (
          <p className="mt-4 border-2 border-ember-deep bg-ember/10 px-3 py-2 font-mono text-xs text-ember-deep">
            ⚠ These placeholders have no matching column and will be blank:{" "}
            {missing.map((m) => `{{${m}}}`).join(", ")}
          </p>
        )}

        {blockers.length > 0 && (
          <ul className="mt-4 space-y-1">
            {blockers.map((b) => (
              <li
                key={b}
                className="font-mono text-xs text-ember-deep before:mr-1 before:content-['•']"
              >
                {b}
              </li>
            ))}
          </ul>
        )}

        <button
          className="btn-primary mt-6 w-full py-3 text-sm"
          disabled={sending || blockers.length > 0}
          onClick={send}
        >
          {sending
            ? `Sending to ${recipients.length}…`
            : `Send to ${recipients.length} recipient${
                recipients.length === 1 ? "" : "s"
              }`}
        </button>

        {/* results */}
        {response && (
          <div className="mt-6">
            {response.error ? (
              <div className="border-2 border-ember-deep bg-ember/10 p-4">
                <p className="font-mono text-xs font-semibold text-ember-deep">
                  {response.error}
                </p>
                {response.detail && (
                  <p className="mt-2 font-mono text-[11px] text-ink/55">
                    {response.detail}
                  </p>
                )}
              </div>
            ) : (
              <div className="border-2 border-moss bg-moss/10 p-4">
                <p className="font-display text-lg font-semibold text-moss">
                  ✓ {response.sent} sent
                  {response.failed > 0 && (
                    <span className="text-ember-deep">
                      {" "}
                      · {response.failed} failed
                    </span>
                  )}
                </p>
                {response.failed > 0 && (
                  <div className="mt-3 max-h-40 overflow-auto">
                    {response.results
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <p
                          key={r.email}
                          className="font-mono text-[11px] text-ember-deep"
                        >
                          {r.email}: {r.error}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* live preview */}
      <div className="panel overflow-hidden">
        <div className="border-b-2 border-ink bg-ink px-5 py-3 text-paper">
          <h3 className="font-mono text-xs uppercase tracking-[0.14em]">
            Preview — first recipient
          </h3>
        </div>
        {preview ? (
          <div className="p-6">
            <div className="space-y-1 border-b border-ink/15 pb-4 font-mono text-[12px]">
              <p>
                <span className="text-ink/45">To:&nbsp;&nbsp;</span>
                {preview.to}
              </p>
              <p>
                <span className="text-ink/45">From:</span>{" "}
                {smtp?.fromName
                  ? `${smtp.fromName} <${smtp.fromEmail}>`
                  : smtp?.fromEmail ?? "—"}
              </p>
              <p className="text-ink">
                <span className="text-ink/45">Subj:</span>{" "}
                <span className="font-semibold">{preview.subject || "—"}</span>
              </p>
            </div>
            <div
              className="prose-sm mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft"
              dangerouslySetInnerHTML={{
                __html: preview.body.replace(/\n/g, "<br/>") || "<em>(empty body)</em>",
              }}
            />
            {template && template.attachments.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/15 pt-4">
                {template.attachments.map((a) => (
                  <span key={a.id} className="tag">
                    📎 {a.filename}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center text-center text-sm text-ink/45">
            Pick a template and load recipients to see a preview.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/50">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

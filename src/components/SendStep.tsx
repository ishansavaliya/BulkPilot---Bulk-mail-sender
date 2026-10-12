"use client";

import { useMemo, useRef, useState } from "react";
import type {
  ParsedRecipients,
  SendResult,
  Signature,
  SmtpConfig,
  Template,
} from "@/lib/types";
import {
  extractPlaceholders,
  missingPlaceholders,
  render,
} from "@/lib/placeholders";
import { loadSignatures } from "@/lib/storage";
import { appendSignature, previewDoc } from "@/lib/signature";

interface SendResponse {
  sent: number;
  failed: number;
  results: SendResult[];
  error?: string;
  detail?: string;
  /** set when the user stopped the run before all recipients were processed */
  stopped?: boolean;
  /** how many recipients were never attempted (only meaningful when stopped) */
  remaining?: number;
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
  // live progress while a bulk send is in flight
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  // abort flag — ref so the running send loop always reads the latest value
  const abortRef = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [signatures] = useState<Signature[]>(() => loadSignatures());
  // defaults to the template's linked signature; can be overridden per send
  const [signatureId, setSignatureId] = useState<string>(
    templates[0]?.signatureId ?? ""
  );

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  const signature = useMemo(
    () => signatures.find((s) => s.id === signatureId) ?? null,
    [signatures, signatureId]
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
    abortRef.current = false;
    setStopping(false);
    setSending(true);
    setResponse(null);

    const messages = recipients.map((r) => ({
      to: r.email,
      subject: render(template.subject, r),
      html: appendSignature(
        render(template.body, r).replace(/\n/g, "<br/>"),
        signature?.html
      ),
    }));

    const attachments = template.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      dataUrl: a.dataUrl,
    }));

    // Send in small batches so we can show a live "X / total" counter.
    const BATCH = 5;
    const total = messages.length;
    setProgress({ done: 0, total });

    const allResults: SendResult[] = [];

    try {
      for (let i = 0; i < total; i += BATCH) {
        // Stop requested — halt before starting the next batch.
        if (abortRef.current) {
          const sent = allResults.filter((r) => r.ok).length;
          setResponse({
            sent,
            failed: allResults.length - sent,
            results: allResults,
            stopped: true,
            remaining: total - allResults.length,
          });
          setProgress(null);
          setSending(false);
          setStopping(false);
          return;
        }

        const chunk = messages.slice(i, i + BATCH);
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smtp, messages: chunk, attachments }),
        });
        const data = (await res.json()) as SendResponse;

        if (!res.ok) {
          // Auth / config failures abort the whole run with a clear message.
          setResponse({
            sent: allResults.filter((r) => r.ok).length,
            failed: total - allResults.filter((r) => r.ok).length,
            results: allResults,
            error: data.error || "Send failed.",
            detail: data.detail,
          });
          setProgress(null);
          setSending(false);
          return;
        }

        allResults.push(...data.results);
        setProgress({ done: allResults.length, total });
      }

      const sent = allResults.filter((r) => r.ok).length;
      setResponse({
        sent,
        failed: allResults.length - sent,
        results: allResults,
      });
    } catch (e) {
      const sent = allResults.filter((r) => r.ok).length;
      setResponse({
        sent,
        failed: total - sent,
        results: allResults,
        error: e instanceof Error ? e.message : "Network error.",
      });
    } finally {
      setProgress(null);
      setSending(false);
      setStopping(false);
    }
  };

  const stop = () => {
    abortRef.current = true;
    setStopping(true);
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
            onChange={(e) => {
              setTemplateId(e.target.value);
              setSignatureId(
                templates.find((t) => t.id === e.target.value)?.signatureId ??
                  ""
              );
            }}
          >
            <option value="">— choose —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.attachments.length ? `(📎${t.attachments.length})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="field-label">Signature</label>
          <select
            className="field-input"
            value={signatureId}
            onChange={(e) => setSignatureId(e.target.value)}
          >
            <option value="">— No signature —</option>
            {signatures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || "Untitled"}
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
          <Row label="Signature" value={signature?.name || "None"} />
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

        <div className="mt-6 flex gap-3">
          <button
            className="btn-primary flex-1 py-3 text-sm"
            disabled={sending || blockers.length > 0}
            onClick={send}
          >
            {sending && progress
              ? `Sending… ${progress.done} / ${progress.total}`
              : sending
              ? "Sending…"
              : `Send to ${recipients.length} recipient${
                  recipients.length === 1 ? "" : "s"
                }`}
          </button>
          {sending && (
            <button
              className="btn-danger shrink-0 py-3"
              onClick={stop}
              disabled={stopping}
            >
              {stopping ? "Stopping…" : "■ Stop"}
            </button>
          )}
        </div>

        {/* live progress */}
        {progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between font-mono text-[12px]">
              <span className="text-ink-soft">Sending…</span>
              <span className="font-semibold">
                {progress.done} / {progress.total} sent
              </span>
            </div>
            <div className="mt-2 h-3 w-full border-2 border-ink bg-white/50">
              <div
                className="h-full bg-ember transition-[width] duration-300 ease-out"
                style={{
                  width: `${
                    progress.total
                      ? Math.round((progress.done / progress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

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
              (() => {
                const sentList = response.results.filter((r) => r.ok);
                const failedList = response.results.filter((r) => !r.ok);
                // recipients never attempted (only when stopped early)
                const attempted = new Set(response.results.map((r) => r.email));
                const remainingList = recipients
                  .map((r) => r.email)
                  .filter((email) => !attempted.has(email));

                return (
                  <div
                    className={`border-2 p-4 ${
                      response.stopped
                        ? "border-ember-deep bg-ember/10"
                        : "border-moss bg-moss/10"
                    }`}
                  >
                    <p className="font-display text-lg font-semibold">
                      {response.stopped ? (
                        <span className="text-ember-deep">■ Stopped</span>
                      ) : (
                        <span className="text-moss">✓ Finished</span>
                      )}
                      <span className="ml-2 font-sans text-sm font-normal text-ink-soft">
                        {response.sent} sent · {response.failed} failed
                        {remainingList.length > 0 &&
                          ` · ${remainingList.length} not sent`}
                      </span>
                    </p>

                    {/* Sent */}
                    <ResultList
                      title={`Sent ✓ (${sentList.length})`}
                      tone="moss"
                      items={sentList.map((r) => r.email)}
                    />

                    {/* Failed */}
                    {failedList.length > 0 && (
                      <ResultList
                        title={`Failed ✗ (${failedList.length})`}
                        tone="ember"
                        items={failedList.map(
                          (r) => `${r.email} — ${r.error ?? "unknown error"}`
                        )}
                      />
                    )}

                    {/* Remaining / not sent (stopped early) */}
                    {remainingList.length > 0 && (
                      <ResultList
                        title={`Not sent (${remainingList.length})`}
                        tone="ink"
                        items={remainingList}
                      />
                    )}
                  </div>
                );
              })()
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
            {signature && (
              <iframe
                title="Signature preview"
                sandbox=""
                srcDoc={previewDoc(signature.html)}
                className="mt-4 h-56 w-full border-t border-ink/15 bg-white"
              />
            )}
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

function ResultList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "moss" | "ember" | "ink";
}) {
  if (items.length === 0) return null;
  const color =
    tone === "moss"
      ? "text-moss"
      : tone === "ember"
      ? "text-ember-deep"
      : "text-ink-soft";
  return (
    <div className="mt-3">
      <p
        className={`font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${color}`}
      >
        {title}
      </p>
      <div className="mt-1 max-h-36 overflow-auto border-l-2 border-ink/15 pl-3">
        {items.map((line, i) => (
          <p key={`${line}-${i}`} className={`font-mono text-[11px] ${color}`}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Signature, StoredAttachment, Template } from "@/lib/types";
import {
  loadSignatures,
  loadTemplates,
  newId,
  saveSignatures,
  saveTemplates,
} from "@/lib/storage";
import { extractPlaceholders } from "@/lib/placeholders";
import SignatureManager from "@/components/SignatureManager";

const MAX_ATTACH_BYTES = 4 * 1024 * 1024; // 4MB/file — keeps localStorage happy

// Tags that match the sample Excel columns — click to insert into subject/body.
const SAMPLE_TAGS = ["name", "company", "email"];

function fileToAttachment(file: File): Promise<StoredAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: newId(),
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result),
      });
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function blankTemplate(): Template {
  const now = Date.now();
  return {
    id: newId(),
    name: "Untitled template",
    subject: "",
    body: "",
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function TemplateStep({
  onChange,
}: {
  onChange: (templates: Template[]) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // which field the cursor was last in, so the tag lands where the user expects
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [showSignatures, setShowSignatures] = useState(false);

  useEffect(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
    setActiveId(loaded[0]?.id ?? null);
    onChange(loaded);
    setSignatures(loadSignatures());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => templates.find((t) => t.id === activeId) ?? null,
    [templates, activeId]
  );

  const persist = (next: Template[]) => {
    setTemplates(next);
    try {
      saveTemplates(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    }
    onChange(next);
  };

  const addTemplate = () => {
    const t = blankTemplate();
    persist([...templates, t]);
    setActiveId(t.id);
  };

  const removeTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    persist(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const persistSignatures = (next: Signature[]) => {
    // unlink templates whose signature was deleted
    const ids = new Set(next.map((s) => s.id));
    if (templates.some((t) => t.signatureId && !ids.has(t.signatureId))) {
      persist(
        templates.map((t) =>
          t.signatureId && !ids.has(t.signatureId)
            ? { ...t, signatureId: undefined }
            : t
        )
      );
    }
    setSignatures(next);
    try {
      saveSignatures(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    }
  };

  const patchActive = (patch: Partial<Template>) => {
    if (!active) return;
    persist(
      templates.map((t) =>
        t.id === active.id ? { ...t, ...patch, updatedAt: Date.now() } : t
      )
    );
  };

  /** Insert {{tag}} at the cursor of the last-focused field (subject or body). */
  const insertTag = (tag: string) => {
    if (!active) return;
    const token = `{{${tag}}}`;
    const el = lastFocused === "subject" ? subjectRef.current : bodyRef.current;
    const field = lastFocused; // "subject" | "body"
    const current = field === "subject" ? active.subject : active.body;

    // Insert at caret if we have one, otherwise append.
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);

    patchActive(field === "subject" ? { subject: next } : { body: next });

    // restore focus + place caret right after the inserted token
    const caret = start + token.length;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !active) return;
    setError(null);
    const added: StoredAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACH_BYTES) {
        setError(
          `"${file.name}" is ${prettyBytes(
            file.size
          )} — over the 4MB per-file limit for browser storage.`
        );
        continue;
      }
      added.push(await fileToAttachment(file));
    }
    if (added.length)
      patchActive({ attachments: [...active.attachments, ...added] });
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (attId: string) => {
    if (!active) return;
    patchActive({
      attachments: active.attachments.filter((a) => a.id !== attId),
    });
  };

  const placeholders = active
    ? extractPlaceholders(`${active.subject} ${active.body}`)
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* sidebar list */}
      <div className="panel flex h-fit flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Templates · {templates.length}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`group flex items-center justify-between border-2 px-3 py-2 text-left transition ${
                t.id === activeId
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/20 bg-white/40 hover:border-ink"
              }`}
            >
              <span className="truncate text-sm font-medium">
                {t.name || "Untitled"}
              </span>
              <span
                className={`ml-2 shrink-0 font-mono text-[10px] ${
                  t.id === activeId ? "text-ember" : "text-ink/40"
                }`}
              >
                {t.attachments.length > 0 ? `📎${t.attachments.length}` : ""}
              </span>
            </button>
          ))}
          {templates.length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-ink/45">
              No templates yet.
            </p>
          )}
        </div>
        <button className="btn-primary mt-4 w-full" onClick={addTemplate}>
          + New template
        </button>
      </div>

      {/* editor */}
      <div className="panel p-6 md:p-8">
        {!active ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <p className="font-display text-xl">No template selected</p>
            <p className="mt-1 text-sm text-ink-soft">
              Create one to start writing.
            </p>
            <button className="btn-ghost mt-5" onClick={addTemplate}>
              + New template
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="field-label">Template name</label>
                <input
                  className="field-input font-display text-lg"
                  value={active.name}
                  onChange={(e) => patchActive({ name: e.target.value })}
                />
              </div>
              <button
                className="btn-danger mt-6"
                onClick={() => removeTemplate(active.id)}
              >
                Delete
              </button>
            </div>

            {/* quick-insert tags from the sample Excel columns */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                Insert tag →
              </span>
              {SAMPLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  title={`Insert {{${tag}}} into the ${lastFocused}`}
                  className="tag border-ink/30 bg-white/60 transition hover:border-ember hover:bg-ember/10 hover:text-ember-deep"
                >
                  {`{{${tag}}}`}
                </button>
              ))}
              <span className="font-mono text-[10px] text-ink/40">
                (drops into {lastFocused})
              </span>
            </div>

            <div className="mt-4">
              <label className="field-label">Subject</label>
              <input
                ref={subjectRef}
                className="field-input"
                placeholder="Hello {{name}}, a quick note"
                value={active.subject}
                onFocus={() => setLastFocused("subject")}
                onChange={(e) => patchActive({ subject: e.target.value })}
              />
            </div>

            <div className="mt-5">
              <label className="field-label">
                Body — HTML allowed · use {"{{column}}"} for personalization
              </label>
              <textarea
                ref={bodyRef}
                className="field-input min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
                placeholder={
                  "Hi {{name}},\n\nThanks for your interest in {{company}}.\n\nBest,\nThe Team"
                }
                value={active.body}
                onFocus={() => setLastFocused("body")}
                onChange={(e) => patchActive({ body: e.target.value })}
              />
            </div>

            {placeholders.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-ink-soft">
                  Placeholders:
                </span>
                {placeholders.map((p) => (
                  <span key={p} className="tag bg-ember/10 text-ember-deep">
                    {`{{${p}}}`}
                  </span>
                ))}
              </div>
            )}

            {/* attachments */}
            <div className="mt-6 border-t-2 border-dashed border-ink/20 pt-5">
              <div className="flex items-center justify-between">
                <label className="field-label mb-0">
                  Attachments (same files for every recipient)
                </label>
                <button
                  className="btn-ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  + Add files
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {active.attachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border-2 border-ink/15 bg-white/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        📎 {a.filename}
                      </p>
                      <p className="font-mono text-[11px] text-ink/50">
                        {a.contentType} · {prettyBytes(a.size)}
                      </p>
                    </div>
                    <button
                      className="ml-3 font-mono text-[11px] uppercase text-ember-deep hover:underline"
                      onClick={() => removeAttachment(a.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {active.attachments.length === 0 && (
                  <p className="text-xs text-ink/45">
                    No attachments. Add PDFs, images, or docs (max 4MB each).
                  </p>
                )}
              </div>
            </div>

            {/* signature */}
            <div className="mt-6 border-t-2 border-dashed border-ink/20 pt-5">
              <div className="flex items-center justify-between">
                <label className="field-label mb-0">
                  Signature (appended below the body)
                </label>
                <button
                  className="btn-ghost"
                  onClick={() => setShowSignatures((v) => !v)}
                >
                  {showSignatures ? "Close" : "Manage signatures"}
                </button>
              </div>
              <select
                className="field-input mt-3"
                value={active.signatureId ?? ""}
                onChange={(e) =>
                  patchActive({ signatureId: e.target.value || undefined })
                }
              >
                <option value="">— No signature —</option>
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || "Untitled"}
                  </option>
                ))}
              </select>
              {showSignatures && (
                <SignatureManager
                  signatures={signatures}
                  onChange={persistSignatures}
                />
              )}
            </div>

            {error && (
              <p className="mt-4 border-2 border-ember-deep bg-ember/10 px-3 py-2 font-mono text-xs text-ember-deep">
                {error}
              </p>
            )}

            <p className="mt-5 font-mono text-[11px] text-moss">
              ✓ Auto-saved to this browser
            </p>
          </>
        )}
      </div>
    </div>
  );
}

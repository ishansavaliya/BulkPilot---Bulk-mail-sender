"use client";

import { useRef, useState } from "react";
import type { Signature } from "@/lib/types";
import { newId } from "@/lib/storage";
import {
  MAX_SIGNATURE_BYTES,
  extractBody,
  htmlBytes,
  previewDoc,
} from "@/lib/signature";

export default function SignatureManager({
  signatures,
  onChange,
}: {
  signatures: Signature[];
  onChange: (next: Signature[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(
    signatures[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = signatures.find((s) => s.id === activeId) ?? null;
  const activeBytes = active ? htmlBytes(active.html) : 0;

  const add = (name: string, html: string) => {
    const now = Date.now();
    const sig: Signature = {
      id: newId(),
      name,
      html,
      createdAt: now,
      updatedAt: now,
    };
    onChange([...signatures, sig]);
    setActiveId(sig.id);
  };

  const patchActive = (patch: Partial<Signature>) => {
    if (!active) return;
    onChange(
      signatures.map((s) =>
        s.id === active.id ? { ...s, ...patch, updatedAt: Date.now() } : s
      )
    );
  };

  const remove = (id: string) => {
    const next = signatures.filter((s) => s.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const html = extractBody(await file.text());
      if (!html) {
        setError(`"${file.name}" is empty.`);
      } else if (htmlBytes(html) > MAX_SIGNATURE_BYTES) {
        setError(`"${file.name}" is over the 100KB signature limit.`);
      } else {
        add(file.name.replace(/\.html?$/i, ""), html);
      }
    } catch {
      setError("Could not read file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-4 border-2 border-ink/15 bg-white/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Signatures · {signatures.length}
        </span>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            Upload .html
          </button>
          <button
            className="btn-ghost"
            onClick={() => add("Untitled signature", "")}
          >
            + Paste HTML
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,text/html"
            hidden
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {signatures.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`tag transition ${
              s.id === activeId
                ? "border-ink bg-ink text-paper"
                : "hover:border-ink"
            }`}
          >
            {s.name || "Untitled"}
          </button>
        ))}
        {signatures.length === 0 && (
          <p className="text-xs text-ink/45">
            No signatures yet. Upload an HTML signature file or paste HTML.
          </p>
        )}
      </div>

      {active && (
        <div className="mt-4 grid gap-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="field-label">Signature name</label>
              <input
                className="field-input"
                value={active.name}
                onChange={(e) => patchActive({ name: e.target.value })}
              />
            </div>
            <button className="btn-danger" onClick={() => remove(active.id)}>
              Delete
            </button>
          </div>

          <div>
            <label className="field-label">HTML</label>
            <textarea
              className="field-input min-h-[160px] resize-y font-mono text-[12px] leading-relaxed"
              placeholder="<table>…</table>"
              value={active.html}
              onChange={(e) => patchActive({ html: e.target.value })}
            />
          </div>

          <div>
            <label className="field-label">
              Preview · {(activeBytes / 1024).toFixed(1)} KB
            </label>
            {/* sandbox="" blocks scripts in uploaded HTML */}
            <iframe
              title="Signature preview"
              sandbox=""
              srcDoc={previewDoc(active.html)}
              className="h-56 w-full border-2 border-ink/15 bg-white"
            />
          </div>

          {activeBytes > MAX_SIGNATURE_BYTES && (
            <p className="font-mono text-xs text-ember-deep">
              ⚠ Over 100KB — Gmail may clip the message.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 border-2 border-ember-deep bg-ember/10 px-3 py-2 font-mono text-xs text-ember-deep">
          {error}
        </p>
      )}
    </div>
  );
}

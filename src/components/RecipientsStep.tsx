"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { ParsedRecipients } from "@/lib/types";
import { parseRecipientsFromBuffer } from "@/lib/excel";

const REASON_LABEL: Record<string, string> = {
  invalid: "Invalid format",
  duplicate: "Duplicate",
  empty: "Missing email",
};

export default function RecipientsStep({
  parsed,
  onParsed,
}: {
  parsed: ParsedRecipients | null;
  onParsed: (p: ParsedRecipients | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseRecipientsFromBuffer(buffer);
      if (result.totalRows === 0) {
        setError("The sheet appears to be empty.");
        onParsed(null);
      } else if (!result.emailColumn) {
        setError(
          "Couldn't find an email column. Make sure one column header contains 'email' or holds email addresses."
        );
        onParsed(null);
      } else {
        setFileName(file.name);
        onParsed(result);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to read the file."
      );
      onParsed(null);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["email", "name", "company"],
      ["alice@example.com", "Alice", "Globex"],
      ["bob@example.com", "Bob", "Initech"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recipients");
    XLSX.writeFile(wb, "recipients-sample.xlsx");
  };

  return (
    <div className="grid gap-6">
      {/* dropzone */}
      <div
        className={`panel flex flex-col items-center justify-center px-6 py-12 text-center transition ${
          dragging ? "bg-ember/10 border-ember" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="font-display text-3xl">📥</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          Upload your recipient list
        </h2>
        <p className="mt-1 max-w-md text-sm text-ink-soft">
          Drop an <span className="font-mono">.xlsx</span>,{" "}
          <span className="font-mono">.xls</span>, or{" "}
          <span className="font-mono">.csv</span> file here. We auto-detect the
          email column, validate addresses, and remove duplicates.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Reading…" : "Choose file"}
          </button>
          <button className="btn-ghost" onClick={downloadSample}>
            Download sample
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        {fileName && !error && (
          <p className="mt-4 font-mono text-xs text-moss">
            ✓ Loaded {fileName}
          </p>
        )}
      </div>

      {error && (
        <p className="border-2 border-ember-deep bg-ember/10 px-4 py-3 font-mono text-xs text-ember-deep">
          {error}
        </p>
      )}

      {parsed && (
        <>
          {/* summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total rows" value={parsed.totalRows} />
            <Stat label="Valid" value={parsed.valid.length} accent="moss" />
            <Stat
              label="Issues"
              value={parsed.issues.length}
              accent={parsed.issues.length ? "ember" : undefined}
            />
            <Stat label="Columns" value={parsed.columns.length + 1} />
          </div>

          {/* valid preview */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-5 py-3 text-paper">
              <h3 className="font-mono text-xs uppercase tracking-[0.14em]">
                Valid recipients · {parsed.valid.length}
              </h3>
              <span className="font-mono text-[11px] text-ember">
                email column: {parsed.emailColumn}
              </span>
            </div>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-paper-deep">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                      Email
                    </th>
                    {parsed.columns.map((c) => (
                      <th
                        key={c}
                        className="px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-soft"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.valid.slice(0, 100).map((r, i) => (
                    <tr
                      key={r.email}
                      className={i % 2 ? "bg-white/30" : "bg-transparent"}
                    >
                      <td className="px-4 py-2 font-mono text-[13px]">
                        {r.email}
                      </td>
                      {parsed.columns.map((c) => (
                        <td key={c} className="px-4 py-2 text-ink-soft">
                          {r.fields[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.valid.length > 100 && (
                <p className="px-4 py-3 font-mono text-[11px] text-ink/45">
                  Showing first 100 of {parsed.valid.length}.
                </p>
              )}
            </div>
          </div>

          {/* issues */}
          {parsed.issues.length > 0 && (
            <div className="panel overflow-hidden border-ember-deep">
              <div className="border-b-2 border-ember-deep bg-ember-deep px-5 py-3 text-paper">
                <h3 className="font-mono text-xs uppercase tracking-[0.14em]">
                  Skipped rows · {parsed.issues.length}
                </h3>
              </div>
              <div className="max-h-[240px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-paper-deep">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-mono text-[11px] uppercase text-ink-soft">
                        Row
                      </th>
                      <th className="px-4 py-2 font-mono text-[11px] uppercase text-ink-soft">
                        Value
                      </th>
                      <th className="px-4 py-2 font-mono text-[11px] uppercase text-ink-soft">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.issues.map((iss, i) => (
                      <tr
                        key={`${iss.row}-${i}`}
                        className={i % 2 ? "bg-white/30" : ""}
                      >
                        <td className="px-4 py-2 font-mono">{iss.row}</td>
                        <td className="px-4 py-2 font-mono text-[13px]">
                          {iss.rawEmail}
                        </td>
                        <td className="px-4 py-2">
                          <span className="tag border-ember-deep/40 text-ember-deep">
                            {REASON_LABEL[iss.reason]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "moss" | "ember";
}) {
  const color =
    accent === "moss"
      ? "text-moss"
      : accent === "ember"
      ? "text-ember-deep"
      : "text-ink";
  return (
    <div className="panel px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </p>
      <p className={`font-display text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import SmtpStep from "@/components/SmtpStep";
import TemplateStep from "@/components/TemplateStep";
import RecipientsStep from "@/components/RecipientsStep";
import SendStep from "@/components/SendStep";
import { loadSmtp } from "@/lib/storage";
import type { ParsedRecipients, Template } from "@/lib/types";

const STEPS = [
  { n: 1, key: "smtp", label: "SMTP Setup", blurb: "Connect Gmail" },
  { n: 2, key: "template", label: "Templates", blurb: "Write your mail" },
  { n: 3, key: "recipients", label: "Recipients", blurb: "Upload Excel" },
  { n: 4, key: "send", label: "Send", blurb: "Review & blast" },
] as const;

export default function Home() {
  const [step, setStep] = useState(0);
  const [smtpReady, setSmtpReady] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [parsed, setParsed] = useState<ParsedRecipients | null>(null);

  const done = [
    smtpReady,
    templates.length > 0,
    (parsed?.valid.length ?? 0) > 0,
    false,
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      {/* header */}
      <header className="mb-10 flex flex-col gap-4 border-b-2 border-ink pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border-2 border-ink bg-ember text-paper shadow-hard-sm">
              <span className="font-display text-xl font-bold">B</span>
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              BulkPilot
            </h1>
          </div>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            A local-first bulk mail studio. Configure SMTP, craft reusable
            templates, validate recipients from Excel, and send personalized
            mail — all stored in your browser.
          </p>
        </div>
        <span className="tag w-fit border-moss/40 text-moss">
          ● 100% local storage
        </span>
      </header>

      {/* stepper */}
      <nav className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const active = i === step;
          return (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`group relative flex flex-col items-start border-2 px-4 py-3 text-left transition ${
                active
                  ? "border-ink bg-ink text-paper shadow-hard"
                  : "border-ink/25 bg-paper hover:border-ink hover:shadow-hard-sm"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`font-mono text-[11px] ${
                    active ? "text-ember" : "text-ink/40"
                  }`}
                >
                  STEP {s.n}
                </span>
                {done[i] && (
                  <span
                    className={`font-mono text-xs ${
                      active ? "text-moss" : "text-moss"
                    }`}
                  >
                    ✓
                  </span>
                )}
              </div>
              <span className="mt-1 font-display text-lg font-semibold">
                {s.label}
              </span>
              <span
                className={`text-[11px] ${
                  active ? "text-paper/60" : "text-ink/45"
                }`}
              >
                {s.blurb}
              </span>
            </button>
          );
        })}
      </nav>

      {/* step body */}
      <section key={step} className="animate-rise">
        {step === 0 && <SmtpStep onConfigured={setSmtpReady} />}
        {step === 1 && <TemplateStep onChange={setTemplates} />}
        {step === 2 && (
          <RecipientsStep parsed={parsed} onParsed={setParsed} />
        )}
        {step === 3 && (
          <SendStep
            smtp={loadSmtp()}
            templates={templates}
            parsed={parsed}
          />
        )}
      </section>

      {/* footer nav */}
      <div className="mt-9 flex items-center justify-between border-t-2 border-ink/15 pt-6">
        <button
          className="btn-ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← Back
        </button>
        <span className="font-mono text-[11px] text-ink/45">
          {step + 1} / {STEPS.length}
        </span>
        <button
          className="btn-primary"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        >
          Next →
        </button>
      </div>
    </main>
  );
}

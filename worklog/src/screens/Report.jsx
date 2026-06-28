import { useCallback, useEffect, useState } from "react";
import { generateReport } from "../lib/report.js";
import { formatDateLong } from "../lib/time.js";

// End-of-day report. Generate a draft, edit it freely, then copy it or open it
// in your email client. Nothing is ever sent automatically.
export default function Report({ generateSignal = 0 }) {
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    try {
      const { report, source } = await generateReport();
      setDraft(report);
      setSource(source);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate when navigated here from the Today button.
  useEffect(() => {
    if (generateSignal) run();
  }, [generateSignal, run]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable; the textarea is still selectable */
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(
    `End-of-day report — ${formatDateLong()}`
  )}&body=${encodeURIComponent(draft)}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:pb-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            End-of-day report
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Review and edit the draft, then copy or email it. Nothing is sent
            automatically.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="min-h-[44px] shrink-0 rounded-lg bg-accent-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-accent-dark dark:text-neutral-900"
        >
          {loading ? "Generating…" : draft ? "Regenerate" : "Generate report"}
        </button>
      </header>

      {source === "local" && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
          Generated from a local template. Connect Supabase + an ANTHROPIC_API_KEY
          (see <span className="font-mono">README.md</span>) for a Claude-written
          report.
        </div>
      )}

      <section className="mt-4">
        {draft || loading ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              placeholder={loading ? "Generating…" : ""}
              className="w-full resize-y rounded-xl border border-neutral-300 bg-surface-light p-4 font-sans text-sm leading-relaxed text-neutral-900 shadow-sm focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={copy}
                disabled={!draft}
                className="min-h-[44px] rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {copied ? "Copied 👍" : "Copy"}
              </button>
              <a
                href={draft ? mailto : undefined}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:text-white ${
                  draft ? "" : "pointer-events-none opacity-50"
                }`}
              >
                Open in email
              </a>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-surface-light p-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
            Generate a report from today's logged tasks to get started.
          </div>
        )}
      </section>
    </div>
  );
}

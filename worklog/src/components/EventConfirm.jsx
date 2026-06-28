import { useState } from "react";
import { markMissed, confirmHappened, confirmOngoing } from "../lib/events.js";
import { isoToLocalInput, localInputToIso, formatClock } from "../lib/time.js";

// "Did this happen?" confirmation for a planned event.
//   Yes  -> confirm start/end, create a finished entry (appears in the report)
//   No   -> mark missed (nothing written to entries)
//   Still ongoing -> create an ongoing entry, like starting any task
export default function EventConfirm({ event, startAtYes = false, onClose, onResolved }) {
  const [step, setStep] = useState(startAtYes ? "when" : "ask");
  const [start, setStart] = useState(() => isoToLocalInput(event.scheduled_at));
  const [end, setEnd] = useState(() => isoToLocalInput());
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  const onNo = () => run(() => markMissed(event.id));
  const onOngoing = () =>
    run(() => confirmOngoing(event.id, { title: event.title, start: event.scheduled_at }));
  const onConfirmHappened = () =>
    run(() =>
      confirmHappened(event.id, {
        title: event.title,
        start: localInputToIso(start),
        end: localInputToIso(end),
      })
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface-light p-5 shadow-xl dark:bg-neutral-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Did this happen?
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          “{event.title}” · scheduled {formatClock(event.scheduled_at)} ET
        </p>

        {step === "ask" ? (
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => setStep("when")}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900"
            >
              Yes, it happened
            </button>
            <button
              onClick={onOngoing}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-secondary dark:text-white"
            >
              Still ongoing
            </button>
            <button
              onClick={onNo}
              disabled={busy}
              className="min-h-[44px] rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              No, it didn't
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Confirm when it started and ended (Eastern).
            </p>
            <label className="mt-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Start
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-surface-light px-3 py-2 text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              End
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-surface-light px-3 py-2 text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => (startAtYes ? onClose() : setStep("ask"))}
                className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Back
              </button>
              <button
                onClick={onConfirmHappened}
                disabled={busy}
                className="min-h-[44px] rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900"
              >
                Save to log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { finishEntry, startTask, startIdle } from "../lib/entries.js";
import { isoToLocalInput, localInputToIso } from "../lib/time.js";

// Two-step finish flow:
//   1. Confirm / edit the exact end timestamp for the task being finished.
//   2. "What's next?" — name the next task, or mark no tasks pending.
// All data writes happen here; onDone() tells the parent to refresh.
export default function FinishFlow({ entry, onDone, onCancel }) {
  const [step, setStep] = useState("time");
  const [endLocal, setEndLocal] = useState(() => isoToLocalInput());
  const [nextName, setNextName] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmTime() {
    setBusy(true);
    try {
      await finishEntry(entry.id, localInputToIso(endLocal));
      setStep("next");
    } finally {
      setBusy(false);
    }
  }

  async function chooseNextTask() {
    if (!nextName.trim()) return;
    setBusy(true);
    try {
      await startTask(nextName);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function chooseNoTasks() {
    setBusy(true);
    try {
      await startIdle();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={step === "time" ? onCancel : undefined}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface-light p-5 shadow-xl dark:bg-neutral-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "time" ? (
          <>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Finish “{entry.name}”
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Confirm when this task actually ended — adjust if it wasn't just now.
            </p>
            <label className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              End time (Eastern)
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-surface-light px-3 py-2 text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmTime}
                disabled={busy}
                className="min-h-[44px] rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-secondary dark:text-white"
              >
                Confirm time
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              What's next?
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Start your next task, or mark that nothing is pending.
            </p>
            <input
              autoFocus
              value={nextName}
              onChange={(e) => setNextName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && chooseNextTask()}
              placeholder="Next task name"
              className="mt-4 w-full rounded-lg border border-neutral-300 bg-surface-light px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={chooseNoTasks}
                disabled={busy}
                className="min-h-[44px] rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                No tasks pending
              </button>
              <button
                onClick={chooseNextTask}
                disabled={busy || !nextName.trim()}
                className="min-h-[44px] rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900"
              >
                Start this task
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

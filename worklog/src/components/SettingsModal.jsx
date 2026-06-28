import { useState } from "react";

// Nudge cadence options (minutes). The spec calls for every 30–60 minutes.
const INTERVAL_OPTIONS = [30, 35, 40, 45, 50, 55, 60];

export default function SettingsModal({ settings, onSave, onClose }) {
  const [minutes, setMinutes] = useState(settings.nudgeIntervalMinutes);

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
          Settings
        </h2>

        <label className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Nudge me every
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-surface-light px-3 py-2 text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {INTERVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Nudges only appear during your shift hours, and never while you're on
          a break.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ nudgeIntervalMinutes: minutes })}
            className="min-h-[44px] rounded-lg bg-accent-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-accent-dark dark:text-neutral-900"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

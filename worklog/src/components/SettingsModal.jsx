import { useState } from "react";

// Nudge cadence options (minutes). The spec calls for every 30–60 minutes.
const INTERVAL_OPTIONS = [30, 35, 40, 45, 50, 55, 60];

export default function SettingsModal({
  settings,
  notifPermission,
  onEnableNotifications,
  canInstall,
  onInstall,
  onSave,
  onClose,
}) {
  const [minutes, setMinutes] = useState(settings.nudgeIntervalMinutes);
  const [enabling, setEnabling] = useState(false);

  async function enable() {
    setEnabling(true);
    try {
      await onEnableNotifications?.();
    } finally {
      setEnabling(false);
    }
  }

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

        {/* Notifications */}
        <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Notifications
          </p>
          {notifPermission === "granted" ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-working-light dark:text-working-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-working-light dark:bg-working-dark" />
              Enabled — nudges can reach you outside the app.
            </p>
          ) : notifPermission === "denied" ? (
            <p className="mt-1 text-sm text-breakc-light dark:text-breakc-dark">
              Blocked in your browser settings. Re-enable notifications for this
              site to receive nudges outside the app.
            </p>
          ) : notifPermission === "unsupported" ? (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              This browser doesn't support push notifications.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Get nudges as notifications with action buttons, even when the
                app isn't in front.
              </p>
              <button
                onClick={enable}
                disabled={enabling}
                className="mt-2 min-h-[44px] rounded-lg border border-accent-light px-4 text-sm font-semibold text-accent-light hover:bg-accent-light/10 disabled:opacity-50 dark:border-accent-dark dark:text-accent-dark"
              >
                {enabling ? "Enabling…" : "Enable notifications"}
              </button>
            </>
          )}
        </div>

        {/* Install */}
        <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Install app
          </p>
          {canInstall ? (
            <>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Add Work Log to your home screen to run it full-screen like a
                native app.
              </p>
              <button
                onClick={onInstall}
                className="mt-2 min-h-[44px] rounded-lg bg-accent-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-accent-dark dark:text-neutral-900"
              >
                Install app
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              On Android Chrome, open this site and use the browser menu →
              “Install app” / “Add to Home screen”.
            </p>
          )}
        </div>

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

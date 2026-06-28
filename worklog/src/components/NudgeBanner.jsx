// In-app nudge (Step 4). In Step 5 the same prompts become a Web Push
// notification with these as inline action buttons.
//
// Content depends on state:
//   - a task is ongoing -> "Still working" / "Finished"
//   - idle (no active task) -> "Start a task" / "Nothing"
export default function NudgeBanner({
  ongoing,
  onStillWorking,
  onFinished,
  onStartTask,
  onNothing,
  onDismiss,
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Check-in"
      className="mt-4 rounded-xl border border-accent-light/40 bg-accent-light/10 p-4 dark:border-accent-dark/40 dark:bg-accent-dark/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {ongoing ? `Still on “${ongoing.name}”?` : "Anything to log?"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {ongoing
              ? "Quick check-in — keep going, or wrap it up."
              : "You don't have an active task right now."}
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {ongoing ? (
          <>
            <button
              onClick={onStillWorking}
              className="min-h-[44px] flex-1 rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-working-dark dark:text-neutral-900"
            >
              Still working
            </button>
            <button
              onClick={onFinished}
              className="min-h-[44px] flex-1 rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-secondary dark:text-white"
            >
              Finished
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onStartTask}
              className="min-h-[44px] flex-1 rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-working-dark dark:text-neutral-900"
            >
              Start a task
            </button>
            <button
              onClick={onNothing}
              className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Nothing
            </button>
          </>
        )}
      </div>
    </div>
  );
}

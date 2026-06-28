import { useCallback, useEffect, useRef, useState } from "react";
import {
  listTodayEntries,
  getOngoingEntry,
  startTask,
  usingLocalFallback,
} from "../lib/entries.js";
import { SHIFT_SCHEDULE } from "../config/shift.js";
import { fmtClock, fmtDateLong, fmtElapsed } from "../lib/format.js";
import { useNow } from "../lib/useNow.js";
import FinishFlow from "../components/FinishFlow.jsx";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function todayShift() {
  // Step 1: local weekday. Becomes America/New_York in Step 2.
  return SHIFT_SCHEDULE[WEEKDAYS[new Date().getDay()]] || null;
}

export default function Today() {
  const [entries, setEntries] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startName, setStartName] = useState("");
  const [showFinish, setShowFinish] = useState(false);
  const [stillFlash, setStillFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const flashTimer = useRef(null);
  const now = useNow(1000);

  const refresh = useCallback(async () => {
    const [list, active] = await Promise.all([
      listTodayEntries(),
      getOngoingEntry(),
    ]);
    setEntries(list);
    setOngoing(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return () => clearTimeout(flashTimer.current);
  }, [refresh]);

  async function handleStart() {
    if (!startName.trim() || busy) return;
    setBusy(true);
    try {
      await startTask(startName);
      setStartName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleStillWorking() {
    // Step 1: no nudges yet — this just acknowledges. It will reset the nudge
    // timer once the nudge system lands (Step 4).
    setStillFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStillFlash(false), 1800);
  }

  const shift = todayShift();
  const reportEntries = entries.filter((e) => e.include_in_report);
  const taskCount = entries.filter((e) => e.type === "task").length;
  const ongoingSeconds = ongoing
    ? (now - new Date(ongoing.start_time).getTime()) / 1000
    : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:pb-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {fmtDateLong()}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {shift ? `Shift ${shift.start}–${shift.end} ET` : "No shift today"}
          </p>
        </div>
        {/* Break button — visual placeholder, wired up in Step 3. */}
        <button
          disabled
          title="Break tracking arrives in Step 3"
          className="min-h-[44px] cursor-not-allowed rounded-lg bg-breakc-light/90 px-4 text-sm font-semibold text-white opacity-50 dark:bg-breakc-dark dark:text-neutral-900"
        >
          Take a break
        </button>
      </header>

      {usingLocalFallback && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
          Running on local storage (no Supabase configured). Data stays on this
          device. See <span className="font-mono">README.md</span> to connect
          Supabase for cross-device sync.
        </div>
      )}

      {/* Active entry card */}
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : ongoing ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-working-light/10 px-2.5 py-0.5 text-xs font-medium text-working-light dark:bg-working-dark/15 dark:text-working-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-working-light dark:bg-working-dark" />
                ongoing
              </span>
              <span className="text-xs text-neutral-400">
                started {fmtClock(ongoing.start_time)}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {ongoing.name}
            </h2>
            <p className="mt-0.5 font-mono text-2xl tabular-nums text-neutral-800 dark:text-neutral-200">
              {fmtElapsed(ongoingSeconds)}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleStillWorking}
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {stillFlash ? "Got it 👍" : "Still working"}
              </button>
              <button
                onClick={() => setShowFinish(true)}
                className="min-h-[44px] flex-1 rounded-lg bg-accent-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-accent-dark dark:text-neutral-900"
              >
                Finished
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No active task
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="What are you starting?"
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-400 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <button
                onClick={handleStart}
                disabled={busy || !startName.trim()}
                className="min-h-[44px] rounded-lg bg-working-light px-5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900"
              >
                Start task
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Stat tiles */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Tasks today
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {taskCount}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Breaks today
          </p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
            Step 3
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="mt-4">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Today's timeline
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          {reportEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-400">
              Nothing logged yet today. Start a task above.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {reportEntries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {e.name || "(untitled)"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {fmtClock(e.start_time)} – {e.end_time ? fmtClock(e.end_time) : "now"}
                    </p>
                  </div>
                  {e.status === "ongoing" ? (
                    <span className="shrink-0 rounded-full bg-working-light/10 px-2 py-0.5 text-xs font-medium text-working-light dark:bg-working-dark/15 dark:text-working-dark">
                      ongoing
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      {fmtElapsed(
                        (new Date(e.end_time).getTime() -
                          new Date(e.start_time).getTime()) /
                          1000
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {showFinish && ongoing && (
        <FinishFlow
          entry={ongoing}
          onCancel={() => setShowFinish(false)}
          onDone={async () => {
            setShowFinish(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

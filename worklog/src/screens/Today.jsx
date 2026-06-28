import { useCallback, useEffect, useRef, useState } from "react";
import {
  listTodayEntries,
  getOngoingEntry,
  startTask,
  startIdle,
  usingLocalFallback,
} from "../lib/entries.js";
import {
  listTodayBreaks,
  getOpenBreak,
  startBreak,
  endBreak,
} from "../lib/breaks.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import { fmtElapsed, fmtMins } from "../lib/format.js";
import {
  formatClock,
  formatDateLong,
  formatNowET,
  shiftFor,
  isWithinShiftHours,
  shiftDayKey,
} from "../lib/time.js";
import {
  DAILY_BREAK_BUDGET_MINUTES,
  BREAK_WARNING_THRESHOLD_MINUTES_LEFT,
} from "../config/shift.js";
import { useNow } from "../lib/useNow.js";
import FinishFlow from "../components/FinishFlow.jsx";
import NudgeBanner from "../components/NudgeBanner.jsx";
import SettingsModal from "../components/SettingsModal.jsx";

const BUDGET_SEC = DAILY_BREAK_BUDGET_MINUTES * 60;

// Seconds a break contributes right now: its recorded duration once closed, or
// its live running time while still open.
function breakSeconds(b, nowMs) {
  if (b.end_time) {
    return (
      b.duration_seconds ??
      Math.max(0, (Date.parse(b.end_time) - Date.parse(b.start_time)) / 1000)
    );
  }
  return Math.max(0, (nowMs - Date.parse(b.start_time)) / 1000);
}

export default function Today() {
  const [entries, setEntries] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [todayBreaks, setTodayBreaks] = useState([]);
  const [openBreak, setOpenBreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startName, setStartName] = useState("");
  const [showFinish, setShowFinish] = useState(false);
  const [stillFlash, setStillFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(getSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const flashTimer = useRef(null);
  const toastTimer = useRef(null);
  const warnRef = useRef({ day: null, low: false, over: false });
  const lastActivityRef = useRef(Date.now());
  const startInputRef = useRef(null);
  const now = useNow(1000);

  const nudgeIntervalMs = settings.nudgeIntervalMinutes * 60 * 1000;

  // Any meaningful action resets the nudge countdown and clears an open nudge.
  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setNudgeOpen(false);
  }, []);

  const refresh = useCallback(async () => {
    const [list, active, breaks, open] = await Promise.all([
      listTodayEntries(),
      getOngoingEntry(),
      listTodayBreaks(),
      getOpenBreak(),
    ]);
    setEntries(list);
    setOngoing(active);
    setTodayBreaks(breaks);
    setOpenBreak(open);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      clearTimeout(flashTimer.current);
      clearTimeout(toastTimer.current);
    };
  }, [refresh]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  async function handleStart() {
    if (!startName.trim() || busy) return;
    setBusy(true);
    try {
      await startTask(startName);
      setStartName("");
      bumpActivity();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleStillWorking() {
    // Acknowledge and reset the nudge countdown.
    bumpActivity();
    setStillFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStillFlash(false), 1800);
  }

  // Idle nudge: "Nothing" — log/refresh an idle entry (kept out of the report).
  async function handleNothing() {
    bumpActivity();
    setBusy(true);
    try {
      await startIdle();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  // Idle nudge: jump to starting a task.
  function handleNudgeStartTask() {
    bumpActivity();
    startInputRef.current?.focus();
  }

  async function handleTakeBreak() {
    if (busy || openBreak) return;
    setNudgeOpen(false); // suppress nudges while on a break
    setBusy(true);
    try {
      await startBreak();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    if (busy || !openBreak) return;
    setBusy(true);
    try {
      await endBreak(openBreak.id, openBreak.start_time);
      bumpActivity(); // restart the nudge countdown after the break
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const shift = shiftFor();
  const inShift = isWithinShiftHours();
  const onBreak = Boolean(openBreak);
  const reportEntries = entries.filter((e) => e.include_in_report);
  const taskCount = entries.filter((e) => e.type === "task").length;

  // Break budget used today (live, including any open break).
  const usedSec = todayBreaks.reduce((s, b) => s + breakSeconds(b, now), 0);
  const remainingMin = (BUDGET_SEC - usedSec) / 60;
  const overBudget = usedSec >= BUDGET_SEC;
  const lowBudget = !overBudget && remainingMin <= BREAK_WARNING_THRESHOLD_MINUTES_LEFT;
  const pct = Math.min(100, (usedSec / BUDGET_SEC) * 100);
  const budgetColor = overBudget
    ? "text-breakc-light dark:text-breakc-dark"
    : lowBudget
    ? "text-amber-600 dark:text-amber-400"
    : "text-neutral-900 dark:text-neutral-100";

  // Active task elapsed, excluding any break time taken during this task.
  let ongoingSeconds = 0;
  if (ongoing) {
    const taskStart = Date.parse(ongoing.start_time);
    const breakDuringTask = todayBreaks
      .filter((b) => Date.parse(b.start_time) >= taskStart)
      .reduce((s, b) => s + breakSeconds(b, now), 0);
    ongoingSeconds = Math.max(0, (now - taskStart) / 1000 - breakDuringTask);
  }
  const openBreakSec = openBreak ? breakSeconds(openBreak, now) : 0;

  // Fire budget warnings once each per shift-day.
  const dayKey = shiftDayKey();
  const usedSecFloor = Math.floor(usedSec);
  useEffect(() => {
    if (warnRef.current.day !== dayKey) {
      warnRef.current = { day: dayKey, low: false, over: false };
    }
    const w = warnRef.current;
    if (!w.over && usedSec >= BUDGET_SEC) {
      w.over = true;
      w.low = true;
      showToast("over", `Break budget exceeded — ${fmtMins(usedSec)} used of ${fmtMins(BUDGET_SEC)}.`);
    } else if (!w.low && remainingMin <= BREAK_WARNING_THRESHOLD_MINUTES_LEFT && remainingMin > 0) {
      w.low = true;
      showToast("low", `About ${Math.ceil(remainingMin)} min of break time left today.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedSecFloor, dayKey]);

  // Periodic nudge: only during shift hours, never on a break, fires once the
  // configured interval has elapsed since the last activity (task ongoing or
  // idle both qualify). Surfaces as an in-app banner here; becomes a Web Push
  // notification with the same actions in Step 5.
  useEffect(() => {
    if (nudgeOpen || onBreak || !isWithinShiftHours()) return;
    if (Date.now() - lastActivityRef.current >= nudgeIntervalMs) {
      setNudgeOpen(true);
    }
  }, [now, onBreak, nudgeOpen, nudgeIntervalMs]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:pb-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {formatDateLong()}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {formatNowET()}
            {" · "}
            {shift
              ? `shift ${shift.start}–${shift.end} ET · ${inShift ? "in shift" : "off shift"}`
              : "no shift today"}
          </p>
        </div>

        <div className="flex items-start gap-2">
        {/* Break control: red while working, green while on a break. */}
        {onBreak ? (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleResume}
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900"
            >
              Resume work
            </button>
            <span className="font-mono text-xs tabular-nums text-breakc-light dark:text-breakc-dark">
              on break — {fmtElapsed(openBreakSec)}
            </span>
          </div>
        ) : ongoing ? (
          <button
            onClick={handleTakeBreak}
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-breakc-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-breakc-dark dark:text-white"
          >
            Take a break
          </button>
        ) : null}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Settings"
            className="min-h-[44px] rounded-lg border border-neutral-300 px-2.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Periodic check-in nudge */}
      {nudgeOpen && !onBreak && (
        <NudgeBanner
          ongoing={ongoing}
          onStillWorking={handleStillWorking}
          onFinished={() => {
            setNudgeOpen(false);
            setShowFinish(true);
          }}
          onStartTask={handleNudgeStartTask}
          onNothing={handleNothing}
          onDismiss={bumpActivity}
        />
      )}

      {/* Budget warning banner */}
      {toast && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
            toast.type === "over"
              ? "border-breakc-light/40 bg-breakc-light/10 text-breakc-light dark:border-breakc-dark/40 dark:bg-breakc-dark/15 dark:text-breakc-dark"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
          }`}
          role="status"
        >
          <span>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 text-xs font-medium underline opacity-80 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {usingLocalFallback && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
          Running on local storage (no Supabase configured). Data stays on this
          device. See <span className="font-mono">README.md</span> to connect
          Supabase for cross-device sync.
        </div>
      )}

      {/* Active entry card */}
      <section className="mt-4 rounded-xl bg-surface-light p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : ongoing ? (
          <div>
            <div className="flex items-center gap-2">
              {onBreak ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-breakc-light/10 px-2.5 py-0.5 text-xs font-medium text-breakc-light dark:bg-breakc-dark/15 dark:text-breakc-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-breakc-light dark:bg-breakc-dark" />
                  paused
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-working-light/10 px-2.5 py-0.5 text-xs font-medium text-working-light dark:bg-working-dark/15 dark:text-working-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-working-light dark:bg-working-dark" />
                  ongoing
                </span>
              )}
              <span className="text-xs text-neutral-400">
                started {formatClock(ongoing.start_time)}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {ongoing.name}
            </h2>
            <p className="mt-0.5 font-mono text-2xl tabular-nums text-neutral-800 dark:text-neutral-200">
              {fmtElapsed(ongoingSeconds)}
            </p>
            {onBreak ? (
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                Paused while you're on a break. Resume work to keep the timer
                going.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleStillWorking}
                  className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {stillFlash ? "Got it 👍" : "Still working"}
                </button>
                <button
                  onClick={() => setShowFinish(true)}
                  className="min-h-[44px] flex-1 rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 dark:bg-secondary dark:text-white"
                >
                  Finished
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No active task
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                ref={startInputRef}
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="What are you starting?"
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 bg-surface-light px-3 text-neutral-900 placeholder:text-neutral-400 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
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
        <div className="rounded-xl bg-surface-light p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Tasks today
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {taskCount}
          </p>
        </div>
        <div className="rounded-xl bg-surface-light p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Breaks today
          </p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${budgetColor}`}>
            {fmtMins(usedSec)}{" "}
            <span className="whitespace-nowrap text-sm font-normal text-neutral-400">
              / {fmtMins(BUDGET_SEC)}
            </span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <span
              className={`block h-full rounded-full ${
                overBudget
                  ? "bg-breakc-light dark:bg-breakc-dark"
                  : lowBudget
                  ? "bg-amber-500"
                  : "bg-working-light dark:bg-working-dark"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="mt-4">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Today's timeline
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl bg-surface-light shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
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
                      {formatClock(e.start_time)} – {e.end_time ? formatClock(e.end_time) : "now"}
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
        <p className="mt-2 px-1 text-xs text-neutral-400">
          Breaks are tracked separately and never appear in the EOD report.
        </p>
      </section>

      {showFinish && ongoing && (
        <FinishFlow
          entry={ongoing}
          onCancel={() => setShowFinish(false)}
          onDone={async () => {
            setShowFinish(false);
            bumpActivity();
            await refresh();
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(patch) => {
            setSettings(saveSettings(patch));
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

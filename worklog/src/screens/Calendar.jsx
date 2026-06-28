import { useState } from "react";
import { addEvent, deleteEvent, STATUS_LABEL } from "../lib/events.js";
import {
  formatClock,
  formatDateLong,
  shiftDayKey,
  isoToLocalInput,
  localInputToIso,
} from "../lib/time.js";

const BADGE = {
  pending:
    "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  happened:
    "bg-working-light/10 text-working-light dark:bg-working-dark/15 dark:text-working-dark",
  missed:
    "bg-breakc-light/10 text-breakc-light dark:bg-breakc-dark/15 dark:text-breakc-dark",
  ongoing:
    "bg-accent-light/10 text-accent-light dark:bg-accent-dark/15 dark:text-accent-dark",
};

function defaultWhen() {
  // Default a new event to the next hour, in ET wall-clock.
  return isoToLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString());
}

export default function Calendar({ events, onChanged, onConfirm }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultWhen);
  const [lead, setLead] = useState(20);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim() || !when || busy) return;
    setBusy(true);
    try {
      await addEvent({
        title,
        scheduled_at: localInputToIso(when),
        reminder_lead_minutes: lead,
      });
      setTitle("");
      setWhen(defaultWhen());
      setLead(20);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await deleteEvent(id);
    await onChanged();
  }

  // Group events by ET day, preserving the ascending order from the data layer.
  const groups = [];
  const byDay = new Map();
  for (const ev of events) {
    const key = shiftDayKey(ev.scheduled_at);
    let g = byDay.get(key);
    if (!g) {
      g = { key, day: formatDateLong(ev.scheduled_at), items: [] };
      byDay.set(key, g);
      groups.push(g);
    }
    g.items.push(ev);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:pb-10">
      <header>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Calendar
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          Plan events and get a reminder before and at the time.
        </p>
      </header>

      {/* Add event */}
      <section className="mt-4 rounded-xl bg-surface-light p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="min-h-[44px] w-full rounded-lg border border-neutral-300 bg-surface-light px-3 text-neutral-900 placeholder:text-neutral-400 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Date & time (Eastern)
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 bg-surface-light px-3 text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
          <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:w-32">
            Remind before
            <span className="mt-1 flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={lead}
                onChange={(e) => setLead(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-neutral-300 bg-surface-light px-3 text-right text-neutral-900 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent-light/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
              <span className="text-sm text-neutral-500">min</span>
            </span>
          </label>
        </div>
        <button
          onClick={add}
          disabled={busy || !title.trim()}
          className="mt-3 min-h-[44px] w-full rounded-lg bg-working-light px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 dark:bg-working-dark dark:text-neutral-900 sm:w-auto sm:px-6"
        >
          Add event
        </button>
      </section>

      {/* Grouped list */}
      <section className="mt-4">
        {groups.length === 0 ? (
          <div className="rounded-xl bg-surface-light p-8 text-center text-sm text-neutral-400 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
            No events yet. Add one above.
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-4">
              <h2 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {g.day}
              </h2>
              <div className="overflow-hidden rounded-xl bg-surface-light shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {g.items.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {ev.title}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatClock(ev.scheduled_at)} ET · reminds{" "}
                          {ev.reminder_lead_minutes} min before
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[STATUS_LABEL[ev.status]]}`}
                      >
                        {STATUS_LABEL[ev.status]}
                      </span>
                      {ev.status === "pending" && (
                        <button
                          onClick={() => onConfirm(ev)}
                          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        onClick={() => remove(ev.id)}
                        aria-label="Delete event"
                        className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-black/5 hover:text-breakc-light dark:hover:bg-white/10"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

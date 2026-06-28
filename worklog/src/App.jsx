import { useCallback, useEffect, useRef, useState } from "react";
import Today from "./screens/Today.jsx";
import Calendar from "./screens/Calendar.jsx";
import Report from "./screens/Report.jsx";
import EventConfirm from "./components/EventConfirm.jsx";
import { listEvents, markMissed, confirmOngoing } from "./lib/events.js";
import { showEventReminder } from "./lib/push.js";
import { formatClock } from "./lib/time.js";
import { useNow } from "./lib/useNow.js";

const NAV = [
  { key: "today", label: "Today" },
  { key: "calendar", label: "Calendar" },
  { key: "report", label: "Report" },
];

function NavButton({ item, active, onClick, layout }) {
  const base =
    "flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition";
  const live = active
    ? "text-accent-light dark:text-accent-dark bg-accent-light/10 dark:bg-accent-dark/15"
    : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5";
  const soon = "text-neutral-400 dark:text-neutral-600 cursor-not-allowed";
  const shape =
    layout === "sidebar"
      ? "w-full justify-start px-3 py-2"
      : "flex-1 flex-col px-2 py-1.5 text-xs gap-0.5 min-h-[52px]";
  return (
    <button
      disabled={item.soon}
      onClick={item.soon ? undefined : onClick}
      title={item.soon ? "Coming in a later step" : undefined}
      className={`${base} ${shape} ${item.soon ? soon : live}`}
    >
      {item.label}
      {item.soon && layout === "sidebar" && (
        <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
      )}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [events, setEvents] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { event, startAtYes }
  const [reloadSignal, setReloadSignal] = useState(0);
  const [reportSignal, setReportSignal] = useState(0);
  const [eventToast, setEventToast] = useState(null);
  const firedRef = useRef(new Map());
  const toastTimer = useRef(null);
  const routeRef = useRef(() => {});
  const now = useNow(1000);

  const loadEvents = useCallback(async () => {
    setEvents(await listEvents());
  }, []);

  useEffect(() => {
    loadEvents();
    return () => clearTimeout(toastTimer.current);
  }, [loadEvents]);

  const flashEvent = useCallback((msg) => {
    setEventToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setEventToast(null), 7000);
  }, []);

  const bumpReload = useCallback(() => setReloadSignal((n) => n + 1), []);

  // Today's "Generate EOD report" button jumps to the Report tab and kicks off
  // generation there.
  const openReport = useCallback(() => {
    setTab("report");
    setReportSignal((n) => n + 1);
  }, []);

  const resolveConfirm = useCallback(async () => {
    setConfirmState(null);
    await loadEvents();
    bumpReload();
  }, [loadEvents, bumpReload]);

  // Reminder scheduler: for each pending event, fire a lead reminder and an
  // at-time reminder, each once. When the tab is hidden we raise a system
  // notification; when visible we surface it in-app (a toast for the lead, the
  // confirm modal at the time).
  useEffect(() => {
    const hidden = typeof document !== "undefined" && document.hidden;
    for (const ev of events) {
      if (ev.status !== "pending") continue;
      const sched = Date.parse(ev.scheduled_at);
      const lead = sched - ev.reminder_lead_minutes * 60000;
      const f = firedRef.current.get(ev.id) || {};

      if (!f.lead && now >= lead && now < sched) {
        f.lead = true;
        firedRef.current.set(ev.id, f);
        if (hidden) showEventReminder(ev, "lead");
        else flashEvent(`Upcoming: ${ev.title} at ${formatClock(ev.scheduled_at)} ET`);
      }
      // Fire the at-time prompt once, and only within a sane window of the time.
      if (!f.at && now >= sched && now - sched < 12 * 3600000) {
        f.at = true;
        firedRef.current.set(ev.id, f);
        if (hidden) showEventReminder(ev, "at");
        else setConfirmState({ event: ev, startAtYes: false });
      }
    }
  }, [now, events, flashEvent]);

  // Route notification action buttons for events (from the service worker).
  routeRef.current = (action, data) => {
    if (!action || !action.startsWith("event_")) return;
    const ev = events.find((e) => e.id === data?.eventId);
    if (!ev) return;
    if (action === "event_no") {
      markMissed(ev.id).then(loadEvents);
    } else if (action === "event_ongoing") {
      confirmOngoing(ev.id, { title: ev.title, start: ev.scheduled_at }).then(resolveConfirm);
    } else if (action === "event_yes") {
      setConfirmState({ event: ev, startAtYes: true });
    }
  };
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e) => {
      if (e.data && e.data.type === "nudge-action") routeRef.current(e.data.action, e.data.data);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="min-h-full bg-canvas-light font-sans text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 md:flex">
      {/* Desktop: sidebar nav */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 p-4 dark:border-neutral-800 md:block">
        <div className="px-2 pb-4 text-lg font-semibold">Work Log</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={tab === item.key}
              onClick={() => setTab(item.key)}
              layout="sidebar"
            />
          ))}
        </nav>
      </aside>

      {/* Main content — both screens stay mounted so timers/state persist. */}
      <main className="min-w-0 flex-1">
        <div className={tab === "today" ? "" : "hidden"}>
          <Today reloadSignal={reloadSignal} onGenerateReport={openReport} />
        </div>
        <div className={tab === "calendar" ? "" : "hidden"}>
          <Calendar
            events={events}
            onChanged={loadEvents}
            onConfirm={(ev) => setConfirmState({ event: ev, startAtYes: false })}
          />
        </div>
        <div className={tab === "report" ? "" : "hidden"}>
          <Report generateSignal={reportSignal} />
        </div>
      </main>

      {/* Mobile: bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-neutral-200 bg-surface-light/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 md:hidden">
        {NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={tab === item.key}
            onClick={() => setTab(item.key)}
            layout="bottom"
          />
        ))}
      </nav>

      {/* Lead-time reminder toast */}
      {eventToast && (
        <div className="fixed inset-x-0 top-3 z-50 mx-auto w-[min(92%,28rem)] rounded-lg border border-accent-light/40 bg-accent-light/10 px-3 py-2 text-sm text-accent-light shadow-sm dark:border-accent-dark/40 dark:bg-accent-dark/15 dark:text-accent-dark">
          {eventToast}
        </div>
      )}

      {/* Event confirmation */}
      {confirmState && (
        <EventConfirm
          event={confirmState.event}
          startAtYes={confirmState.startAtYes}
          onClose={() => setConfirmState(null)}
          onResolved={resolveConfirm}
        />
      )}
    </div>
  );
}

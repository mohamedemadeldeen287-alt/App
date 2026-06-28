// Lightweight display helpers for Step 1.
// Timezone-correct formatting (America/New_York) arrives in Step 2.

export function fmtClock(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDateLong(date = new Date()) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Human elapsed, e.g. "4m 12s", "1h 03m".
export function fmtElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// <input type="datetime-local"> expects local "YYYY-MM-DDTHH:mm".
export function isoToLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function localInputToIso(value) {
  // value is local wall-clock; Date() interprets it in the device tz, then
  // toISOString() normalizes to UTC for storage.
  return new Date(value).toISOString();
}

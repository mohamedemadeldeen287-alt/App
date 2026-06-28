// Timezone-independent display helpers.
// Anything that touches a wall-clock time lives in lib/time.js instead.

// Human elapsed from a number of seconds, e.g. "4m 12s", "1h 03m".
// Durations are differences between two instants, so they need no timezone.
export function fmtElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// Coarse minutes for budgets, e.g. "1h 42m", "47m", "0m". Rounds down to the
// minute (seconds are noise at budget scale).
export function fmtMins(seconds) {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

import { DateTime } from "luxon";
import { SHIFT_SCHEDULE } from "../config/shift.js";

// ─────────────────────────────────────────────────────────────────────────
// The single source of truth for time in this app.
//
// CRITICAL RULE: every display, calculation, and shift-boundary decision must
// happen in America/New_York — never in the device's local timezone. Phones
// set to Cairo and laptops set to US Pacific must show and compute identically.
//
// Storage is always UTC ISO strings. Convert to ET only here, on the way out.
// No component should call `new Date()` for display/calc — go through this
// module instead.
// ─────────────────────────────────────────────────────────────────────────

export const ZONE = "America/New_York";

// Current instant, as an ET DateTime.
export function nowET() {
  return DateTime.now().setZone(ZONE);
}

// A stored UTC ISO string, viewed in ET.
export function etFromIso(iso) {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(ZONE);
}

// Canonical "now" for writing to storage — a UTC ISO string. Routing writes
// through here keeps `new Date()` out of components.
export function nowUtcIso() {
  return DateTime.utc().toISO();
}

/* ------------------------------- formatting ------------------------------ */

// e.g. "8:25 PM"
export function formatClock(iso) {
  if (!iso) return "—";
  return etFromIso(iso).toFormat("h:mm a");
}

// e.g. "Sunday, Jun 28" (defaults to today in ET)
export function formatDateLong(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  return dt.toFormat("cccc, LLL d");
}

// e.g. "8:25 PM ET" — the live ET wall clock (defaults to now)
export function formatNowET(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  return `${dt.toFormat("h:mm a")} ET`;
}

/* ----------------------------- the shift-day ----------------------------- */

// The ET calendar date an instant belongs to, as "yyyy-LL-dd". This is the
// key entries and breaks are bucketed by (shifts are daytime, so the ET
// calendar day is the shift-day). Defaults to today in ET.
export function shiftDayKey(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  return dt.toFormat("yyyy-LL-dd");
}

// True if `iso` falls on the same ET shift-day as `refIso` (default: now).
export function isSameShiftDay(iso, refIso) {
  return shiftDayKey(iso) === shiftDayKey(refIso);
}

// Today's shift window (from SHIFT_SCHEDULE) for the ET weekday, or null on
// weekends / unscheduled days. Defaults to today in ET.
export function shiftFor(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  const weekday = dt.toFormat("cccc").toLowerCase(); // "monday" … "sunday"
  return SHIFT_SCHEDULE[weekday] || null;
}

// Is the given instant within today's ET shift hours? Defaults to now.
export function isWithinShiftHours(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  const shift = shiftFor(iso);
  if (!shift) return false;
  const [sh, sm] = shift.start.split(":").map(Number);
  const [eh, em] = shift.end.split(":").map(Number);
  const start = dt.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = dt.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  return dt >= start && dt <= end;
}

/* --------------------- <input type="datetime-local"> --------------------- */
// The picker shows and is read as ET wall-clock — NOT device-local — so a user
// in Cairo edits the same ET value a user in Pacific would.

export function isoToLocalInput(iso) {
  const dt = iso ? etFromIso(iso) : nowET();
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function localInputToIso(value) {
  // Interpret the wall-clock string AS ET, then normalize to UTC for storage.
  return DateTime.fromFormat(value, "yyyy-LL-dd'T'HH:mm", { zone: ZONE })
    .toUTC()
    .toISO();
}

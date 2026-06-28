// Hardcoded shift configuration. All times are America/New_York (EST) local
// time. Not user-editable for now.
//
// NOTE: timezone polish lands in Step 2 (lib/time.ts). For Step 1 these values
// are consumed as plain strings for display only; no shift-boundary math yet.
export const SHIFT_SCHEDULE = {
  monday: { start: "10:00", end: "19:00" },
  tuesday: { start: "09:00", end: "18:00" },
  wednesday: { start: "10:00", end: "19:00" },
  thursday: { start: "09:00", end: "18:00" },
  friday: { start: "09:00", end: "17:00" },
  // saturday / sunday: no shift
};

export const DAILY_BREAK_BUDGET_MINUTES = 102; // 1h 42m
export const BREAK_WARNING_THRESHOLD_MINUTES_LEFT = 11; // warn ~10-12 min left

// Default nudge cadence (configurable later in settings).
export const DEFAULT_NUDGE_INTERVAL_MINUTES = 45;

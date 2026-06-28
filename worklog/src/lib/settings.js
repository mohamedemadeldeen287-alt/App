import { DEFAULT_NUDGE_INTERVAL_MINUTES } from "../config/shift.js";

// Small user-adjustable settings, persisted locally. (Single-user app, so no
// need to sync these across devices for now.)

const KEY = "worklog.settings.v1";

const DEFAULTS = {
  nudgeIntervalMinutes: DEFAULT_NUDGE_INTERVAL_MINUTES,
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

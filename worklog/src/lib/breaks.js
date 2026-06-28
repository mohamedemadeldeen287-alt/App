import { supabase, supabaseConfigured } from "./supabase.js";
import { nowUtcIso, shiftDayKey } from "./time.js";

// Data layer for the `break_log` table.
//
// Breaks are tracked entirely separately from work entries and NEVER appear in
// the EOD report — this is a personal on-screen budget gauge only.
//
// Each break counts against the America/New_York shift-day it started on
// (`break_date`). Same two-backend pattern as entries.js: Supabase when
// configured, localStorage otherwise.

const LS_KEY = "worklog.breaks.v1";

/* ----------------------------- localStorage ----------------------------- */
function lsRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function lsWrite(rows) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

const localBackend = {
  async listAll() {
    return lsRead();
  },
  async insert(row) {
    const full = {
      id: crypto.randomUUID(),
      end_time: null,
      duration_seconds: null,
      created_at: nowUtcIso(),
      ...row,
    };
    const rows = lsRead();
    rows.push(full);
    lsWrite(rows);
    return full;
  },
  async update(id, patch) {
    const rows = lsRead();
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch };
    lsWrite(rows);
    return rows[i];
  },
};

/* ------------------------------- Supabase ------------------------------- */
const supabaseBackend = {
  async listAll() {
    const { data, error } = await supabase
      .from("break_log")
      .select("*")
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  },
  async insert(row) {
    const { data, error } = await supabase
      .from("break_log")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from("break_log")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

const backend = supabaseConfigured ? supabaseBackend : localBackend;

/* ------------------------------ public API ------------------------------ */

// All of today's breaks (ET shift-day), open and closed, oldest first.
export async function listTodayBreaks() {
  const all = await backend.listAll();
  const today = shiftDayKey();
  return all
    .filter((b) => b.break_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// The currently open break (no end_time), if a break is in progress.
export async function getOpenBreak() {
  const all = await backend.listAll();
  return all.find((b) => !b.end_time) || null;
}

// Begin a break now, bucketed to today's ET shift-day.
export async function startBreak() {
  return backend.insert({
    break_date: shiftDayKey(),
    start_time: nowUtcIso(),
  });
}

// End an open break now, recording its duration.
export async function endBreak(id, startIso) {
  const end = nowUtcIso();
  const duration = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(startIso)) / 1000)
  );
  return backend.update(id, { end_time: end, duration_seconds: duration });
}

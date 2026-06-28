import { supabase, supabaseConfigured } from "./supabase.js";
import { nowUtcIso, isSameShiftDay } from "./time.js";

// Data layer for the `entries` table.
//
// Two interchangeable backends behind one async API:
//   - Supabase (when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set)
//   - localStorage fallback (so Step 1 is clickable with zero setup)
//
// All timestamps are stored as UTC ISO strings. Both the write side (now) and
// "today" filtering go through lib/time, so everything is anchored to the
// America/New_York shift-day regardless of the device's timezone.

const LS_KEY = "worklog.entries.v1";

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
  async list() {
    return lsRead().sort((a, b) => a.start_time.localeCompare(b.start_time));
  },
  async insert(row) {
    const full = {
      id: crypto.randomUUID(),
      created_at: nowUtcIso(),
      end_time: null,
      name: null,
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
  async list() {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  },
  async insert(row) {
    const { data, error } = await supabase
      .from("entries")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from("entries")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

const backend = supabaseConfigured ? supabaseBackend : localBackend;

export const usingLocalFallback = !supabaseConfigured;

/* ------------------------------ public API ------------------------------ */

// Entries whose start falls on today's America/New_York shift-day.
export async function listTodayEntries() {
  const all = await backend.list();
  return all.filter((r) => isSameShiftDay(r.start_time));
}

// The single active task/idle entry, if any (breaks are tracked separately).
export async function getOngoingEntry() {
  const all = await backend.list();
  return all.find((r) => r.status === "ongoing") || null;
}

export async function startTask(name) {
  return backend.insert({
    type: "task",
    name: name.trim(),
    start_time: nowUtcIso(),
    status: "ongoing",
    include_in_report: true,
  });
}

// "No tasks pending" — logged but kept out of the EOD report.
export async function startIdle() {
  return backend.insert({
    type: "idle",
    name: null,
    start_time: nowUtcIso(),
    status: "no_tasks_pending",
    include_in_report: false,
  });
}

// Finish a task at a specific (already-UTC ISO) timestamp.
export async function finishEntry(id, endTimeIso) {
  return backend.update(id, {
    status: "finished",
    end_time: endTimeIso,
  });
}

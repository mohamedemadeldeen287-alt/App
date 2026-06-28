import { supabase, supabaseConfigured } from "./supabase.js";
import { nowUtcIso } from "./time.js";
import { createTaskEntry } from "./entries.js";

// Data layer for `planned_events` — calendar items that stay separate from work
// entries until confirmed. Confirming "happened" or "still ongoing" creates a
// real entry and links it back here. Same two-backend pattern as the rest.

const LS_KEY = "worklog.events.v1";

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
    return lsRead().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  },
  async insert(row) {
    const full = {
      id: crypto.randomUUID(),
      status: "pending",
      linked_entry_id: null,
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
  async remove(id) {
    lsWrite(lsRead().filter((r) => r.id !== id));
  },
};

/* ------------------------------- Supabase ------------------------------- */
const supabaseBackend = {
  async list() {
    const { data, error } = await supabase
      .from("planned_events")
      .select("*")
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return data;
  },
  async insert(row) {
    const { data, error } = await supabase
      .from("planned_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from("planned_events")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from("planned_events").delete().eq("id", id);
    if (error) throw error;
  },
};

const backend = supabaseConfigured ? supabaseBackend : localBackend;

/* ------------------------------ public API ------------------------------ */

export async function listEvents() {
  return backend.list();
}

export async function addEvent({ title, scheduled_at, reminder_lead_minutes }) {
  return backend.insert({
    title: title.trim(),
    scheduled_at,
    reminder_lead_minutes:
      reminder_lead_minutes === "" || reminder_lead_minutes == null
        ? 20
        : Number(reminder_lead_minutes),
  });
}

export async function deleteEvent(id) {
  return backend.remove(id);
}

// "No" — it didn't happen. Nothing is written to entries; never in any report.
export async function markMissed(id) {
  return backend.update(id, { status: "confirmed_missed" });
}

// "Yes" — create a finished entry from the confirmed start/end and link it.
export async function confirmHappened(id, { title, start, end }) {
  const entry = await createTaskEntry({
    name: title,
    start_time: start,
    end_time: end,
    status: "finished",
  });
  return backend.update(id, {
    status: "confirmed_happened",
    linked_entry_id: entry.id,
  });
}

// "Still ongoing" — create an ongoing entry (like starting any task) and link.
export async function confirmOngoing(id, { title, start }) {
  const entry = await createTaskEntry({
    name: title,
    start_time: start,
    status: "ongoing",
  });
  return backend.update(id, {
    status: "confirmed_ongoing",
    linked_entry_id: entry.id,
  });
}

// Map a stored status to a short badge label.
export const STATUS_LABEL = {
  pending: "pending",
  confirmed_happened: "happened",
  confirmed_missed: "missed",
  confirmed_ongoing: "ongoing",
};

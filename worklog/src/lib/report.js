import { supabase, supabaseConfigured } from "./supabase.js";
import { listTodayEntries } from "./entries.js";
import { formatClock, formatDateLong } from "./time.js";

// Build the EOD report from today's reportable entries.
//
// When Supabase + the Edge Function (and its ANTHROPIC_API_KEY) are configured,
// the report is written by Claude server-side. Otherwise we fall back to a
// simple local template so the feature still works offline. Either way the
// result is a DRAFT — the user reviews and sends it manually.

function localDraft(date, entries) {
  const lines = [`End-of-day report — ${date}`, ""];
  const byName = new Map();
  for (const e of entries) {
    if (!byName.has(e.name)) byName.set(e.name, []);
    byName.get(e.name).push(e);
  }
  for (const [name, items] of byName) {
    const ongoing = items.some((i) => i.status === "ongoing");
    const span = `${items[0].start}–${items[items.length - 1].end}`;
    lines.push(`• ${name}${ongoing ? " (in progress)" : ""} — ${span}`);
  }
  return lines.join("\n");
}

export async function generateReport() {
  const all = await listTodayEntries();
  const entries = all
    .filter((e) => e.include_in_report)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((e) => ({
      name: e.name || "(untitled)",
      start: formatClock(e.start_time),
      end: e.end_time ? formatClock(e.end_time) : "ongoing",
      status: e.status,
    }));
  const date = formatDateLong();

  if (!entries.length) {
    return { report: "No reportable activity logged today.", source: "empty" };
  }

  if (supabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-eod-report",
        { body: { date, entries } }
      );
      if (!error && data?.report) return { report: data.report, source: "ai" };
    } catch {
      /* fall through to the local template */
    }
  }

  return { report: localDraft(date, entries), source: "local" };
}

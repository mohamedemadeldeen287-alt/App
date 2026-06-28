-- Work Log & EOD Report — database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- All timestamps are stored in UTC (timestamptz). Display/calculation in
-- America/New_York happens in the app, never in the database.

-- Work entries: tasks, idle states, and breaks-as-entries are NOT mixed here;
-- breaks live in break_log. Tasks + idle states live here for simple querying.
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('task', 'idle', 'break')),
  name text, -- null for idle/break entries
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null check (status in ('ongoing', 'finished', 'no_tasks_pending')),
  include_in_report boolean not null default true, -- false for idle entries
  created_at timestamptz not null default now()
);

-- Planned calendar events — separate from entries until confirmed.
create table if not exists planned_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  reminder_lead_minutes int not null default 20,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed_happened', 'confirmed_missed', 'confirmed_ongoing')),
  linked_entry_id uuid references entries(id), -- set once confirmed as happened
  created_at timestamptz not null default now()
);

-- Daily break budget tracking.
create table if not exists break_log (
  id uuid primary key default gen_random_uuid(),
  break_date date not null, -- the shift-day this break counts against, in EST
  start_time timestamptz not null,
  end_time timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now()
);

create index if not exists entries_start_time_idx on entries (start_time);
create index if not exists planned_events_scheduled_at_idx on planned_events (scheduled_at);
create index if not exists break_log_break_date_idx on break_log (break_date);

-- NOTE: This is a single-user personal app. Row Level Security is left off for
-- the initial build; add RLS + an auth policy before exposing the project
-- publicly. (Auth wiring is a later step.)

# Work Log & EOD Report

A personal, single-user PWA for tracking tasks during a work shift, managing a
daily break budget, and auto-generating an end-of-day report to review and send
manually. Built with React + Vite, Tailwind, and Supabase. All times are handled
in **America/New_York**.

> **Status:** Step 1 of a staged build. This step is the clickable **Today**
> screen with manual task start / finish. It runs on a localStorage fallback out
> of the box, and uses Supabase once you add credentials. Later steps add the
> timezone utility, break tracking, nudges, web push, the calendar, and the EOD
> report generator.

## Run it locally

Prerequisite: [Node.js](https://nodejs.org) (LTS).

```bash
cd worklog
npm install
npm run dev
```

Open the printed `http://localhost:5173/` URL. With no `.env` file, the app
stores data in your browser (single device) — enough to try the whole Step 1
flow.

## Connect Supabase (optional for Step 1, needed for cross-device sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard: **SQL → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it.
3. Copy `.env.example` to `.env` and fill in the values from
   **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Restart `npm run dev`. The app now reads and writes the `entries` table and
   the banner about local storage disappears.

## What works in Step 1

- Start a task (becomes the single active entry).
- Live elapsed timer on the active task.
- **Still working** — acknowledges (will reset the nudge timer once nudges land
  in Step 4).
- **Finished** — confirm/edit the exact end time, then a "what's next?" prompt:
  name the next task, or mark **no tasks pending** (logged but kept out of the
  report).
- Today's timeline of reportable entries, plus a "tasks today" tile.
- Adaptive layout chrome: sidebar nav on desktop, bottom nav on mobile.
  Dark mode follows your system preference.

## Project layout

```
worklog/
  src/
    config/shift.js     Shift schedule + break budget constants
    lib/
      supabase.js       Supabase client (env-driven, optional)
      entries.js        entries data layer (Supabase or localStorage)
      format.js         display + datetime-local helpers
      useNow.js         live-tick hook for elapsed timers
    components/FinishFlow.jsx   finish → what's-next modal
    screens/Today.jsx   the Step 1 main screen
    App.jsx             adaptive nav shell
  supabase/schema.sql   full DB schema (all tables, for later steps too)
```

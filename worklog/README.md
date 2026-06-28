# Work Log & EOD Report

A personal, single-user PWA for tracking tasks during a work shift, managing a
daily break budget, and auto-generating an end-of-day report to review and send
manually. Built with React + Vite, Tailwind, and Supabase. All times are handled
in **America/New_York**.

> **Status:** Steps 1–7 of a staged build. In place: the **Today** screen
> (manual task start / finish); a single `America/New_York` time utility
> (`src/lib/time.js`); **break tracking**; **in-app nudges** plus **Web Push**
> notifications with action buttons; a **Calendar** tab with planned events,
> before/at-time reminders, and a "Did this happen?" confirmation that links
> into your log; and an **EOD report** generator (Claude-written via an Edge
> Function, with a local fallback) that you review and send manually. It runs on
> a localStorage fallback out of the box, and uses Supabase once you add
> credentials. What's left is polish (PWA install, layout/dark-mode refinements).

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

## Enable Web Push (optional)

In-app nudges and local (tab-open) notifications need no setup. To receive
pushes when the app is fully closed:

1. Generate a VAPID key pair (once): `npx web-push generate-vapid-keys`.
2. Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY` and rebuild.
3. Set the Edge Function secrets and deploy it:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
   supabase functions deploy send-nudge-push
   ```
4. In the app, open Settings → **Enable notifications** and accept the prompt.
   The device's push subscription is stored in `push_subscriptions`.
5. Trigger `send-nudge-push` (e.g. from a scheduled job during shift hours) to
   deliver a nudge.

> Notifications target Android Chrome, which supports notification action
> buttons natively. iOS Safari push is intentionally out of scope.

## Enable Claude-written EOD reports (optional)

The report works out of the box using a local template. For Claude-written
reports:

1. Set the API key as an Edge Function secret and deploy the function:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy generate-eod-report
   ```
2. With Supabase configured (above), the app calls the function automatically;
   the "local template" note on the Report screen disappears.

The key stays server-side in the Edge Function — it is never exposed to the
browser.

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
- All times shown in **America/New_York** (header clock, timeline, the finish
  picker, and the shift-day used for "today"), independent of device timezone.
- **Break tracking**: a red "Take a break" / green "Resume work" control with a
  live break timer. While on a break the active task's elapsed time is paused
  (derived from break timestamps). A "Breaks today" badge shows time used
  against the 1h 42m daily budget, and on-screen warnings fire near the limit
  (~11 min left) and once over budget. Break data is kept entirely out of the
  EOD report.
- **Nudges**: a periodic in-app check-in that only appears during shift hours
  and never while on a break. When a task is ongoing it offers *Still working* /
  *Finished*; when idle it offers *Start a task* / *Nothing*. Any action resets
  the countdown. The interval is configurable (gear icon → Settings, default
  45 min).
- **Notifications (Web Push)**: enable from Settings to also receive nudges as
  system notifications with the same action buttons (built for Android Chrome).
  A service worker (`public/sw.js`) shows the notification and routes a tapped
  action back into the app — e.g. *Finished* opens the timestamp-edit flow.
  When the tab is hidden the app raises the notification locally; a Supabase
  Edge Function (`supabase/functions/send-nudge-push`) is included to deliver
  pushes when the app is fully closed.
- **Calendar**: plan events with a title, an Eastern date/time, and a reminder
  lead (default 20 min). Each event fires two reminders — one at
  `scheduled − lead` and one at the time. The at-time prompt asks *Did this
  happen?*: **Yes** confirms start/end and creates a linked entry that shows in
  the log; **No** marks it missed (nothing logged); **Still ongoing** starts a
  linked ongoing task. The list groups events by day with pending / happened /
  missed / ongoing badges.
- **EOD report**: generate a concise end-of-day report from today's reportable
  entries. When Supabase + an `ANTHROPIC_API_KEY` are configured it's written by
  Claude (`claude-opus-4-8`) in the `generate-eod-report` Edge Function;
  otherwise a local template is used. The draft is fully editable — review it,
  then **Copy** or **Open in email** (a `mailto:` draft). Nothing is ever sent
  automatically.

## Project layout

```
worklog/
  src/
    config/shift.js     Shift schedule + break budget constants
    lib/
      supabase.js       Supabase client (env-driven, optional)
      entries.js        entries data layer (Supabase or localStorage)
      breaks.js         break_log data layer (budget tracking)
      events.js         planned_events data layer (calendar)
      time.js           America/New_York time utility (single source of truth)
      settings.js       local user settings (nudge interval)
      push.js           service-worker registration + Web Push subscription
      report.js         EOD report (Edge Function + local fallback)
      format.js         timezone-independent display helpers
      useNow.js         live-tick hook for elapsed timers
    components/
      FinishFlow.jsx    finish → what's-next modal
      NudgeBanner.jsx   periodic in-app check-in
      SettingsModal.jsx nudge interval + notifications
      EventConfirm.jsx  "Did this happen?" confirmation
    screens/
      Today.jsx         the main screen
      Calendar.jsx      planned events + reminders
      Report.jsx        EOD report review screen
    App.jsx             adaptive nav shell + reminder scheduler
  public/sw.js          service worker (push + notification actions)
  supabase/
    schema.sql          full DB schema (all tables, for later steps too)
    functions/send-nudge-push/      Edge Function to deliver Web Push
    functions/generate-eod-report/  Edge Function: Claude-written EOD report
```

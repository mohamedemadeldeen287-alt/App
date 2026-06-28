import { supabase, supabaseConfigured } from "./supabase.js";
import { formatClock } from "./time.js";

// Web Push + notifications client.
//
// Two layers:
//  - Local notifications via the service worker registration (works as soon as
//    the user grants permission; used when a nudge is due and the tab is
//    hidden). This is the path exercised in the app today.
//  - A real push subscription (PushManager + VAPID) sent to Supabase, so a
//    server/Edge Function can push even when the app is closed. Requires
//    VITE_VAPID_PUBLIC_KEY; no-ops gracefully without it.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof Notification !== "undefined" &&
    "PushManager" in window
  );
}

export function getPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
}

let regPromise = null;
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!regPromise) {
    regPromise = navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready);
  }
  return regPromise;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Subscribe to push and persist the subscription so a server can reach this
// device. Best-effort: needs a VAPID public key and (to store) Supabase.
async function subscribeForPush(reg) {
  if (!VAPID_PUBLIC_KEY || !reg || !reg.pushManager) return null;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  if (supabaseConfigured) {
    await supabase
      .from("push_subscriptions")
      .upsert(
        { endpoint: sub.endpoint, subscription: sub.toJSON() },
        { onConflict: "endpoint" }
      );
  }
  return sub;
}

// Ask for permission and set everything up. Returns { ok, reason }.
export async function enableNotifications() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const reg = await registerServiceWorker();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm };
  // Real push subscription is optional — local notifications work regardless.
  try {
    await subscribeForPush(reg);
  } catch {
    /* no VAPID key or push endpoint unavailable — local notifications still work */
  }
  return { ok: true };
}

// Show a nudge as a system notification (used when the tab is hidden).
export async function showLocalNudge(ongoing) {
  if (getPermission() !== "granted") return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const isOngoing = Boolean(ongoing);
  await reg.showNotification(
    isOngoing ? `Still on “${ongoing.name}”?` : "Anything to log?",
    {
      body: isOngoing
        ? "Quick check-in — keep going, or wrap it up."
        : "No active task right now.",
      tag: "worklog-nudge",
      renotify: true,
      actions: isOngoing
        ? [
            { action: "still_working", title: "Still working" },
            { action: "finished", title: "Finished" },
          ]
        : [
            { action: "start_task", title: "Start a task" },
            { action: "nothing", title: "Nothing" },
          ],
      data: { ongoing: isOngoing },
    }
  );
  return true;
}

// Event reminder notification. kind "lead" is informational; kind "at" carries
// the confirmation actions (Yes / No — "Still ongoing" is offered in-app, since
// Android shows a limited number of action buttons).
export async function showEventReminder(event, kind) {
  if (getPermission() !== "granted") return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  if (kind === "lead") {
    await reg.showNotification(`Upcoming: ${event.title}`, {
      body: `Starts at ${formatClock(event.scheduled_at)} ET`,
      tag: `worklog-event-${event.id}`,
      renotify: true,
      data: { eventId: event.id, kind: "lead" },
    });
  } else {
    await reg.showNotification(`Did this happen? “${event.title}”`, {
      body: "Confirm so it's logged correctly.",
      tag: `worklog-event-${event.id}`,
      renotify: true,
      actions: [
        { action: "event_yes", title: "Yes" },
        { action: "event_no", title: "No" },
      ],
      data: { eventId: event.id, kind: "at" },
    });
  }
  return true;
}

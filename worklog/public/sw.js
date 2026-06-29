/* Work Log service worker — push + actionable notifications.
 *
 * Android Chrome supports inline notification action buttons natively, so the
 * nudge prompts ("Still working" / "Finished", or "Start a task" / "Nothing")
 * are delivered as the notification's `actions`. Tapping an action focuses the
 * app and posts the chosen action to the page, which routes it (e.g. Finished
 * opens the timestamp-edit + what's-next flow).
 */

// Bump this when the cached app shell should be refreshed.
const CACHE = "worklog-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Offline support:
//  - navigations: network-first, fall back to the cached app shell
//  - same-origin GET assets: stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html").then((r) => r || caches.match("/"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

function actionsFor(ongoing) {
  return ongoing
    ? [
        { action: "still_working", title: "Still working" },
        { action: "finished", title: "Finished" },
      ]
    : [
        { action: "start_task", title: "Start a task" },
        { action: "nothing", title: "Nothing" },
      ];
}

// Server-initiated push (web-push from the Edge Function). Payload is JSON:
// { title, body, ongoing, name }.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const ongoing = Boolean(payload.ongoing);
  const title =
    payload.title ||
    (ongoing ? `Still on “${payload.name || "your task"}”?` : "Anything to log?");
  const body =
    payload.body ||
    (ongoing ? "Quick check-in — keep going, or wrap it up." : "No active task right now.");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag || "worklog-nudge",
      renotify: true,
      // Server payloads may specify their own actions (e.g. event reminders);
      // otherwise fall back to the nudge actions.
      actions: payload.actions || actionsFor(ongoing),
      data: payload,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || "open";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      let client = all.find((c) => "focus" in c);
      if (client) {
        await client.focus();
      } else {
        client = await self.clients.openWindow("/");
      }
      if (client)
        client.postMessage({
          type: "nudge-action",
          action,
          data: event.notification.data || {},
        });
    })()
  );
});

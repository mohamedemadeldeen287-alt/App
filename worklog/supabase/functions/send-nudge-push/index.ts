// Supabase Edge Function: send a nudge as a Web Push notification to every
// stored subscription. Deploy with:
//
//   supabase functions deploy send-nudge-push
//
// Required secrets (set via `supabase secrets set ...`):
//   VAPID_PUBLIC_KEY   - same key exposed to the client as VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  - keep server-side only
//   VAPID_SUBJECT      - a mailto: or https: contact URL
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - provided automatically in the
//                        Supabase Edge runtime
//
// Generate a VAPID key pair once with: `npx web-push generate-vapid-keys`.
//
// Invoke with an optional JSON body: { "ongoing": true, "name": "Build report" }.
// A scheduler (e.g. a cron trigger) would call this during shift hours; the
// shift-hours / interval decision can live here or in the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

Deno.serve(async (req) => {
  const { ongoing = true, name = "" } = await req.json().catch(() => ({}));

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:you@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription");
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({ ongoing, name });

  const results = await Promise.allSettled(
    (subs ?? []).map((row) =>
      webpush.sendNotification(row.subscription, payload).catch(async (err) => {
        // Prune subscriptions the push service has retired.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ sent, total: results.length });
});

// Supabase Edge Function: generate an end-of-day report from today's work
// entries by calling the Anthropic (Claude) API server-side, so the API key
// never reaches the browser. Deploy with:
//
//   supabase functions deploy generate-eod-report
//
// Required secret:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body: { date: string, entries: [{ name, start, end, status }] }
// Response: { report: string }   (the draft — the app reviews/sends manually)

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.69.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { date, entries } = await req.json();
    const lines = (entries ?? [])
      .map(
        (e: { start: string; end: string; name: string; status: string }) =>
          `- ${e.start}–${e.end} · ${e.name}${e.status === "ongoing" ? " (ongoing)" : ""}`
      )
      .join("\n");

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "You write concise end-of-day work reports for a status email. Plain, professional language. No preamble, no sign-off, no invented details.",
      messages: [
        {
          role: "user",
          content:
            `Here is a list of timestamped work entries from today's shift (${date}, times in EST):\n\n` +
            `${lines}\n\n` +
            "Write a concise end-of-day report grouped by task, in plain professional language suitable for a status email. " +
            "Call out anything still marked ongoing as 'in progress' or blocked. " +
            "Keep it brief — a paragraph or short bullet list, not a transcript of every entry.",
        },
      ],
    });

    const report = message.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();

    return new Response(JSON.stringify({ report }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "@supabase/supabase-js";

// Supabase is configured via environment variables (see .env.example).
// When they are absent, the app falls back to local storage so it stays
// fully clickable without a backend — see lib/entries.js.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;

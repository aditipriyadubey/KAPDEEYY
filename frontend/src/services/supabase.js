import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when both public Supabase values are set. Otherwise the app runs in demo mode. */
export const authConfigured = Boolean(url && anonKey);

// Only the public anon key lives in the browser. The service-role key never does.
export const supabase = authConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

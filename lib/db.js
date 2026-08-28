import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL || "https://gvazpqznosqpzmuxcbip.supabase.co";
export const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YXpwcXpub3NxcHptdXhjYmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzUxODEsImV4cCI6MjEwMzQxMTE4MX0.61kM-AhFMFNyVobYrSF9D6iIWGnXvrhUSrQ2RKKZpEY";
export const TAX_RATE = 0.0;
export const LOYALTY_RATE = 0.10;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); }
    });
  });
}

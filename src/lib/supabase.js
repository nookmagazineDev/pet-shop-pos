import { createClient } from "@supabase/supabase-js";

// Which backend the app talks to. "sheets" switches back to the old
// Google Apps Script API (set VITE_BACKEND=sheets in Vercel and redeploy).
export const BACKEND = import.meta.env.VITE_BACKEND || "supabase";
export const USE_SUPABASE = BACKEND !== "sheets";

// The project URL and publishable key are public by design: what a signed-in
// user may read or change is enforced by Row Level Security in the database.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xtnwlrcrwarrdyjywvwr.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e6iUB5TbbaFzwcJ-8JH1UQ_tN9YUXwg";

// Staff sign in with a username; Supabase Auth needs an e-mail, so each
// username maps to <username>@<STAFF_EMAIL_DOMAIN> (same rule as
// app.staff_email() in supabase/migrations/0003_api_functions.sql).
export const STAFF_EMAIL_DOMAIN = "staff.mamameepetshop.app";
export const staffEmail = (username) => `${String(username || "").trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;

export const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        // same lifetime as the old "pos_user" entry: closing the tab signs out
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

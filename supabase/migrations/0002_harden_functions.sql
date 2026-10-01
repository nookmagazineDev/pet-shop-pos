-- ============================================================
-- Fixes from the Supabase security advisor after 0001.
-- ============================================================

-- Pin search_path so a caller can't shadow tables or crypt()/gen_salt()
-- (pgcrypto lives in the "extensions" schema on Supabase).
alter function max_doc_seq(text)            set search_path = public, extensions;
alter function next_doc_number(text)        set search_path = public, extensions;
alter function sync_document_counters()     set search_path = public, extensions;
alter function adjust_customer_credits(text, numeric, text, text, text, text, text)
                                            set search_path = public, extensions;
alter function adjust_customer_points(text, numeric, text, text, text, text)
                                            set search_path = public, extensions;
alter function process_checkout(jsonb)      set search_path = public, extensions;
alter function hash_existing_passwords()    set search_path = public, extensions;
alter function login_user(text, text)       set search_path = public, extensions;

-- One-off admin task: run from the SQL Editor only, never via the API.
-- login_user stays callable by anon on purpose (it is the login step).
revoke execute on function hash_existing_passwords() from public, anon, authenticated;

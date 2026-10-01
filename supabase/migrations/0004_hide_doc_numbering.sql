-- ============================================================
-- Document numbers must run without gaps (Revenue Department rule), so
-- staff must not be able to call next_doc_number() over the REST API and
-- burn numbers. Move it (and its helper) out of the exposed "public"
-- schema; the functions that issue documents look in "app" too.
-- ============================================================
alter function public.next_doc_number(text) set schema app;
alter function public.max_doc_seq(text) set schema app;

alter function app.next_doc_number(text)          set search_path = public, app, extensions;
alter function public.process_checkout(jsonb)     set search_path = public, app, extensions;
alter function public.api_savetaxinvoice(jsonb)   set search_path = public, app, extensions;
alter function public.api_purchasepackage(jsonb)  set search_path = public, app, extensions;

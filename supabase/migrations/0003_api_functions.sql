-- ============================================================
-- PET SHOP POS — API layer that replaces backend/Code.gs
-- ============================================================
-- Every doPost action of Code.gs becomes public.api_<action>(payload jsonb)
-- returning the same JSON shape, so src/api.js can call
--   supabase.rpc('api_<action>', { payload })
-- and the pages keep working unchanged.
--
-- Differences from Code.gs (deliberate):
--  * Each action runs in one transaction: a failure part-way (e.g. an
--    unknown barcode in receiveGoods) no longer leaves half the rows written.
--  * The actor comes from the signed-in Supabase user, not from the
--    client-supplied payload._actor.
--  * Stock is changed with atomic UPDATEs, so repeated cart lines and
--    concurrent sales add up instead of overwriting each other.
--  * Auto-saving a customer during a purchase no longer blanks the
--    phone number when none was entered.
--  * importProducts updates a barcode that appears twice in one file
--    instead of creating a duplicate product.
--  * Login uses Supabase Auth (see api_me and the user-admin functions).
-- ============================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

alter table "Users" add column if not exists "AuthUserID" uuid unique;

-- e-mail used for Supabase Auth: <username>@<domain>; the login page
-- builds the same address from the username the staff types.
create or replace function app.staff_email(p_username text)
returns text language sql immutable as $$
  select lower(trim(p_username)) || '@staff.mamameepetshop.app'
$$;

-- ------------------------------------------------------------
-- JS-compatible value helpers
-- ------------------------------------------------------------

-- Date → text exactly as Apps Script serialises a Date cell
create or replace function app.iso(t timestamptz)
returns text language sql immutable as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create or replace function app.ms()
returns bigint language sql volatile as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- parseFloat(v) || 0
create or replace function app.num(v jsonb)
returns numeric language plpgsql immutable as $$
declare m text;
begin
  if v is null then return 0; end if;
  case jsonb_typeof(v)
    when 'number' then return (v #>> '{}')::numeric;
    when 'string' then
      m := substring(v #>> '{}' from '^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)');
      return coalesce(m::numeric, 0);
    else return 0;
  end case;
exception when others then return 0;
end $$;

-- parseInt(v) || 0
create or replace function app.int(v jsonb)
returns numeric language plpgsql immutable as $$
declare m text;
begin
  if v is null then return 0; end if;
  case jsonb_typeof(v)
    when 'number' then return trunc((v #>> '{}')::numeric);
    when 'string' then
      m := substring(v #>> '{}' from '^\s*([-+]?\d+)');
      return coalesce(m::numeric, 0);
    else return 0;
  end case;
exception when others then return 0;
end $$;

-- JS truthiness
create or replace function app.truthy(v jsonb)
returns boolean language sql immutable as $$
  select case
    when v is null then false
    when jsonb_typeof(v) = 'null' then false
    when jsonb_typeof(v) = 'boolean' then (v #>> '{}')::boolean
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric <> 0
    when jsonb_typeof(v) = 'string' then (v #>> '{}') <> ''
    else true
  end
$$;

-- String(v || "")
create or replace function app.str(v jsonb)
returns text language sql immutable as $$
  select case when app.truthy(v) then
    case when jsonb_typeof(v) in ('object', 'array') then v::text else v #>> '{}' end
  else '' end
$$;

-- String(v): undefined → 'undefined', null → 'null'
create or replace function app.jstr(v jsonb)
returns text language sql immutable as $$
  select case
    when v is null then 'undefined'
    when jsonb_typeof(v) = 'null' then 'null'
    when jsonb_typeof(v) in ('object', 'array') then v::text
    else v #>> '{}'
  end
$$;

-- value written by sheet.setValue(v): empty → NULL, booleans as TRUE/FALSE
create or replace function app.txt(v jsonb)
returns text language sql immutable as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then null
    when jsonb_typeof(v) = 'boolean' then upper(v #>> '{}')
    when jsonb_typeof(v) in ('object', 'array') then v::text
    else nullif(v #>> '{}', '')
  end
$$;

-- Google Sheets turns a typed "YYYY-MM-DD" into a date at Bangkok midnight,
-- which the old API returned as an ISO string; keep new rows in that format.
create or replace function app.date_txt(v jsonb)
returns text language plpgsql immutable as $$
declare s text := app.txt(v);
begin
  if s ~ '^\d{4}-\d{2}-\d{2}$' then
    return app.iso((s::date)::timestamp at time zone 'Asia/Bangkok');
  end if;
  return s;
exception when others then return s;
end $$;

-- new Date(text) as V8 parses it (NULL when invalid)
create or replace function app.js_date(s text)
returns timestamptz language plpgsql immutable as $$
begin
  if s is null or trim(s) = '' then return null; end if;
  s := trim(s);
  if s ~ '^\d{4}-\d{2}-\d{2}$' then
    return (s::date)::timestamp at time zone 'UTC';            -- date-only ISO = UTC
  elsif s ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$' then
    return s::timestamp at time zone 'Asia/Bangkok';           -- no zone = local
  end if;
  return s::timestamptz;
exception when others then return null;
end $$;

-- Number → text the way JS prints it (no trailing zeros)
create or replace function app.jsnum(n numeric)
returns text language sql immutable as $$
  select case when n is null then 'NaN'
              when n = trunc(n) then trunc(n)::text
              else rtrim(rtrim(n::text, '0'), '.') end
$$;

-- Number.prototype.toLocaleString() (en-US, up to 3 decimals)
create or replace function app.locale_num(n numeric)
returns text language sql immutable as $$
  select rtrim(rtrim(to_char(round(n, 3), 'FM999,999,999,999,990.999'), '0'), '.')
$$;

create or replace function app.money(v jsonb)
returns numeric language sql immutable as $$
  select round(app.num(v), 2)
$$;

-- ------------------------------------------------------------
-- Signed-in staff
-- ------------------------------------------------------------
create or replace function app.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "Users"
     where "AuthUserID" = auth.uid()
       and upper(coalesce("IsActive", 'TRUE')) = 'TRUE'
  )
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "Users"
     where "AuthUserID" = auth.uid()
       and upper(coalesce("IsActive", 'TRUE')) = 'TRUE'
       and "Role" = 'admin'
  )
$$;

-- every api_* function starts with this (SECURITY INVOKER on purpose:
-- current_user is the caller's role)
create or replace function app.require_user()
returns void language plpgsql stable as $$
begin
  if current_user = 'anon' then
    raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '28000';
  end if;
  if current_user = 'authenticated' and not app.is_active_user() then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์ใช้งาน หรือถูกระงับการใช้งาน' using errcode = '28000';
  end if;
end $$;

-- { userId, username, displayName, role } of the caller. Outside a user
-- session (SQL editor, tests) it falls back to payload._actor.
create or replace function app.actor(payload jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('userId', u."UserID", 'username', u."Username",
                               'displayName', u."DisplayName", 'role', u."Role")
       from "Users" u where u."AuthUserID" = auth.uid() order by u.id limit 1),
    case when auth.uid() is null and jsonb_typeof(payload -> '_actor') = 'object'
         then payload -> '_actor' end)
$$;

-- payload._actor ? payload._actor.username : "System"
create or replace function app.actor_name(payload jsonb)
returns text language sql stable as $$
  select case when app.actor(payload) is null then 'System'
              else coalesce(app.actor(payload) ->> 'username', '') end
$$;

-- logActivity(module, action, referenceId, actor)
create or replace function app.log(p_module text, p_action text, p_ref text, p_actor jsonb)
returns void language sql as $$
  insert into "ActivityLog" ("Timestamp", "User", "Role", "Module", "Action", "ReferenceID", "Details")
  values (
    now(),
    case when p_actor is null then 'ระบบ (system)'
         else app.jstr(p_actor -> 'displayName') || ' (' || app.jstr(p_actor -> 'username') || ')' end,
    case when p_actor is null then 'system' else p_actor ->> 'role' end,
    p_module, p_action, coalesce(nullif(p_ref, ''), 'N/A'), null)
$$;

-- "PREFIX" + epoch ms, bumped until unused in table.column
create or replace function app.new_id(p_prefix text, p_table text, p_col text, p_suffix text default '')
returns text language plpgsql volatile as $$
declare
  v_ms bigint := app.ms();
  v_id text;
  v_taken boolean;
begin
  loop
    v_id := p_prefix || v_ms || p_suffix;
    execute format('select exists (select 1 from public.%I where %I = $1)', p_table, p_col)
      into v_taken using v_id;
    exit when not v_taken;
    v_ms := v_ms + 1;
  end loop;
  return v_id;
end $$;

-- _resolveVatBreakdown(): NonVat + Vatable + VAT = Total
create or replace function app.vat_breakdown(
  p_total jsonb, p_tax jsonb, p_vatable jsonb, p_gross jsonb, p_discount jsonb,
  out total numeric, out vat numeric, out vatable numeric, out non_vat numeric, out gross numeric)
language plpgsql immutable as $$
begin
  total := app.money(p_total);
  vat := app.money(p_tax);
  vatable := case
    when p_vatable is not null and jsonb_typeof(p_vatable) <> 'null' then app.money(p_vatable)
    when vat > 0 then round(vat * 100 / 7, 2)
    else 0 end;
  non_vat := round(total - vatable - vat, 2);
  if non_vat < 0 then
    non_vat := 0;
    vatable := round(total - vat, 2);
  end if;
  gross := case
    when p_gross is null or jsonb_typeof(p_gross) = 'null' then round(total + app.money(p_discount), 2)
    else app.money(p_gross) end;
end $$;

-- ------------------------------------------------------------
-- Loyalty (mirror _adjustCustomerPoints / _adjustCustomerCredits)
-- ------------------------------------------------------------
create or replace function app.adjust_points(
  p_customer text, p_delta numeric, p_type text, p_reference text,
  p_order_id text, p_actor text, p_expiry text default null)
returns numeric language plpgsql as $$
declare
  v_id bigint;
  v_balance numeric;
begin
  select id into v_id from "Customers"
   where lower(trim(coalesce("Name", ''))) = lower(trim(p_customer))
   order by id limit 1 for update;

  if found then
    update "Customers"
       set "Points" = greatest(0, coalesce("Points", 0) + p_delta),
           "PointsExpiry" = coalesce(p_expiry, "PointsExpiry"),
           "UpdatedAt" = now(),
           "PointsUpdatedAt" = now()
     where id = v_id
    returning "Points" into v_balance;
  else
    v_balance := greatest(0, p_delta);
    insert into "Customers" ("CustomerID", "Name", "Points", "CreatedAt", "UpdatedAt", "PointsUpdatedAt")
    values (app.new_id('CUST-', 'Customers', 'CustomerID'), p_customer, v_balance, now(), now(), now());
  end if;

  insert into "PointsHistory" ("HistoryID", "CustomerName", "Date", "Type", "Points", "Balance", "Reference", "OrderID", "Actor")
  values ('PH-' || app.ms(), p_customer, now(), p_type, abs(p_delta), v_balance,
          nullif(p_reference, ''), nullif(p_order_id, ''), coalesce(nullif(p_actor, ''), 'System'));
  return v_balance;
end $$;

create or replace function app.adjust_credits(
  p_customer text, p_delta numeric, p_type text, p_reference text,
  p_order_id text, p_actor text, p_expiry text default null)
returns numeric language plpgsql as $$
declare
  v_id bigint;
  v_balance numeric;
begin
  select id into v_id from "Customers"
   where lower(trim(coalesce("Name", ''))) = lower(trim(p_customer))
   order by id limit 1 for update;

  if found then
    update "Customers"
       set "Credits" = greatest(0, coalesce("Credits", 0) + p_delta),
           "CreditsExpiry" = coalesce(p_expiry, "CreditsExpiry"),
           "UpdatedAt" = now()
     where id = v_id
    returning "Credits" into v_balance;
  else
    v_balance := greatest(0, p_delta);
    insert into "Customers" ("CustomerID", "Name", "Credits", "Points", "CreatedAt", "UpdatedAt")
    values (app.new_id('CUST-', 'Customers', 'CustomerID'), p_customer, v_balance, 0, now(), now());
  end if;

  insert into "CreditsHistory" ("HistoryID", "CustomerName", "Date", "Type", "Credits", "Balance", "Reference", "OrderID", "Actor")
  values ('CH-' || app.ms(), p_customer, now(), p_type, abs(p_delta), v_balance,
          nullif(p_reference, ''), nullif(p_order_id, ''), coalesce(nullif(p_actor, ''), 'System'));
  return v_balance;
end $$;

-- saveCustomer(); p_actor NULL = called internally (logged as system)
create or replace function app.save_customer(payload jsonb, p_actor jsonb)
returns jsonb language plpgsql as $$
declare
  v_id bigint;
begin
  if app.truthy(payload -> 'customerId') then
    select id into v_id from "Customers"
     where trim(coalesce("CustomerID", '')) = trim(app.jstr(payload -> 'customerId'))
     order by id limit 1;
  else
    select id into v_id from "Customers"
     where trim(coalesce("Name", '')) = trim(app.str(payload -> 'name'))
     order by id limit 1;
  end if;

  if v_id is not null then
    update "Customers" set
      "Name"            = case when payload ? 'name' then coalesce(app.txt(payload -> 'name'), '') else "Name" end,
      "Phone"           = case when payload ? 'phone' then app.txt(payload -> 'phone') else "Phone" end,
      "TaxID"           = case when payload ? 'taxId' then app.txt(payload -> 'taxId') else "TaxID" end,
      "TaxAddress"      = case when payload ? 'taxAddress' then app.txt(payload -> 'taxAddress') else "TaxAddress" end,
      "Address"         = case when payload ? 'address' then app.txt(payload -> 'address') else "Address" end,
      "Points"          = case when payload ? 'points' then app.num(payload -> 'points') else "Points" end,
      "LastInvoiceID"   = case when app.truthy(payload -> 'lastInvoiceId') then app.txt(payload -> 'lastInvoiceId') else "LastInvoiceID" end,
      "LastInvoiceDate" = case when app.truthy(payload -> 'lastInvoiceDate') then app.date_txt(payload -> 'lastInvoiceDate') else "LastInvoiceDate" end,
      "Email"           = case when payload ? 'email' then app.txt(payload -> 'email') else "Email" end,
      "LineID"          = case when payload ? 'lineId' then app.txt(payload -> 'lineId') else "LineID" end,
      "Notes"           = case when payload ? 'notes' then app.txt(payload -> 'notes') else "Notes" end,
      "Birthday"        = case when payload ? 'birthday' then app.date_txt(payload -> 'birthday') else "Birthday" end,
      "UpdatedAt"       = now()
    where id = v_id;
  else
    insert into "Customers" ("CustomerID", "Name", "Phone", "TaxID", "TaxAddress", "Address", "Points", "Credits",
                             "LastInvoiceID", "LastInvoiceDate", "CreatedAt", "UpdatedAt", "PointsUpdatedAt",
                             "Email", "LineID", "Notes", "Birthday")
    values (app.new_id('CUST-', 'Customers', 'CustomerID'), app.str(payload -> 'name'),
            app.txt(payload -> 'phone'), app.txt(payload -> 'taxId'), app.txt(payload -> 'taxAddress'),
            app.txt(payload -> 'address'), app.num(payload -> 'points'), null,
            nullif(app.str(payload -> 'lastInvoiceId'), ''), app.date_txt(payload -> 'lastInvoiceDate'),
            now(), now(), now(),
            app.txt(payload -> 'email'), app.txt(payload -> 'lineId'), app.txt(payload -> 'notes'),
            app.date_txt(payload -> 'birthday'));
  end if;

  perform app.log('Members', 'Save Customer',
                  coalesce(nullif(app.str(payload -> 'name'), ''), app.str(payload -> 'customerId')), p_actor);
  return jsonb_build_object('success', true, 'message', 'Customer saved');
end $$;

-- issueCoupon()
create or replace function app.issue_coupon(
  p_customer text, p_coupon_id text, p_quantity jsonb, p_price jsonb, p_actor jsonb)
returns jsonb language plpgsql as $$
declare
  c record;
  v_qty int;
  v_days int;
  v_base bigint;
  v_first text;
  v_id text;
  q int;
begin
  if p_customer = '' or p_coupon_id = '' then
    return jsonb_build_object('error', 'ข้อมูลไม่ครบ');
  end if;
  select * into c from "Coupons" where trim(coalesce("CouponID", '')) = p_coupon_id order by id limit 1;
  if not found then return jsonb_build_object('error', 'ไม่พบคูปอง'); end if;

  v_days := trunc(coalesce(nullif(c."ExpiryDays", 0), 365));
  v_qty := greatest(1, least(50, coalesce(nullif(app.int(p_quantity), 0), 1)::int));
  v_base := app.ms();
  while exists (select 1 from "CustomerCoupons" where "ID" like 'CC-' || v_base || '-%') loop
    v_base := v_base + 1;
  end loop;

  for q in 0 .. v_qty - 1 loop
    v_id := 'CC-' || v_base || '-' || q;
    v_first := coalesce(v_first, v_id);
    insert into "CustomerCoupons" ("ID", "CustomerName", "CouponID", "CouponName", "Type", "Value",
                                   "MinOrderAmount", "Price", "Status", "IssuedAt", "ExpiryDate",
                                   "UsedAt", "OrderID", "IssuedBy", "FreeItemBarcode", "FreeItemName")
    values (v_id, p_customer, p_coupon_id, c."Name", c."Type", c."Value", c."MinOrderAmount",
            app.num(p_price), 'ACTIVE', now(), app.iso(now() + make_interval(days => v_days)),
            null, null, coalesce(p_actor ->> 'username', 'System'),
            nullif(trim(coalesce(c."FreeItemBarcode", '')), ''), nullif(trim(coalesce(c."FreeItemName", '')), ''));
  end loop;

  perform app.log('Coupon', 'Issue Coupon x' || v_qty, v_first, p_actor);
  return jsonb_build_object('success', true, 'couponInstanceId', v_first, 'issuedCount', v_qty);
end $$;

-- FREE_ITEM coupons given as a package reward
create or replace function app.issue_free_items(
  p_customer text, p_coupon_ref text, p_barcode text, p_item_name text,
  p_qty int, p_expiry_days int, p_actor text)
returns jsonb language plpgsql as $$
declare
  v_base bigint := app.ms();
  v_ids jsonb := '[]';
  v_id text;
  qi int;
begin
  while exists (select 1 from "CustomerCoupons" where "ID" like 'CC-FREE-' || v_base || '-%') loop
    v_base := v_base + 1;
  end loop;
  for qi in 0 .. p_qty - 1 loop
    v_id := 'CC-FREE-' || v_base || '-' || qi;
    insert into "CustomerCoupons" ("ID", "CustomerName", "CouponID", "CouponName", "Type", "Value",
                                   "MinOrderAmount", "Price", "Status", "IssuedAt", "ExpiryDate",
                                   "UsedAt", "OrderID", "IssuedBy", "FreeItemBarcode", "FreeItemName")
    values (v_id, p_customer, p_coupon_ref, 'ของแถม: ' || p_item_name, 'FREE_ITEM', 0, 0, 0, 'ACTIVE',
            now(), app.iso(now() + make_interval(days => p_expiry_days)), null, null, p_actor,
            p_barcode, p_item_name);
    v_ids := v_ids || to_jsonb(v_id);
  end loop;
  return v_ids;
end $$;

-- package reward → coupon or FREE_ITEM coupons; returns rewardIssued
create or replace function app.issue_package_reward(
  p_customer text, p_reward_type text, p_reward_ref text, p_reward_qty int, p_reward_name text,
  p_expiry_days int, p_coupon_ref text, p_actor jsonb)
returns jsonb language plpgsql as $$
declare
  c record;
  v_item text;
  v_ids jsonb;
begin
  if p_reward_type = 'COUPON' and p_reward_ref <> '' then
    select * into c from "Coupons"
     where trim(coalesce("CouponID", '')) = p_reward_ref
        or lower(trim(coalesce("Name", ''))) = lower(p_reward_ref)
     order by id limit 1;
    if found then
      perform app.issue_coupon(p_customer, trim(c."CouponID"), to_jsonb(p_reward_qty), '0', p_actor);
      return jsonb_build_object('type', 'COUPON', 'name', c."Name", 'qty', p_reward_qty);
    end if;
  elsif p_reward_type = 'ITEM' and p_reward_ref <> '' then
    v_item := coalesce(nullif(p_reward_name, ''), p_reward_ref);
    if v_item = p_reward_ref then
      select coalesce(nullif(trim("Name"), ''), p_reward_ref) into v_item
        from "Products" where trim(coalesce("Barcode", '')) = p_reward_ref order by id limit 1;
      v_item := coalesce(v_item, p_reward_ref);
    end if;
    v_ids := app.issue_free_items(p_customer, p_coupon_ref, p_reward_ref, v_item, p_reward_qty,
                                  p_expiry_days, coalesce(p_actor ->> 'username', 'System'));
    return jsonb_build_object('type', 'ITEM', 'barcode', p_reward_ref, 'name', v_item,
                              'qty', p_reward_qty, 'couponIds', v_ids);
  end if;
  return null;
end $$;

-- ------------------------------------------------------------
-- Document numbers: next_doc_number writes document_counters, which
-- staff must not be able to edit directly.
-- ------------------------------------------------------------
alter function next_doc_number(text) security definer;
alter function max_doc_seq(text) security definer;

-- ============================================================
-- Sales
-- ============================================================
create or replace function process_checkout(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_actor_obj  jsonb := app.actor(payload);
  v_actor      text := app.actor_name(payload);
  v_order_id   text;
  v_receipt_no text;
  v_tax_no     text := null;
  bd           record;
  v_cname      text := coalesce(nullif(app.str(payload -> 'customerName'), ''),
                                app.str(payload #> '{customerInfo,name}'),
                                '');
  v_item       jsonb;
  v_qty        numeric;
  v_barcode    text;
  v_name       text;
  v_row        bigint;
  v_credits    numeric := app.num(payload -> 'creditsUsed');
  v_points     numeric := app.num(payload -> 'pointsUsed');
  v_promo_pts  numeric := app.num(payload -> 'promoPoints');
  v_coupon_pts numeric := app.num(payload -> 'couponPoints');
begin
  if v_cname = '' then v_cname := app.str(payload #> '{customerInfo,customerName}'); end if;

  select * into bd from app.vat_breakdown(payload -> 'totalAmount', payload -> 'tax', payload -> 'vatableAmount',
                                          payload -> 'grossSubtotal', payload -> 'discount');

  -- next_doc_number locks this month's counter row until commit, so
  -- checkouts are serialized from here on.
  v_receipt_no := next_doc_number('TX');
  v_order_id := app.new_id('TX', 'Transactions', 'OrderID');

  if payload ->> 'receiptType' = 'ใบกำกับภาษี' then
    v_tax_no := next_doc_number('IN');
    insert into "TaxInvoices" (
      "TaxInvoiceNo", "Date", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID", "CustomerBranch",
      "TotalAmount", "TaxAmount", "VatableAmount", "NonVatAmount", "Status", "CancelNote", "IssuedBy"
    ) values (
      v_tax_no, now(), v_order_id,
      coalesce(nullif(app.str(payload #> '{customerInfo,name}'), ''), nullif(app.str(payload #> '{customerInfo,customerName}'), ''), '-'),
      coalesce(nullif(app.str(payload #> '{customerInfo,taxAddress}'), ''), nullif(app.str(payload #> '{customerInfo,address}'), ''),
               nullif(app.str(payload #> '{customerInfo,customerAddress}'), ''), '-'),
      coalesce(nullif(app.str(payload #> '{customerInfo,taxId}'), ''), nullif(app.str(payload #> '{customerInfo,customerTaxId}'), ''), '-'),
      coalesce(nullif(app.str(payload #> '{customerInfo,branch}'), ''), nullif(app.str(payload #> '{customerInfo,customerBranch}'), ''), 'สำนักงานใหญ่'),
      bd.total, bd.vat, bd.vatable, bd.non_vat, 'ACTIVE', null,
      nullif(coalesce(v_actor_obj ->> 'username', ''), '')
    );
  end if;

  insert into "Transactions" (
    "OrderID", "Date", "TotalAmount", "Tax", "PaymentMethod", "CartDetails",
    "CashReceived", "ChangeReturn", "ShopPlatform", "ReceiptType",
    "CustomerInfo", "DiscountAmount", "Username", "Status", "CancelNote", "TaxInvoiceNo", "ReceiptNo",
    "GrossSubtotal", "VatableAmount", "NonVatAmount"
  ) values (
    v_order_id, now(), bd.total, bd.vat, app.txt(payload -> 'paymentMethod'), payload -> 'cart',
    app.money(payload -> 'cashReceived'), app.money(payload -> 'changeReturn'),
    coalesce(nullif(app.str(payload -> 'shopPlatform'), ''), 'Store'),
    coalesce(nullif(app.str(payload -> 'receiptType'), ''), 'ใบเสร็จ'),
    case when app.truthy(payload -> 'customerInfo') then payload -> 'customerInfo' end,
    app.money(payload -> 'discount'),
    nullif(coalesce(v_actor_obj ->> 'username', ''), ''),
    'COMPLETED', null, v_tax_no, v_receipt_no,
    bd.gross, bd.vatable, bd.non_vat
  );

  -- Stock: Products (warehouse) always, StoreStock when the item is there
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'cart', '[]')) loop
    v_qty     := app.num(v_item -> 'qty');
    v_barcode := trim(app.str(v_item -> 'Barcode'));
    v_name    := trim(coalesce(nullif(app.str(v_item -> 'Name'), ''), app.str(v_item -> 'name')));
    if v_qty <= 0 then continue; end if;

    select id into v_row from "Products"
     where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
        or (v_barcode = '' and trim(coalesce("Name", '')) = v_name)
     order by id limit 1;
    if v_row is not null then
      update "Products" set "Quantity" = greatest(0, coalesce("Quantity", 0) - v_qty) where id = v_row;
    end if;

    v_row := null;
    select id into v_row from "StoreStock"
     where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
        or (v_barcode = '' and trim(coalesce("Name", '')) = v_name)
     order by id limit 1;
    if v_row is not null then
      update "StoreStock"
         set "Quantity" = greatest(0, coalesce("Quantity", 0) - v_qty), "UpdatedAt" = now()
       where id = v_row and coalesce("Quantity", 0) > 0;
    end if;
    v_row := null;
  end loop;

  if v_credits > 0 and v_cname <> '' then
    perform app.adjust_credits(v_cname, -v_credits, 'REDEEM', 'ชำระบิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_points > 0 and v_cname <> '' then
    perform app.adjust_points(v_cname, -v_points, 'REDEEM', 'ชำระบิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_promo_pts > 0 and v_cname <> '' then
    perform app.adjust_points(v_cname, v_promo_pts, 'PROMO_EARN', 'โปรโมชั่น บิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_coupon_pts > 0 and v_cname <> '' then
    perform app.adjust_points(v_cname, v_coupon_pts, 'COUPON_EARN', 'คูปองแต้ม บิล ' || v_order_id, v_order_id, v_actor);
  end if;

  perform app.log('POS/Online', 'Checkout', v_order_id, v_actor_obj);

  return jsonb_build_object(
    'success', true, 'orderId', v_order_id, 'receiptNo', v_receipt_no, 'taxInvoiceNo', v_tax_no,
    'date', app.iso(now()), 'vatableAmount', bd.vatable, 'nonVatAmount', bd.non_vat,
    'tax', bd.vat, 'totalAmount', bd.total
  );
end;
$$;

create or replace function api_checkout(payload jsonb)
returns jsonb language plpgsql as $$
begin
  perform app.require_user();
  return process_checkout(payload);
end $$;

create or replace function api_updateTransactionPayment(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_order text := trim(app.str(payload -> 'orderId'));
  v_method text := trim(app.str(payload -> 'paymentMethod'));
  v_id bigint;
begin
  perform app.require_user();
  if v_order = '' or v_method = '' then
    return jsonb_build_object('error', 'Missing orderId or paymentMethod');
  end if;
  select id into v_id from "Transactions" where trim("OrderID") = v_order order by id limit 1;
  if v_id is null then return jsonb_build_object('error', 'Order not found'); end if;
  update "Transactions" set "PaymentMethod" = v_method where id = v_id;
  perform app.log('POS/Online', 'Confirm Payment', v_order, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'Payment updated successfully');
end $$;

create or replace function api_cancelTransaction(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_order text := trim(app.str(payload -> 'orderId'));
  v_note text := trim(app.str(payload -> 'cancelNote'));
  tx record;
  v_item jsonb;
  v_barcode text;
  v_name text;
  v_qty numeric;
  v_row bigint;
  v_actor jsonb := app.actor(payload);
begin
  perform app.require_user();
  if v_order = '' then return jsonb_build_object('error', 'No Order ID provided'); end if;
  if v_note = '' then return jsonb_build_object('error', 'กรุณาระบุหมายเหตุการยกเลิก'); end if;

  select * into tx from "Transactions" where trim("OrderID") = v_order order by id limit 1 for update;
  if not found then return jsonb_build_object('error', 'ไม่พบข้อมูลออเดอร์นี้'); end if;
  if coalesce(tx."Status", '') = 'CANCELLED' then
    return jsonb_build_object('error', 'ออเดอร์นี้ถูกยกเลิกไปแล้ว');
  end if;

  update "Transactions" set "Status" = 'CANCELLED', "CancelNote" = v_note where id = tx.id;

  -- keep the tax invoice number as evidence; mark it cancelled
  update "TaxInvoices" set "Status" = 'CANCELLED', "CancelNote" = v_note
   where id = (select id from "TaxInvoices" where trim(coalesce("OrderID", '')) = v_order order by id limit 1);

  if jsonb_typeof(tx."CartDetails") = 'array' then
    for v_item in select * from jsonb_array_elements(tx."CartDetails") loop
      v_barcode := trim(coalesce(nullif(app.str(v_item -> 'Barcode'), ''), app.str(v_item -> 'barcode')));
      v_name := trim(coalesce(nullif(app.str(v_item -> 'Name'), ''), app.str(v_item -> 'name')));
      v_qty := app.num(v_item -> 'qty');
      continue when v_qty <= 0;

      select id into v_row from "StoreStock"
       where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
          or (v_barcode = '' and trim(coalesce("Name", '')) = v_name)
       order by id limit 1;
      if v_row is not null then
        update "StoreStock" set "Quantity" = coalesce("Quantity", 0) + v_qty, "UpdatedAt" = now() where id = v_row;
      end if;
      v_row := null;

      select id into v_row from "Products"
       where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
          or (v_barcode = '' and trim(coalesce("Name", '')) = v_name)
       order by id limit 1;
      if v_row is not null then
        update "Products" set "Quantity" = coalesce("Quantity", 0) + v_qty where id = v_row;
      end if;
      v_row := null;

      insert into "StockMovements" ("Date", "Barcode", "Name", "Quantity", "FromLocation", "ToLocation", "MovedBy")
      values (now(), nullif(v_barcode, ''), nullif(v_name, ''), v_qty, 'VOID (Order Cancelled)', 'คลังสินค้า',
              coalesce(v_actor ->> 'username', 'System'));
    end loop;
  end if;

  perform app.log('POS', 'Cancel Order', v_order, v_actor);
  return jsonb_build_object('success', true, 'message', 'ยกเลิกออเดอร์และคืนสต็อกสำเร็จ');
end $$;

create or replace function api_processReturn(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_order text := trim(app.str(payload -> 'orderId'));
  v_note text := trim(app.str(payload -> 'cancelNote'));
  v_items jsonb := case when jsonb_typeof(payload -> 'returnedItems') = 'array' then payload -> 'returnedItems' else '[]' end;
  v_full boolean := (payload -> 'isFullCancel') = 'true'::jsonb;
  v_actor jsonb := app.actor(payload);
  v_actor_name text := app.actor_name(payload);
  v_item jsonb;
  v_barcode text;
  v_name text;
  v_qty numeric;
  v_price numeric;
  v_total numeric := 0;
  v_row bigint;
begin
  perform app.require_user();
  if v_order = '' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('error', 'ข้อมูลการคืนไม่ครบถ้วน');
  end if;
  if v_note = '' then return jsonb_build_object('error', 'กรุณาระบุหมายเหตุการคืนสินค้า'); end if;

  update "Transactions"
     set "Status" = case when v_full then 'CANCELLED' else 'PARTIAL_RETURN' end,
         "CancelNote" = case when trim(coalesce("CancelNote", '')) <> '' then trim("CancelNote") || ' | ' || v_note else v_note end
   where id = (select id from "Transactions" where trim("OrderID") = v_order order by id limit 1);

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_barcode := trim(app.str(v_item -> 'barcode'));
    v_name := trim(app.str(v_item -> 'name'));
    v_qty := app.num(v_item -> 'returnQty');
    v_price := app.num(v_item -> 'price');
    continue when v_qty <= 0;
    v_total := v_total + v_qty * v_price;

    insert into "Returns" ("Timestamp", "OrderID", "Barcode", "ProductName", "ReturnQty", "RefundAmount", "ReturnNote", "ActionBy")
    values (now(), v_order, nullif(v_barcode, ''), nullif(v_name, ''), v_qty, v_qty * v_price, v_note, v_actor_name);

    select id into v_row from "StoreStock"
     where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
        or trim(coalesce("Name", '')) = v_name
     order by id limit 1;
    if v_row is not null then
      update "StoreStock" set "Quantity" = coalesce("Quantity", 0) + v_qty, "UpdatedAt" = now() where id = v_row;
    end if;
    v_row := null;

    insert into "StockMovements" ("Date", "Barcode", "Name", "Quantity", "FromLocation", "ToLocation", "MovedBy")
    values (now(), nullif(v_barcode, ''), nullif(v_name, ''), v_qty, 'Returned (Order ' || v_order || ')', 'Store', v_actor_name);
  end loop;

  perform app.log('POS', case when v_full then 'Cancel Order' else 'Partial Return' end, v_order, v_actor);
  return jsonb_build_object('success', true,
    'message', 'ทำการคืนสินค้าเรียบร้อยแล้ว (ยอดคืนเงิน ฿' || app.jsnum(v_total) || ')');
end $$;

create or replace function api_saveTaxInvoice(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_order text := trim(app.str(payload -> 'orderId'));
  v_name text := trim(coalesce(nullif(app.str(payload #> '{customerInfo,name}'), ''), app.str(payload #> '{customerInfo,customerName}')));
  v_addr text := trim(coalesce(nullif(app.str(payload #> '{customerInfo,taxAddress}'), ''), nullif(app.str(payload #> '{customerInfo,address}'), ''),
                               app.str(payload #> '{customerInfo,customerAddress}')));
  v_tax_id text := regexp_replace(coalesce(nullif(app.str(payload #> '{customerInfo,taxId}'), ''), app.str(payload #> '{customerInfo,customerTaxId}')), '\D', '', 'g');
  v_existing text;
  tx record;
  v_no text;
  bd record;
  v_actor jsonb := app.actor(payload);
begin
  perform app.require_user();
  if v_order = '' then return jsonb_build_object('error', 'Missing orderId'); end if;
  if v_name = '' or v_addr = '' or length(v_tax_id) <> 13 then
    return jsonb_build_object('error', 'ใบกำกับภาษีเต็มรูปต้องระบุชื่อ ที่อยู่ และเลขประจำตัวผู้เสียภาษี 13 หลักของผู้ซื้อ');
  end if;

  -- lock the bill so two clicks can't both issue an invoice for it
  perform 1 from "Transactions" where trim("OrderID") = v_order for update;

  select "TaxInvoiceNo" into v_existing from "TaxInvoices"
   where trim(coalesce("OrderID", '')) = v_order order by id limit 1;
  if found then
    return jsonb_build_object('success', true, 'taxInvoiceNo', coalesce(v_existing, ''), 'message', 'ออกใบกำกับภาษีนี้ไปแล้ว');
  end if;

  select * into tx from "Transactions" where trim("OrderID") = v_order order by id limit 1 for update;
  if not found then return jsonb_build_object('error', 'ไม่พบบิลนี้ในระบบ'); end if;
  if trim(coalesce(tx."Status", '')) = 'CANCELLED' then
    return jsonb_build_object('error', 'บิลนี้ถูกยกเลิกแล้ว ไม่สามารถออกใบกำกับภาษีได้');
  end if;

  v_no := next_doc_number('IN');
  select * into bd from app.vat_breakdown(payload -> 'totalAmount', payload -> 'taxAmount', payload -> 'vatableAmount', null, null);

  insert into "TaxInvoices" ("TaxInvoiceNo", "Date", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID",
                             "CustomerBranch", "TotalAmount", "TaxAmount", "VatableAmount", "NonVatAmount",
                             "Status", "CancelNote", "IssuedBy")
  values (v_no, now(), v_order, v_name, v_addr, v_tax_id,
          trim(coalesce(nullif(app.str(payload #> '{customerInfo,branch}'), ''), nullif(app.str(payload #> '{customerInfo,customerBranch}'), ''), 'สำนักงานใหญ่')),
          bd.total, bd.vat, bd.vatable, bd.non_vat, 'ACTIVE', null, nullif(coalesce(v_actor ->> 'username', ''), ''));

  update "Transactions" set "TaxInvoiceNo" = v_no where id = tx.id;

  perform app.log('Accounting', 'Issue Tax Invoice', v_no, v_actor);
  return jsonb_build_object('success', true, 'taxInvoiceNo', v_no, 'date', app.iso(now()),
                            'message', 'ออกใบกำกับภาษีเรียบร้อยแล้ว');
end $$;

-- ============================================================
-- Inventory
-- ============================================================
create or replace function api_moveToStore(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_barcode text := trim(app.str(payload -> 'barcode'));
  v_qty numeric := app.num(payload -> 'quantity');
  v_loc text := app.str(payload -> 'storeLocation');
  v_name text := app.str(payload -> 'name');
  p record;
  v_store bigint;
begin
  perform app.require_user();
  if v_qty <= 0 then return jsonb_build_object('error', 'Invalid quantity'); end if;

  select id, coalesce("Quantity", 0) as qty into p from "Products"
   where trim(coalesce("Barcode", '')) = v_barcode order by id limit 1 for update;
  if not found then
    return jsonb_build_object('error', 'ไม่พบสินค้าในคลัง (Barcode: ' || v_barcode || ')');
  end if;
  if p.qty < v_qty then
    return jsonb_build_object('error', 'สต็อกคลังไม่พอ (มี ' || app.jsnum(p.qty) || ' ชิ้น แต่ต้องการย้าย ' || app.jsnum(v_qty) || ' ชิ้น)');
  end if;
  update "Products" set "Quantity" = p.qty - v_qty where id = p.id;

  select id into v_store from "StoreStock" where trim(coalesce("Barcode", '')) = v_barcode order by id limit 1;
  if v_store is not null then
    update "StoreStock"
       set "Quantity" = coalesce("Quantity", 0) + v_qty,
           "StoreLocation" = case when v_loc <> '' then v_loc else "StoreLocation" end,
           "UpdatedAt" = now()
     where id = v_store;
  else
    insert into "StoreStock" ("Barcode", "Name", "Quantity", "StoreLocation", "UpdatedAt", "LowStockThreshold")
    values (v_barcode, nullif(v_name, ''), v_qty, nullif(v_loc, ''), now(), 3);
  end if;

  insert into "StockMovements" ("Date", "Barcode", "Name", "Quantity", "FromLocation", "ToLocation", "MovedBy")
  values (now(), v_barcode, nullif(v_name, ''), v_qty, 'Warehouse', coalesce(nullif(v_loc, ''), 'Store'), 'System');

  if v_store is not null then
    perform app.log('Inventory', 'Move To Store', v_barcode, app.actor(payload));
    return jsonb_build_object('success', true, 'message', 'ย้ายสินค้าเข้าหน้าร้านเรียบร้อย');
  end if;
  perform app.log('Inventory', 'Move To Store (New)', v_barcode, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'ย้ายสินค้าเข้าหน้าร้าน (รายการใหม่) เรียบร้อย');
end $$;

create or replace function api_receiveGoods(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_items jsonb := case when jsonb_typeof(payload -> 'items') = 'array' then payload -> 'items' else '[]' end;
  v_company text := app.str(payload -> 'companyName');
  v_order_no text := app.str(payload -> 'orderNumber');
  v_phone text := app.str(payload -> 'supplierPhone');
  v_email text := app.str(payload -> 'supplierEmail');
  v_taxid text := app.str(payload -> 'supplierTaxId');
  v_actor text := app.actor_name(payload);
  s record;
  v_receipt text;
  v_total numeric := 0;
  v_item jsonb;
  v_barcode text;
  v_name text;
  v_qty numeric;
  v_cost numeric;
  p record;
  v_updated int := 0;
  v_missing text;
begin
  perform app.require_user();
  if jsonb_array_length(v_items) = 0 then return jsonb_build_object('error', 'No items provided'); end if;

  begin
    -- auto-save supplier
    if trim(v_company) <> '' then
      select * into s from "Suppliers"
       where lower(trim(coalesce("Name", ''))) = lower(trim(v_company)) order by id limit 1;
      if found then
        update "Suppliers" set
          "Phone" = case when v_phone <> '' then v_phone else "Phone" end,
          "Email" = case when v_email <> '' then v_email else "Email" end,
          "TaxID" = case when v_taxid <> '' then v_taxid else "TaxID" end
         where id = s.id;
        v_phone := coalesce(nullif(v_phone, ''), s."Phone", '');
        v_email := coalesce(nullif(v_email, ''), s."Email", '');
        v_taxid := coalesce(nullif(v_taxid, ''), s."TaxID", '');
      else
        insert into "Suppliers" ("SupplierID", "Name", "ContactPerson", "Phone", "Email", "Address", "TaxID", "CreatedAt")
        values (app.new_id('SUP-', 'Suppliers', 'SupplierID'), trim(v_company), nullif(app.str(payload -> 'contactPerson'), ''),
                nullif(v_phone, ''), nullif(v_email, ''), nullif(app.str(payload -> 'supplierAddress'), ''),
                nullif(v_taxid, ''), now());
      end if;
    end if;

    v_receipt := 'RCV-' || app.ms();
    select coalesce(sum(app.num(coalesce(nullif(e -> 'unitCost', '""'::jsonb), '0'))
                        * app.num(coalesce(nullif(e -> 'quantity', '""'::jsonb), '0'))), 0)
      into v_total from jsonb_array_elements(v_items) e;

    for v_item in select * from jsonb_array_elements(v_items) loop
      v_barcode := trim(app.str(v_item -> 'barcode'));
      v_name := trim(app.str(v_item -> 'productName'));
      v_qty := app.num(v_item -> 'quantity');
      v_cost := app.num(coalesce(nullif(v_item -> 'unitCost', '""'::jsonb), '0'));

      insert into "InventoryReceipts" ("Timestamp", "ReceiptID", "CompanyName", "OrderNumber", "Barcode", "ProductName",
                                       "Quantity", "Location", "LotNumber", "ExpiryDate", "ReceivingDate", "UnitCost",
                                       "TotalCost", "OrderTotalCost", "SupplierPhone", "SupplierEmail", "SupplierTaxID")
      values (now(), v_receipt, nullif(v_company, ''), nullif(v_order_no, ''), nullif(v_barcode, ''), nullif(v_name, ''),
              v_qty, nullif(app.str(v_item -> 'location'), ''), nullif(app.str(v_item -> 'lotNumber'), ''),
              app.date_txt(nullif(v_item -> 'expiryDate', 'false'::jsonb)), app.date_txt(nullif(v_item -> 'receivingDate', 'false'::jsonb)),
              v_cost, v_cost * v_qty, v_total, nullif(v_phone, ''), nullif(v_email, ''), nullif(v_taxid, ''));

      select id, coalesce("Quantity", 0) as qty, coalesce("CostPrice", 0) as cost into p from "Products"
       where (v_barcode <> '' and trim(coalesce("Barcode", '')) = v_barcode)
          or (v_barcode = '' and trim(coalesce("Name", '')) = v_name)
       order by id limit 1 for update;
      if not found then
        v_missing := app.jstr(v_item -> 'barcode');
        raise exception using errcode = 'RG404', message = 'missing product';
      end if;

      update "Products" set
        "Quantity" = p.qty + v_qty,
        "VatStatus" = case when app.truthy(v_item -> 'vatStatus') then app.txt(v_item -> 'vatStatus') else "VatStatus" end,
        "CostPrice" = case when app.truthy(v_item -> 'unitCost') and v_qty > 0 then
                        round(case when p.qty + v_qty > 0
                                   then (p.qty * p.cost + v_qty * app.num(v_item -> 'unitCost')) / (p.qty + v_qty)
                                   else app.num(v_item -> 'unitCost') end, 2)
                      else "CostPrice" end,
        "Category" = case when app.truthy(v_item -> 'category') then app.txt(v_item -> 'category') else "Category" end,
        "Location" = case when app.truthy(v_item -> 'location') then app.txt(v_item -> 'location') else "Location" end,
        "LotNumber" = case when app.truthy(v_item -> 'lotNumber') then app.txt(v_item -> 'lotNumber') else "LotNumber" end,
        "ExpiryDate" = case when app.truthy(v_item -> 'expiryDate') then app.date_txt(v_item -> 'expiryDate') else "ExpiryDate" end,
        "ReceivingDate" = case when app.truthy(v_item -> 'receivingDate') then app.date_txt(v_item -> 'receivingDate') else "ReceivingDate" end
       where id = p.id;

      insert into "StockMovements" ("Date", "Barcode", "Name", "Quantity", "FromLocation", "ToLocation", "MovedBy", "ReferenceNo")
      values (now(), nullif(v_barcode, ''), nullif(v_name, ''), v_qty,
              'ซัพพลายเออร์' || case when v_company <> '' then ': ' || v_company else '' end,
              'คลังสินค้า', v_actor,
              v_receipt || case when v_company <> '' then ' / ' || v_company else '' end
                        || case when v_order_no <> '' then ' / PO:' || v_order_no else '' end);
      v_updated := v_updated + 1;
    end loop;

    insert into "Expenses" ("Timestamp", "Date", "Description", "Category", "Amount", "ReceiptFileURL", "ItemsJSON")
    values (now(), app.iso(now()),
            'นำเข้าสินค้าจาก: ' || coalesce(nullif(v_company, ''), 'ไม่ระบุ') || ' (PO: ' || coalesce(nullif(v_order_no, ''), 'ไม่ระบุ') || ')',
            'ซื้อสินค้าเข้าคลัง', v_total, nullif(app.str(payload -> 'fileUrl'), ''), v_items);
  exception when sqlstate 'RG404' then
    -- nothing written: the whole receipt is rejected
    return jsonb_build_object('success', false,
      'error', 'ไม่พบสินค้าบาร์โค้ด ' || v_missing || ' ในคลัง กรุณาสร้างสินค้าก่อนรับเข้า');
  end;

  perform app.log('Inventory', 'Receive Goods', v_receipt, app.actor(payload));
  return jsonb_build_object('success', true,
    'message', 'Stock updated: ' || v_updated || ' items, Added: 0 items. Logged under Receipt ' || v_receipt);
end $$;

create or replace function api_saveSupplier(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_name text := trim(app.str(payload -> 'name'));
  v_id bigint;
  v_new text;
begin
  perform app.require_user();
  if v_name = '' then return jsonb_build_object('success', false, 'error', 'กรุณาระบุชื่อบริษัท'); end if;

  select id into v_id from "Suppliers" where lower(trim(coalesce("Name", ''))) = lower(v_name) order by id limit 1;
  if v_id is not null then
    update "Suppliers" set
      "ContactPerson" = case when payload ? 'contactPerson' then app.txt(payload -> 'contactPerson') else "ContactPerson" end,
      "Phone"   = case when payload ? 'phone' then app.txt(payload -> 'phone') else "Phone" end,
      "Email"   = case when payload ? 'email' then app.txt(payload -> 'email') else "Email" end,
      "Address" = case when payload ? 'address' then app.txt(payload -> 'address') else "Address" end,
      "TaxID"   = case when payload ? 'taxId' then app.txt(payload -> 'taxId') else "TaxID" end
     where id = v_id;
    return jsonb_build_object('success', true, 'message', 'อัปเดตข้อมูลผู้จำหน่ายเรียบร้อย');
  end if;

  v_new := app.new_id('SUP-', 'Suppliers', 'SupplierID');
  insert into "Suppliers" ("SupplierID", "Name", "ContactPerson", "Phone", "Email", "Address", "TaxID", "CreatedAt")
  values (v_new, v_name, nullif(app.str(payload -> 'contactPerson'), ''), nullif(app.str(payload -> 'phone'), ''),
          nullif(app.str(payload -> 'email'), ''), nullif(app.str(payload -> 'address'), ''),
          nullif(app.str(payload -> 'taxId'), ''), now());
  return jsonb_build_object('success', true, 'supplierId', v_new, 'message', 'บันทึกผู้จำหน่ายใหม่เรียบร้อย');
end $$;

create or replace function api_importProducts(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_item jsonb;
  v_idx int := 0;
  v_barcode text;
  v_id bigint;
  v_added int := 0;
  v_updated int := 0;
  v_errors jsonb := '[]';
begin
  perform app.require_user();
  for v_item in select * from jsonb_array_elements(case when jsonb_typeof(payload -> 'items') = 'array' then payload -> 'items' else '[]' end) loop
    v_idx := v_idx + 1;
    v_barcode := trim(app.str(v_item -> 'barcode'));
    if v_barcode = '' then
      v_errors := v_errors || to_jsonb('แถว ' || (v_idx + 1) || ': ไม่มีบาร์โค้ด'); continue;
    end if;
    if not app.truthy(v_item -> 'name') then
      v_errors := v_errors || to_jsonb('แถว ' || (v_idx + 1) || ': ไม่มีชื่อสินค้า'); continue;
    end if;

    v_id := null;
    select id into v_id from "Products" where trim(coalesce("Barcode", '')) = v_barcode order by id limit 1;
    if v_id is not null then
      -- don't touch Quantity / LotNumber / ExpiryDate / ImageURL
      update "Products" set
        "Name" = coalesce(app.txt(v_item -> 'name'), ''),
        "VatStatus" = coalesce(nullif(app.str(v_item -> 'vatStatus'), ''), 'VAT'),
        "CostPrice" = app.num(v_item -> 'costPrice'),
        "Price" = app.num(v_item -> 'price'),
        "WholesalePrice" = app.num(v_item -> 'wholesalePrice'),
        "ShopeePrice" = app.num(v_item -> 'shopeePrice'),
        "LazadaPrice" = app.num(v_item -> 'lazadaPrice'),
        "LinemanPrice" = app.num(v_item -> 'linemanPrice'),
        "Category" = case when app.truthy(v_item -> 'category') then app.txt(v_item -> 'category') else "Category" end,
        "Location" = case when app.truthy(v_item -> 'location') then app.txt(v_item -> 'location') else "Location" end,
        "LowStockThreshold" = coalesce(nullif(app.num(v_item -> 'lowStockThreshold'), 0), 5),
        "HasExpiry" = upper(coalesce(nullif(app.str(v_item -> 'hasExpiry'), ''), 'YES')),
        "EarnPoints" = upper(coalesce(nullif(app.str(v_item -> 'earnPoints'), ''), 'YES'))
       where id = v_id;
      v_updated := v_updated + 1;
    else
      insert into "Products" ("Barcode", "Name", "VatStatus", "CostPrice", "Price", "WholesalePrice", "ShopeePrice",
                              "LazadaPrice", "LinemanPrice", "Category", "Quantity", "Location", "LowStockThreshold",
                              "PackMultiplier", "HasExpiry", "PackMultiplier2", "PackMultiplier3", "EarnPoints")
      values (v_barcode, app.str(v_item -> 'name'), coalesce(nullif(app.str(v_item -> 'vatStatus'), ''), 'VAT'),
              app.num(v_item -> 'costPrice'), app.num(v_item -> 'price'), app.num(v_item -> 'wholesalePrice'),
              app.num(v_item -> 'shopeePrice'), app.num(v_item -> 'lazadaPrice'), app.num(v_item -> 'linemanPrice'),
              coalesce(nullif(app.str(v_item -> 'category'), ''), 'ทั่วไป'), 0, nullif(app.str(v_item -> 'location'), ''),
              coalesce(nullif(app.num(v_item -> 'lowStockThreshold'), 0), 5), 0,
              upper(coalesce(nullif(app.str(v_item -> 'hasExpiry'), ''), 'YES')), 0, 0,
              upper(coalesce(nullif(app.str(v_item -> 'earnPoints'), ''), 'YES')));
      v_added := v_added + 1;
    end if;
  end loop;

  perform app.log('Inventory', 'Import Products', 'Added:' || v_added || ' Updated:' || v_updated, app.actor(payload));
  return jsonb_build_object('success', true, 'added', v_added, 'updated', v_updated, 'errors', v_errors);
end $$;

create or replace function api_addProduct(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_barcode text := trim(app.str(payload -> 'barcode'));
begin
  perform app.require_user();
  if v_barcode = '' then return jsonb_build_object('success', false, 'error', 'บาร์โค้ดไม่สามารถเว้นว่างได้'); end if;
  if exists (select 1 from "Products" where trim(coalesce("Barcode", '')) = v_barcode) then
    return jsonb_build_object('success', false, 'error', 'สินค้านี้มีอยู่ในระบบแล้ว (บาร์โค้ดซ้ำ)');
  end if;

  insert into "Products" ("Barcode", "Name", "VatStatus", "CostPrice", "Price", "WholesalePrice", "ShopeePrice",
                          "LazadaPrice", "LinemanPrice", "Category", "Quantity", "LowStockThreshold", "PackBarcode",
                          "PackMultiplier", "HasExpiry", "AcceptedPayments", "PackBarcode2", "PackMultiplier2",
                          "PackBarcode3", "PackMultiplier3", "EarnPoints")
  values (app.str(payload -> 'barcode'), app.str(payload -> 'name'),
          coalesce(nullif(app.str(payload -> 'vatStatus'), ''), 'VAT'),
          app.num(payload -> 'costPrice'), app.num(payload -> 'price'), app.num(payload -> 'wholesalePrice'),
          app.num(payload -> 'shopeePrice'), app.num(payload -> 'lazadaPrice'), app.num(payload -> 'linemanPrice'),
          coalesce(nullif(app.str(payload -> 'category'), ''), 'ทั่วไป'), 0,
          coalesce(nullif(app.num(payload -> 'lowStockThreshold'), 0), 5),
          nullif(app.str(payload -> 'packBarcode'), ''), app.num(payload -> 'packMultiplier'),
          case when payload ? 'hasExpiry' then upper(app.jstr(payload -> 'hasExpiry')) else 'YES' end,
          nullif(app.str(payload -> 'acceptedPayments'), ''),
          nullif(app.str(payload -> 'packBarcode2'), ''), app.num(payload -> 'packMultiplier2'),
          nullif(app.str(payload -> 'packBarcode3'), ''), app.num(payload -> 'packMultiplier3'),
          case when payload ? 'earnPoints' then upper(app.jstr(payload -> 'earnPoints')) else 'YES' end);

  perform app.log('Inventory', 'Add Product', app.str(payload -> 'barcode'), app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'เพิ่มสินค้า ' || app.jstr(payload -> 'name') || ' สำเร็จ');
end $$;

create or replace function api_updateProduct(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_barcode text := trim(app.str(payload -> 'barcode'));
  v_id bigint;
begin
  perform app.require_user();
  select id into v_id from "Products" where trim(coalesce("Barcode", '')) = v_barcode order by id limit 1;
  if v_id is null then return jsonb_build_object('error', 'Product not found'); end if;

  update "Products" set
    "Name"              = case when payload ? 'name' then coalesce(app.txt(payload -> 'name'), '') else "Name" end,
    "VatStatus"         = case when payload ? 'vatStatus' then app.txt(payload -> 'vatStatus') else "VatStatus" end,
    "CostPrice"         = case when payload ? 'costPrice' then app.num(payload -> 'costPrice') else "CostPrice" end,
    "Price"             = case when payload ? 'price' then app.num(payload -> 'price') else "Price" end,
    "WholesalePrice"    = case when payload ? 'wholesalePrice' then app.num(payload -> 'wholesalePrice') else "WholesalePrice" end,
    "ShopeePrice"       = case when payload ? 'shopeePrice' then app.num(payload -> 'shopeePrice') else "ShopeePrice" end,
    "LazadaPrice"       = case when payload ? 'lazadaPrice' then app.num(payload -> 'lazadaPrice') else "LazadaPrice" end,
    "LinemanPrice"      = case when payload ? 'linemanPrice' then app.num(payload -> 'linemanPrice') else "LinemanPrice" end,
    "Category"          = case when payload ? 'category' then app.txt(payload -> 'category') else "Category" end,
    "Quantity"          = case when payload ? 'quantity' then app.num(payload -> 'quantity') else "Quantity" end,
    "Location"          = case when payload ? 'location' then app.txt(payload -> 'location') else "Location" end,
    "ExpiryDate"        = case when payload ? 'expiryDate' then app.date_txt(payload -> 'expiryDate') else "ExpiryDate" end,
    "LowStockThreshold" = case when payload ? 'lowStockThreshold' then app.num(payload -> 'lowStockThreshold') else "LowStockThreshold" end,
    "PackBarcode"       = case when payload ? 'packBarcode' then nullif(app.str(payload -> 'packBarcode'), '') else "PackBarcode" end,
    "PackMultiplier"    = case when payload ? 'packMultiplier' then app.num(payload -> 'packMultiplier') else "PackMultiplier" end,
    "HasExpiry"         = case when payload ? 'hasExpiry' then upper(app.jstr(payload -> 'hasExpiry')) else "HasExpiry" end,
    "AcceptedPayments"  = case when payload ? 'acceptedPayments' then nullif(app.str(payload -> 'acceptedPayments'), '') else "AcceptedPayments" end,
    "PackBarcode2"      = case when payload ? 'packBarcode2' then nullif(app.str(payload -> 'packBarcode2'), '') else "PackBarcode2" end,
    "PackMultiplier2"   = case when payload ? 'packMultiplier2' then app.num(payload -> 'packMultiplier2') else "PackMultiplier2" end,
    "PackBarcode3"      = case when payload ? 'packBarcode3' then nullif(app.str(payload -> 'packBarcode3'), '') else "PackBarcode3" end,
    "PackMultiplier3"   = case when payload ? 'packMultiplier3' then app.num(payload -> 'packMultiplier3') else "PackMultiplier3" end,
    "EarnPoints"        = case when payload ? 'earnPoints' then upper(app.jstr(payload -> 'earnPoints')) else "EarnPoints" end
   where id = v_id;

  perform app.log('Inventory', 'Edit Product', v_barcode, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'Product updated');
end $$;

create or replace function api_updateStoreStockDetail(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_barcode text := trim(app.str(payload -> 'barcode'));
  v_id bigint;
begin
  perform app.require_user();
  select id into v_id from "StoreStock" where trim(coalesce("Barcode", '')) = v_barcode order by id limit 1;
  if v_id is null then return jsonb_build_object('error', 'Store stock not found'); end if;
  update "StoreStock" set
    "StoreLocation" = case when payload ? 'storeLocation' then app.txt(payload -> 'storeLocation') else "StoreLocation" end,
    "LowStockThreshold" = case when payload ? 'lowStockThreshold' then app.num(payload -> 'lowStockThreshold') else "LowStockThreshold" end,
    "UpdatedAt" = now()
   where id = v_id;
  perform app.log('Inventory', 'Edit Store Stock', v_barcode, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'Store stock details updated');
end $$;

-- ============================================================
-- Shifts & expenses
-- ============================================================
create or replace function api_openShift(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text;
begin
  perform app.require_user();
  v_id := app.new_id('SHF-', 'Shifts', 'ShiftID');
  insert into "Shifts" ("ShiftID", "Status", "OpenTime", "ExpectedCash")
  values (v_id, 'OPEN', now(), case when app.txt(payload -> 'initialCash') is null then null else app.num(payload -> 'initialCash') end);
  perform app.log('Shift', 'Open Shift', v_id, app.actor(payload));
  return jsonb_build_object('success', true, 'shiftId', v_id);
end $$;

create or replace function api_closeShift(payload jsonb)
returns jsonb language plpgsql as $$
declare
  sh record;
begin
  perform app.require_user();
  select id, "ShiftID" into sh from "Shifts" where "Status" = 'OPEN' order by id desc limit 1 for update;
  if not found then return jsonb_build_object('error', 'No open shift found'); end if;
  update "Shifts" set
    "Status" = 'CLOSED',
    "CloseTime" = now(),
    "ActualCash" = case when app.txt(payload -> 'actualCash') is null then null else app.num(payload -> 'actualCash') end,
    "Discrepancy" = case when app.txt(payload -> 'discrepancy') is null then null else app.num(payload -> 'discrepancy') end,
    "DetailsJSON" = case when app.truthy(payload -> 'shiftDetails') then payload -> 'shiftDetails' else '{}'::jsonb end
   where id = sh.id;
  perform app.log('Shift', 'Close Shift', sh."ShiftID", app.actor(payload));
  return jsonb_build_object('success', true);
end $$;

create or replace function api_addExpense(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_url text := app.str(payload -> 'fileUrl');
begin
  perform app.require_user();
  insert into "Expenses" ("Timestamp", "Date", "Description", "Category", "Amount", "ReceiptFileURL")
  values (now(),
          case when app.truthy(payload -> 'date') then app.date_txt(payload -> 'date') else app.iso(now()) end,
          nullif(app.str(payload -> 'description'), ''),
          coalesce(nullif(app.str(payload -> 'category'), ''), 'อื่นๆ'),
          app.num(payload -> 'amount'), nullif(v_url, ''));
  return jsonb_build_object('success', true, 'message', 'Expense added successfully', 'fileUrl', v_url);
end $$;

-- ============================================================
-- Customers, loyalty, pets
-- ============================================================
create or replace function api_saveCustomer(payload jsonb)
returns jsonb language plpgsql as $$
begin
  perform app.require_user();
  return app.save_customer(payload, app.actor(payload));
end $$;

create or replace function api_addManualPoints(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_name text := trim(app.str(payload -> 'customerName'));
  v_points numeric := app.num(payload -> 'points');
  v_reason text := trim(coalesce(nullif(app.str(payload -> 'reason'), ''), 'เพิ่มพ้อยโดย Staff'));
  v_expiry text;
  v_balance numeric;
begin
  perform app.require_user();
  if v_name = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if v_points = 0 then return jsonb_build_object('error', 'จำนวนพ้อยต้องไม่เป็นศูนย์'); end if;
  if v_points > 0 and app.truthy(payload -> 'expiryDate') then
    v_expiry := coalesce(app.iso(app.js_date(app.str(payload -> 'expiryDate'))), app.str(payload -> 'expiryDate'));
  end if;
  v_balance := app.adjust_points(v_name, v_points, case when v_points > 0 then 'MANUAL_ADD' else 'MANUAL_DEDUCT' end,
                                 v_reason, '', app.actor_name(payload), v_expiry);
  perform app.log('Points', 'Manual ' || case when v_points > 0 then 'Add' else 'Deduct' end || ' Points', v_name, app.actor(payload));
  return jsonb_build_object('success', true, 'pointsChanged', v_points, 'newBalance', v_balance,
    'message', case when v_points > 0 then 'เพิ่ม' else 'หัก' end || ' ' || app.jsnum(abs(v_points)) || ' พ้อยให้ ' || v_name || ' สำเร็จ');
end $$;

create or replace function api_addManualCredits(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_name text := trim(app.str(payload -> 'customerName'));
  v_credits numeric := app.num(payload -> 'credits');
  v_reason text := trim(coalesce(nullif(app.str(payload -> 'reason'), ''), 'ปรับเครดิตโดย Staff'));
  v_expiry text;
  v_balance numeric;
begin
  perform app.require_user();
  if v_name = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if v_credits = 0 then return jsonb_build_object('error', 'จำนวนเครดิตต้องไม่เป็นศูนย์'); end if;
  if v_credits > 0 and app.truthy(payload -> 'expiryDate') then
    v_expiry := coalesce(app.iso(app.js_date(app.str(payload -> 'expiryDate'))), app.str(payload -> 'expiryDate'));
  end if;
  v_balance := app.adjust_credits(v_name, v_credits, case when v_credits > 0 then 'MANUAL_ADD' else 'MANUAL_DEDUCT' end,
                                  v_reason, '', app.actor_name(payload), v_expiry);
  perform app.log('Credits', 'Manual ' || case when v_credits > 0 then 'Add' else 'Deduct' end || ' Credits', v_name, app.actor(payload));
  return jsonb_build_object('success', true, 'creditsChanged', v_credits, 'newBalance', v_balance,
    'message', case when v_credits > 0 then 'เพิ่ม' else 'หัก' end || ' ' || app.jsnum(abs(v_credits)) || ' เครดิตให้ ' || v_name || ' สำเร็จ');
end $$;

create or replace function api_migratePointsToCredits(payload jsonb)
returns jsonb language plpgsql as $$
declare
  c record;
  v_migrated int := 0;
  v_skipped int := 0;
  v_ms bigint := app.ms();
  v_new numeric;
begin
  perform app.require_user();
  perform 1 from "Customers" for update;
  for c in select id, "Name", coalesce("Points", 0) as pts, coalesce("Credits", 0) as cr,
                  row_number() over (order by id) as rn
             from "Customers" order by id loop
    if c.pts <= 0 then v_skipped := v_skipped + 1; continue; end if;
    v_new := c.cr + c.pts;
    update "Customers" set "Credits" = v_new, "Points" = 0, "UpdatedAt" = now() where id = c.id;
    insert into "CreditsHistory" ("HistoryID", "CustomerName", "Date", "Type", "Credits", "Balance", "Reference", "OrderID", "Actor")
    values ('CH-MIG-' || v_ms || '-' || c.rn, trim(coalesce(c."Name", '')), now(), 'MIGRATE', c.pts, v_new,
            'ย้ายจากแต้มสะสม (Points → Credits)', null, 'System');
    v_migrated := v_migrated + 1;
  end loop;
  return jsonb_build_object('success', true, 'migrated', v_migrated, 'skipped', v_skipped,
    'message', 'ย้าย balance สำเร็จ ' || v_migrated || ' ราย (ข้าม ' || v_skipped || ' ราย ที่ Points = 0)');
end $$;

create or replace function api_savePet(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_pet text := trim(app.str(payload -> 'petId'));
  v_id bigint;
  v_new text;
  v_customer text := trim(app.str(payload -> 'customerName'));
begin
  perform app.require_user();
  if v_pet <> '' then
    select id into v_id from "Pets" where trim(coalesce("PetID", '')) = v_pet order by id limit 1;
    if v_id is not null then
      update "Pets" set
        "PetName"         = case when payload ? 'petName' then app.txt(payload -> 'petName') else "PetName" end,
        "Species"         = case when payload ? 'species' then app.txt(payload -> 'species') else "Species" end,
        "Breed"           = case when payload ? 'breed' then app.txt(payload -> 'breed') else "Breed" end,
        "BirthDate"       = case when payload ? 'birthDate' then app.date_txt(payload -> 'birthDate') else "BirthDate" end,
        "Weight"          = case when payload ? 'weight' then app.jsnum(app.num(payload -> 'weight')) else "Weight" end,
        "Color"           = case when payload ? 'color' then app.txt(payload -> 'color') else "Color" end,
        "VaccineDate"     = case when payload ? 'vaccineDate' then app.date_txt(payload -> 'vaccineDate') else "VaccineDate" end,
        "NextVaccineDate" = case when payload ? 'nextVaccineDate' then app.date_txt(payload -> 'nextVaccineDate') else "NextVaccineDate" end,
        "MedicalNotes"    = case when payload ? 'medicalNotes' then app.txt(payload -> 'medicalNotes') else "MedicalNotes" end,
        "Allergies"       = case when payload ? 'allergies' then app.txt(payload -> 'allergies') else "Allergies" end,
        "PhotoURL"        = case when payload ? 'photoUrl' then app.txt(payload -> 'photoUrl') else "PhotoURL" end,
        "Notes"           = case when payload ? 'notes' then app.txt(payload -> 'notes') else "Notes" end,
        "UpdatedAt"       = now()
       where id = v_id;
      perform app.log('Members', 'Edit Pet', v_pet, app.actor(payload));
      return jsonb_build_object('success', true, 'petId', v_pet, 'message', 'อัพเดทข้อมูลสัตว์เลี้ยงสำเร็จ');
    end if;
  end if;

  if v_customer = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if trim(app.str(payload -> 'petName')) = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อสัตว์เลี้ยง'); end if;

  v_new := app.new_id('PET-', 'Pets', 'PetID');
  insert into "Pets" ("PetID", "CustomerName", "PetName", "Species", "Breed", "BirthDate", "Weight", "Color",
                      "VaccineDate", "NextVaccineDate", "MedicalNotes", "Allergies", "PhotoURL", "Notes",
                      "Status", "CreatedAt", "UpdatedAt")
  values (v_new, v_customer, nullif(app.str(payload -> 'petName'), ''), nullif(app.str(payload -> 'species'), ''),
          nullif(app.str(payload -> 'breed'), ''), app.date_txt(nullif(payload -> 'birthDate', 'false'::jsonb)),
          app.jsnum(app.num(payload -> 'weight')), nullif(app.str(payload -> 'color'), ''),
          app.date_txt(nullif(payload -> 'vaccineDate', 'false'::jsonb)), app.date_txt(nullif(payload -> 'nextVaccineDate', 'false'::jsonb)),
          nullif(app.str(payload -> 'medicalNotes'), ''), nullif(app.str(payload -> 'allergies'), ''),
          nullif(app.str(payload -> 'photoUrl'), ''), nullif(app.str(payload -> 'notes'), ''),
          'ACTIVE', now(), now());
  perform app.log('Members', 'Add Pet', v_new, app.actor(payload));
  return jsonb_build_object('success', true, 'petId', v_new, 'message', 'เพิ่มข้อมูลสัตว์เลี้ยงสำเร็จ');
end $$;

create or replace function api_deletePet(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_pet text := trim(app.str(payload -> 'petId'));
  v_id bigint;
begin
  perform app.require_user();
  if v_pet = '' then return jsonb_build_object('error', 'ไม่พบรหัสสัตว์เลี้ยง'); end if;
  select id into v_id from "Pets" where trim(coalesce("PetID", '')) = v_pet order by id limit 1;
  if v_id is null then return jsonb_build_object('error', 'ไม่พบสัตว์เลี้ยง'); end if;
  update "Pets" set "Status" = 'DELETED', "UpdatedAt" = now() where id = v_id;
  perform app.log('Members', 'Delete Pet', v_pet, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'ลบข้อมูลสัตว์เลี้ยงสำเร็จ');
end $$;

-- ============================================================
-- Coupons & promotions
-- ============================================================
create or replace function api_saveCoupon(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_coupon text := trim(app.str(payload -> 'couponId'));
  v_id bigint;
begin
  perform app.require_user();
  if v_coupon <> '' then
    select id into v_id from "Coupons" where trim(coalesce("CouponID", '')) = v_coupon order by id limit 1;
  end if;
  if v_id is not null then
    update "Coupons" set
      "Name" = nullif(app.str(payload -> 'name'), ''),
      "Type" = coalesce(nullif(app.str(payload -> 'type'), ''), 'FIXED_AMOUNT'),
      "Value" = app.num(payload -> 'value'),
      "Price" = app.num(payload -> 'price'),
      "MinOrderAmount" = app.num(payload -> 'minOrderAmount'),
      "ExpiryDays" = coalesce(nullif(app.num(payload -> 'expiryDays'), 0), 365),
      "Description" = nullif(app.str(payload -> 'description'), ''),
      "Status" = coalesce(nullif(app.str(payload -> 'status'), ''), 'ACTIVE'),
      "FreeItemBarcode" = nullif(trim(app.str(payload -> 'freeItemBarcode')), ''),
      "FreeItemName" = nullif(trim(app.str(payload -> 'freeItemName')), '')
     where id = v_id;
  else
    insert into "Coupons" ("CouponID", "Name", "Type", "Value", "Price", "MinOrderAmount", "ExpiryDays",
                           "Description", "Status", "CreatedAt", "FreeItemBarcode", "FreeItemName")
    values (app.new_id('CPN-', 'Coupons', 'CouponID'), nullif(app.str(payload -> 'name'), ''),
            coalesce(nullif(app.str(payload -> 'type'), ''), 'FIXED_AMOUNT'),
            app.num(payload -> 'value'), app.num(payload -> 'price'), app.num(payload -> 'minOrderAmount'),
            coalesce(nullif(app.num(payload -> 'expiryDays'), 0), 365), nullif(app.str(payload -> 'description'), ''),
            coalesce(nullif(app.str(payload -> 'status'), ''), 'ACTIVE'), now(),
            nullif(trim(app.str(payload -> 'freeItemBarcode')), ''), nullif(trim(app.str(payload -> 'freeItemName')), ''));
  end if;
  return jsonb_build_object('success', true);
end $$;

create or replace function api_issueCoupon(payload jsonb)
returns jsonb language plpgsql as $$
begin
  perform app.require_user();
  return app.issue_coupon(trim(app.str(payload -> 'customerName')), trim(app.str(payload -> 'couponId')),
                          payload -> 'quantity', payload -> 'price', app.actor(payload));
end $$;

create or replace function api_useCoupon(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_inst text := trim(app.str(payload -> 'couponInstanceId'));
  v_id bigint;
begin
  perform app.require_user();
  if v_inst = '' then return jsonb_build_object('error', 'ไม่พบรหัสคูปอง'); end if;
  select id into v_id from "CustomerCoupons" where trim(coalesce("ID", '')) = v_inst order by id limit 1;
  if v_id is null then return jsonb_build_object('error', 'ไม่พบคูปองนี้'); end if;
  update "CustomerCoupons" set "Status" = 'USED', "UsedAt" = now(),
         "OrderID" = nullif(trim(app.str(payload -> 'orderId')), '')
   where id = v_id;
  perform app.log('Coupon', 'Use Coupon', v_inst, app.actor(payload));
  return jsonb_build_object('success', true);
end $$;

create or replace function api_savePromotion(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_promo text := trim(app.str(payload -> 'promoId'));
  v_id bigint;
begin
  perform app.require_user();
  if v_promo <> '' then
    select id into v_id from "Promotions" where trim(coalesce("PromoID", '')) = v_promo order by id limit 1;
  end if;
  if v_id is not null then
    update "Promotions" set
      "Name" = nullif(app.str(payload -> 'name'), ''),
      "ConditionType" = nullif(app.str(payload -> 'conditionType'), ''),
      "ConditionValue1" = nullif(app.str(payload -> 'conditionValue1'), ''),
      "ConditionValue2" = nullif(app.str(payload -> 'conditionValue2'), ''),
      "DiscountType" = coalesce(nullif(app.str(payload -> 'discountType'), ''), 'FIXED'),
      "DiscountValue" = app.num(payload -> 'discountValue'),
      "Status" = case when payload ? 'status' then app.txt(payload -> 'status') else "Status" end,
      "ExpiryDate" = case when payload ? 'expiryDate' then app.date_txt(payload -> 'expiryDate') else "ExpiryDate" end,
      "StartDate" = app.date_txt(nullif(payload -> 'startDate', 'false'::jsonb)),
      "EndDate" = app.date_txt(nullif(payload -> 'endDate', 'false'::jsonb)),
      "ActiveDays" = nullif(app.str(payload -> 'activeDays'), ''),
      "BonusPoints" = app.num(payload -> 'bonusPoints'),
      "DiscountValue2" = app.num(payload -> 'discountValue2')
     where id = v_id;
  else
    insert into "Promotions" ("PromoID", "Name", "ConditionType", "ConditionValue1", "ConditionValue2", "DiscountType",
                              "DiscountValue", "Status", "ExpiryDate", "StartDate", "EndDate", "ActiveDays",
                              "BonusPoints", "DiscountValue2")
    values (case when v_promo <> '' then v_promo else app.new_id('PRM-', 'Promotions', 'PromoID') end,
            coalesce(nullif(app.str(payload -> 'name'), ''), 'New Promotion'),
            coalesce(nullif(app.str(payload -> 'conditionType'), ''), 'MIN_AMOUNT'),
            nullif(app.str(payload -> 'conditionValue1'), ''), nullif(app.str(payload -> 'conditionValue2'), ''),
            coalesce(nullif(app.str(payload -> 'discountType'), ''), 'FIXED'), app.num(payload -> 'discountValue'),
            coalesce(nullif(app.str(payload -> 'status'), ''), 'ACTIVE'),
            app.date_txt(nullif(payload -> 'expiryDate', 'false'::jsonb)), app.date_txt(nullif(payload -> 'startDate', 'false'::jsonb)),
            app.date_txt(nullif(payload -> 'endDate', 'false'::jsonb)), nullif(app.str(payload -> 'activeDays'), ''),
            app.num(payload -> 'bonusPoints'), app.num(payload -> 'discountValue2'));
  end if;
  return jsonb_build_object('success', true, 'message', 'Promotion saved');
end $$;

create or replace function api_togglePromotionStatus(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_promo text := trim(app.str(payload -> 'promoId'));
  pr record;
  v_new text;
begin
  perform app.require_user();
  select id, "Status" into pr from "Promotions" where trim(coalesce("PromoID", '')) = v_promo order by id limit 1;
  if not found then return jsonb_build_object('error', 'Promotion not found'); end if;
  v_new := case when upper(trim(coalesce(pr."Status", ''))) = 'ACTIVE' then 'INACTIVE' else 'ACTIVE' end;
  update "Promotions" set "Status" = v_new where id = pr.id;
  return jsonb_build_object('success', true, 'newStatus', v_new);
end $$;

-- ============================================================
-- Packages
-- ============================================================
create or replace function api_savePackage(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_pkg text := trim(app.str(payload -> 'packageId'));
  p record;
  v_found boolean := false;
begin
  perform app.require_user();
  if v_pkg <> '' then
    select * into p from "Packages" where trim(coalesce("PackageID", '')) = v_pkg order by id limit 1;
    v_found := found;
  end if;
  if v_found then
    update "Packages" set
      "Name" = coalesce(nullif(app.str(payload -> 'name'), ''), p."Name"),
      "Price" = app.num(payload -> 'price'),
      "Points" = app.num(payload -> 'points'),
      "BonusPoints" = app.num(payload -> 'bonusPoints'),
      "Description" = nullif(app.str(payload -> 'description'), ''),
      "Status" = coalesce(nullif(app.str(payload -> 'status'), ''), 'ACTIVE'),
      "PackageType" = coalesce(nullif(app.str(payload -> 'packageType'), ''), nullif(p."PackageType", ''), 'POINTS'),
      "SessionCount" = coalesce(nullif(app.int(payload -> 'sessionCount'), 0), nullif(trunc(coalesce(p."SessionCount", 0)), 0), 0),
      "ExpiryDays" = coalesce(nullif(app.int(payload -> 'expiryDays'), 0), nullif(trunc(coalesce(p."ExpiryDays", 0)), 0), 365),
      "BonusSessions" = app.int(payload -> 'bonusSessions'),
      "BonusServiceName" = nullif(app.str(payload -> 'bonusServiceName'), ''),
      "BonusServiceSessions" = app.int(payload -> 'bonusServiceSessions'),
      "Subtype" = coalesce(nullif(app.str(payload -> 'subtype'), ''), 'GENERAL'),
      "RewardType" = coalesce(nullif(app.str(payload -> 'rewardType'), ''), 'NONE'),
      "RewardRef" = nullif(app.str(payload -> 'rewardRef'), ''),
      "RewardQty" = app.int(payload -> 'rewardQty'),
      "RewardName" = nullif(app.str(payload -> 'rewardName'), '')
     where id = p.id;
  else
    insert into "Packages" ("PackageID", "Name", "Price", "Points", "BonusPoints", "Description", "Status", "CreatedAt",
                            "PackageType", "SessionCount", "ExpiryDays", "BonusSessions", "BonusServiceName",
                            "BonusServiceSessions", "Subtype", "RewardType", "RewardRef", "RewardQty", "RewardName")
    values (app.new_id('PKG-', 'Packages', 'PackageID'), nullif(app.str(payload -> 'name'), ''),
            app.num(payload -> 'price'), app.num(payload -> 'points'), app.num(payload -> 'bonusPoints'),
            nullif(app.str(payload -> 'description'), ''), coalesce(nullif(app.str(payload -> 'status'), ''), 'ACTIVE'), now(),
            coalesce(nullif(app.str(payload -> 'packageType'), ''), 'POINTS'), app.int(payload -> 'sessionCount'),
            coalesce(nullif(app.int(payload -> 'expiryDays'), 0), 365), app.int(payload -> 'bonusSessions'),
            nullif(app.str(payload -> 'bonusServiceName'), ''), app.int(payload -> 'bonusServiceSessions'),
            coalesce(nullif(app.str(payload -> 'subtype'), ''), 'GENERAL'),
            coalesce(nullif(app.str(payload -> 'rewardType'), ''), 'NONE'), nullif(app.str(payload -> 'rewardRef'), ''),
            app.int(payload -> 'rewardQty'), nullif(app.str(payload -> 'rewardName'), ''));
  end if;
  return jsonb_build_object('success', true);
end $$;

create or replace function api_purchasePackage(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_customer text := trim(app.str(payload -> 'customerName'));
  v_pkg text := trim(app.str(payload -> 'packageId'));
  p record;
  v_actor_obj jsonb := app.actor(payload);
  v_actor text := app.actor_name(payload);
  v_earned numeric;
  v_days int;
  v_balance numeric;
  v_reward jsonb;
  v_price numeric;
  v_receipt text := '';
  v_order text := '';
begin
  perform app.require_user();
  if v_customer = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if v_pkg = '' then return jsonb_build_object('error', 'กรุณาเลือกแพคเกจ'); end if;
  select * into p from "Packages" where trim(coalesce("PackageID", '')) = v_pkg order by id limit 1;
  if not found then return jsonb_build_object('error', 'ไม่พบแพคเกจ'); end if;

  v_earned := coalesce(p."Points", 0) + coalesce(p."BonusPoints", 0);
  v_days := coalesce(nullif(trunc(coalesce(p."ExpiryDays", 0)), 0), 365);
  v_balance := app.adjust_credits(v_customer, v_earned, 'EARN',
                 'ซื้อแพคเกจ: ' || coalesce(p."Name", '') || ' (฿' || app.jsnum(p."Price") || ')',
                 v_pkg, v_actor, app.iso(now() + make_interval(days => v_days)));

  v_reward := app.issue_package_reward(v_customer, trim(coalesce(nullif(p."RewardType", ''), 'NONE')),
                trim(coalesce(p."RewardRef", '')), coalesce(nullif(trunc(coalesce(p."RewardQty", 0)), 0), 1)::int,
                trim(coalesce(p."RewardName", '')), v_days, v_pkg, v_actor_obj);

  -- the package sale is real income: record it with a receipt number
  v_price := round(coalesce(p."Price", 0), 2);
  if v_price > 0 then
    v_receipt := next_doc_number('TX');
    v_order := app.new_id('TX', 'Transactions', 'OrderID');
    insert into "Transactions" ("OrderID", "Date", "TotalAmount", "Tax", "PaymentMethod", "CartDetails", "CashReceived",
                                "ChangeReturn", "ShopPlatform", "ReceiptType", "CustomerInfo", "DiscountAmount",
                                "Username", "Status", "ReceiptNo", "GrossSubtotal", "VatableAmount", "NonVatAmount")
    values (v_order, now(), v_price, 0, coalesce(nullif(app.str(payload -> 'paymentMethod'), ''), 'เงินสด'),
            jsonb_build_array(jsonb_build_object('Barcode', '', 'Name', 'แพคเกจ: ' || coalesce(p."Name", ''),
                                                 'qty', 1, 'price', v_price, 'vatStatus', 'NON VAT')),
            0, 0, 'Store', 'ใบเสร็จ', jsonb_build_object('name', v_customer), 0, v_actor, 'COMPLETED', v_receipt,
            v_price, 0, v_price);
  end if;

  perform app.log('Points', 'Purchase Package', v_pkg, v_actor_obj);
  return jsonb_build_object('success', true, 'earnedPoints', v_earned, 'newBalance', v_balance,
                            'rewardIssued', v_reward, 'receiptNo', v_receipt, 'orderId', v_order,
                            'date', app.iso(now()));
end $$;

create or replace function api_purchaseSessionPackage(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_customer text := trim(app.str(payload -> 'customerName'));
  v_pkg text := trim(app.str(payload -> 'packageId'));
  p record;
  v_type text;
  v_sessions int;
  v_days int;
  v_reward_type text;
  v_reward_ref text;
  v_reward_qty int;
  v_expiry timestamptz;
  v_new text;
  v_actor_obj jsonb := app.actor(payload);
  v_reward jsonb;
  v_cust jsonb;
begin
  perform app.require_user();
  if v_customer = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if v_pkg = '' then return jsonb_build_object('error', 'กรุณาเลือกแพคเกจ'); end if;
  select * into p from "Packages" where trim(coalesce("PackageID", '')) = v_pkg order by id limit 1;
  if not found then return jsonb_build_object('error', 'ไม่พบแพคเกจ'); end if;

  v_type := coalesce(nullif(trim(coalesce(p."PackageType", '')), ''), 'POINTS');
  v_sessions := trunc(coalesce(p."SessionCount", 0));
  v_days := coalesce(nullif(trunc(coalesce(p."ExpiryDays", 0)), 0), 365);
  v_reward_type := coalesce(nullif(trim(coalesce(p."RewardType", '')), ''), 'NONE');
  v_reward_ref := trim(coalesce(p."RewardRef", ''));
  v_reward_qty := greatest(1, coalesce(nullif(trunc(coalesce(p."RewardQty", 0)), 0), 1))::int;

  if v_type <> 'SESSIONS' then return jsonb_build_object('error', 'แพคเกจนี้ไม่ใช่แบบครั้ง'); end if;
  if v_sessions <= 0 and v_reward_type = 'NONE' then
    return jsonb_build_object('error', 'แพคเกจนี้ยังไม่ได้กำหนดสินค้าหรือคูปอง');
  end if;
  if v_reward_type <> 'NONE' and v_reward_ref = '' then
    return jsonb_build_object('error', 'แพคเกจนี้มีประเภทของแถมแต่ยังไม่ได้เลือกสินค้า / คูปอง');
  end if;

  v_expiry := now() + make_interval(days => v_days);
  v_new := app.new_id('CP-', 'CustomerPackages', 'ID');
  insert into "CustomerPackages" ("ID", "CustomerName", "Phone", "PackageID", "PackageName", "PackageType",
                                  "TotalSessions", "UsedSessions", "PurchaseDate", "ExpiryDate", "Status",
                                  "PaidAmount", "Actor", "BonusServiceName", "BonusServiceSessions", "BonusServiceUsed")
  values (v_new, v_customer, nullif(app.str(payload -> 'phone'), ''), v_pkg, p."Name", 'SESSIONS',
          v_sessions, 0, now(), app.iso(v_expiry), 'ACTIVE',
          case when app.truthy(payload -> 'paidAmount') then app.num(payload -> 'paidAmount') else coalesce(p."Price", 0) end,
          app.actor_name(payload), nullif(trim(coalesce(p."BonusServiceName", '')), ''),
          trunc(coalesce(p."BonusServiceSessions", 0)), 0);

  -- auto-save customer (only touch the phone when one was entered)
  v_cust := jsonb_build_object('name', v_customer);
  if app.str(payload -> 'phone') <> '' then v_cust := v_cust || jsonb_build_object('phone', payload -> 'phone'); end if;
  perform app.save_customer(v_cust, null);

  v_reward := app.issue_package_reward(v_customer, v_reward_type, v_reward_ref, v_reward_qty,
                                       trim(coalesce(p."RewardName", '')), v_days, v_new, v_actor_obj);

  perform app.log('Package', 'Purchase Session Package', v_new, v_actor_obj);
  return jsonb_build_object('success', true, 'customerPackageId', v_new, 'totalSessions', v_sessions,
                            'expiryDate', app.iso(v_expiry), 'rewardIssued', v_reward, 'rewardType', v_reward_type,
                            'rewardRef', v_reward_ref,
                            'rewardQty', case when v_reward_type <> 'NONE' then v_reward_qty else 0 end);
end $$;

create or replace function api_usePackageSession(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_cp text := trim(app.str(payload -> 'customerPackageId'));
  v_use int := greatest(1, coalesce(nullif(app.int(payload -> 'sessionsUsed'), 0), 1))::int;
  cp record;
  v_total int;
  v_used int;
  v_status text;
  v_remaining int;
  v_new_used int;
  v_new_status text;
begin
  perform app.require_user();
  if v_cp = '' then return jsonb_build_object('error', 'ไม่พบรหัสแพคเกจ'); end if;
  select * into cp from "CustomerPackages" where trim(coalesce("ID", '')) = v_cp order by id limit 1 for update;
  if not found then return jsonb_build_object('error', 'ไม่พบแพคเกจของลูกค้า (ID: ' || v_cp || ')'); end if;

  v_total := trunc(coalesce(cp."TotalSessions", 0));
  v_used := trunc(coalesce(cp."UsedSessions", 0));
  v_status := trim(coalesce(cp."Status", ''));
  if v_status = 'USED_UP' then return jsonb_build_object('error', 'แพคเกจนี้ใช้ครบแล้ว'); end if;
  if v_status = 'EXPIRED' then return jsonb_build_object('error', 'แพคเกจหมดอายุแล้ว'); end if;
  if v_status <> 'ACTIVE' then return jsonb_build_object('error', 'แพคเกจนี้ไม่ได้ใช้งาน (สถานะ: ' || v_status || ')'); end if;

  if app.js_date(cp."ExpiryDate") < now() then
    update "CustomerPackages" set "Status" = 'EXPIRED' where id = cp.id;
    return jsonb_build_object('error', 'แพคเกจหมดอายุแล้ว');
  end if;

  v_remaining := v_total - v_used;
  if v_use > v_remaining then
    return jsonb_build_object('error', 'ครั้งคงเหลือไม่พอ (เหลือ ' || v_remaining || ' ครั้ง)');
  end if;
  v_new_used := v_used + v_use;
  v_new_status := case when v_new_used >= v_total then 'USED_UP' else 'ACTIVE' end;
  update "CustomerPackages" set "UsedSessions" = v_new_used, "Status" = v_new_status where id = cp.id;

  insert into "PackageUsage" ("ID", "CustomerPackageID", "CustomerName", "Date", "SessionsUsed", "Note", "OrderID", "Actor")
  values ('PU-' || app.ms(), v_cp, cp."CustomerName", now(), v_use, nullif(trim(app.str(payload -> 'note')), ''),
          nullif(app.str(payload -> 'orderId'), ''), app.actor_name(payload));

  perform app.log('Package', 'Use Session x' || v_use, v_cp, app.actor(payload));
  return jsonb_build_object('success', true, 'usedSessions', v_new_used,
                            'remainingSessions', v_total - v_new_used, 'newStatus', v_new_status);
end $$;

create or replace function api_extendPackageExpiry(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := trim(app.str(payload -> 'id'));
  v_date text := trim(app.str(payload -> 'newExpiryDate'));
  v_row bigint;
begin
  perform app.require_user();
  if v_id = '' then return jsonb_build_object('error', 'ไม่พบรหัสแพคเกจลูกค้า'); end if;
  if v_date = '' then return jsonb_build_object('error', 'กรุณาระบุวันหมดอายุใหม่'); end if;
  select id into v_row from "CustomerPackages" where trim(coalesce("ID", '')) = v_id order by id limit 1;
  if v_row is null then return jsonb_build_object('error', 'ไม่พบแพคเกจของลูกค้า'); end if;
  update "CustomerPackages"
     set "ExpiryDate" = coalesce(app.iso(app.js_date(v_date)), v_date),
         "Status" = case when trim(coalesce("Status", '')) = 'EXPIRED' then 'ACTIVE' else "Status" end
   where id = v_row;
  perform app.log('Package', 'Extend Expiry', v_id, app.actor(payload));
  return jsonb_build_object('success', true, 'message', 'ต่ออายุแพคเกจสำเร็จ');
end $$;

create or replace function api_useBonusService(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := trim(app.str(payload -> 'id'));
  v_count int := coalesce(nullif(app.int(payload -> 'count'), 0), 1)::int;
  cp record;
  v_total int;
  v_used int;
  v_remaining int;
begin
  perform app.require_user();
  if v_id = '' then return jsonb_build_object('error', 'ไม่พบรหัสแพคเกจ'); end if;
  select * into cp from "CustomerPackages" where trim(coalesce("ID", '')) = v_id order by id limit 1 for update;
  if not found then return jsonb_build_object('error', 'ไม่พบแพคเกจของลูกค้า'); end if;
  v_total := trunc(coalesce(cp."BonusServiceSessions", 0));
  v_used := trunc(coalesce(cp."BonusServiceUsed", 0));
  v_remaining := v_total - v_used;
  if v_remaining <= 0 then return jsonb_build_object('error', 'บริการโบนัสใช้ครบแล้ว'); end if;
  if v_count > v_remaining then
    return jsonb_build_object('error', 'บริการโบนัสคงเหลือไม่พอ (เหลือ ' || v_remaining || ' ครั้ง)');
  end if;
  update "CustomerPackages" set "BonusServiceUsed" = v_used + v_count where id = cp.id;
  perform app.log('Package', 'Use Bonus Service x' || v_count, v_id, app.actor(payload));
  return jsonb_build_object('success', true, 'usedBonus', v_used + v_count, 'remainingBonus', v_remaining - v_count);
end $$;

-- ============================================================
-- Cash coupons
-- ============================================================
create or replace function api_purchaseCashCoupon(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_customer text := trim(app.str(payload -> 'customerName'));
  v_phone text := trim(app.str(payload -> 'phone'));
  v_paid numeric := app.num(payload -> 'paidAmount');
  v_bonus numeric := app.num(payload -> 'bonusAmount');
  v_days int := coalesce(nullif(app.int(payload -> 'expiryDays'), 0), 365)::int;
  v_expiry timestamptz;
  v_new text;
  v_cust jsonb;
begin
  perform app.require_user();
  if v_customer = '' then return jsonb_build_object('error', 'กรุณาระบุชื่อลูกค้า'); end if;
  if v_paid <= 0 then return jsonb_build_object('error', 'จำนวนเงินต้องมากกว่า 0'); end if;

  v_expiry := now() + make_interval(days => v_days);
  v_new := app.new_id('CCB-', 'CashCoupons', 'ID');
  insert into "CashCoupons" ("ID", "CustomerName", "Phone", "TemplateName", "PaidAmount", "BonusAmount", "TotalCredit",
                             "UsedCredit", "RemainingCredit", "PurchaseDate", "ExpiryDate", "Status", "Actor")
  values (v_new, v_customer, nullif(v_phone, ''), nullif(trim(app.str(payload -> 'templateName')), ''),
          v_paid, v_bonus, v_paid + v_bonus, 0, v_paid + v_bonus, now(), app.iso(v_expiry), 'ACTIVE',
          app.actor_name(payload));

  v_cust := jsonb_build_object('name', v_customer);
  if v_phone <> '' then v_cust := v_cust || jsonb_build_object('phone', v_phone); end if;
  perform app.save_customer(v_cust, null);

  perform app.log('CashCoupon', 'Purchase', v_new, app.actor(payload));
  return jsonb_build_object('success', true, 'id', v_new, 'totalCredit', v_paid + v_bonus, 'expiryDate', app.iso(v_expiry));
end $$;

create or replace function api_useCashCoupon(payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := trim(app.str(payload -> 'id'));
  v_amount numeric := app.num(payload -> 'amountToUse');
  cc record;
  v_status text;
  v_remaining numeric;
  v_new_used numeric;
  v_new_remaining numeric;
  v_new_status text;
begin
  perform app.require_user();
  if v_id = '' then return jsonb_build_object('error', 'ไม่พบรหัสคูปองเงินสด'); end if;
  if v_amount <= 0 then return jsonb_build_object('error', 'จำนวนเงินต้องมากกว่า 0'); end if;
  select * into cc from "CashCoupons" where trim(coalesce("ID", '')) = v_id order by id limit 1 for update;
  if not found then return jsonb_build_object('error', 'ไม่พบคูปองเงินสดนี้'); end if;

  v_status := trim(coalesce(cc."Status", ''));
  v_remaining := coalesce(cc."RemainingCredit", 0);
  if v_status = 'USED_UP' then return jsonb_build_object('error', 'คูปองเงินสดนี้ใช้ครบแล้ว'); end if;
  if v_status = 'EXPIRED' then return jsonb_build_object('error', 'คูปองเงินสดหมดอายุแล้ว'); end if;
  if v_status <> 'ACTIVE' then return jsonb_build_object('error', 'คูปองเงินสดนี้ไม่ได้ใช้งาน'); end if;
  if app.js_date(cc."ExpiryDate") < now() then
    update "CashCoupons" set "Status" = 'EXPIRED' where id = cc.id;
    return jsonb_build_object('error', 'คูปองเงินสดหมดอายุแล้ว');
  end if;
  if v_amount > v_remaining then
    return jsonb_build_object('error', 'เครดิตคงเหลือไม่พอ (เหลือ ฿' || app.locale_num(v_remaining) || ')');
  end if;

  v_new_used := coalesce(cc."UsedCredit", 0) + v_amount;
  v_new_remaining := v_remaining - v_amount;
  v_new_status := case when v_new_remaining <= 0 then 'USED_UP' else 'ACTIVE' end;
  update "CashCoupons" set "UsedCredit" = v_new_used, "RemainingCredit" = v_new_remaining, "Status" = v_new_status
   where id = cc.id;
  perform app.log('CashCoupon', 'Use ฿' || app.jsnum(v_amount), v_id, app.actor(payload));
  return jsonb_build_object('success', true, 'usedAmount', v_amount, 'remainingCredit', v_new_remaining,
                            'newStatus', v_new_status);
end $$;

-- ============================================================
-- Staff accounts (Supabase Auth)
-- ============================================================

-- profile of the signed-in user; replaces the old "login" action
create or replace function api_me(payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'กรุณาเข้าสู่ระบบ');
  end if;
  select * into u from "Users" where "AuthUserID" = auth.uid() order by id limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'ไม่พบบัญชีผู้ใช้ในระบบ');
  end if;
  if upper(coalesce(u."IsActive", 'TRUE')) <> 'TRUE' then
    return jsonb_build_object('success', false, 'error', 'บัญชีนี้ถูกระงับการใช้งาน');
  end if;
  update "Users" set "LastLogin" = now() where id = u.id;
  return jsonb_build_object('success', true, 'user', jsonb_build_object(
    'userId', u."UserID", 'username', u."Username", 'displayName', u."DisplayName",
    'role', u."Role", 'isActive', true));
end $$;

-- create/update the Supabase Auth login that belongs to a Users row
create or replace function app.sync_auth_user(p_user_row bigint, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  u record;
  v_uid uuid;
  v_email text;
begin
  select * into u from "Users" where id = p_user_row;
  v_email := app.staff_email(u."Username");
  v_uid := u."AuthUserID";

  if v_uid is null or not exists (select 1 from auth.users where id = v_uid) then
    v_uid := coalesce(v_uid, gen_random_uuid());
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token,
                            is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
            coalesce(p_password, u."Password"), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('username', u."Username"),
            now(), now(), '', '', '', '', '', '', '', '', false, false);
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), v_uid, v_uid::text, 'email',
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            now(), now(), now());
    update "Users" set "AuthUserID" = v_uid where id = u.id;
  else
    update auth.users
       set email = v_email,
           encrypted_password = coalesce(p_password, encrypted_password),
           updated_at = now()
     where id = v_uid;
    update auth.identities
       set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
     where user_id = v_uid and provider = 'email';
  end if;

  update auth.users
     set banned_until = case when upper(coalesce(u."IsActive", 'TRUE')) = 'TRUE' then null else 'infinity'::timestamptz end
   where id = v_uid;
  return v_uid;
end $$;

create or replace function api_saveUser(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  u record;
  v_username text := trim(app.str(payload -> 'username'));
  v_password text := app.str(payload -> 'password');
  v_hash text;
  v_new text;
  v_row bigint;
begin
  if not app.is_admin() and auth.uid() is not null then
    return jsonb_build_object('success', false, 'error', 'เฉพาะผู้ดูแลระบบเท่านั้น');
  end if;
  if v_username <> '' and v_username !~ '^[A-Za-z0-9._-]+$' then
    return jsonb_build_object('success', false, 'error', 'Username ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และ . _ -');
  end if;
  if v_password <> '' then v_hash := crypt(v_password, gen_salt('bf')); end if;

  if app.truthy(payload -> 'userId') then
    select * into u from "Users" where "UserID" = app.jstr(payload -> 'userId') order by id limit 1 for update;
    if not found then return jsonb_build_object('success', false, 'error', 'ไม่พบผู้ใช้งาน'); end if;
    if v_username <> '' and exists (select 1 from "Users" where lower("Username") = lower(v_username) and id <> u.id) then
      return jsonb_build_object('success', false, 'error', 'มี Username นี้อยู่ในระบบแล้ว');
    end if;
    update "Users" set
      "Username" = coalesce(nullif(v_username, ''), "Username"),
      "Password" = coalesce(v_hash, "Password"),
      "DisplayName" = coalesce(nullif(app.str(payload -> 'displayName'), ''), "DisplayName"),
      "Role" = coalesce(nullif(app.str(payload -> 'role'), ''), "Role")
     where id = u.id;
    perform app.sync_auth_user(u.id, v_hash);
    return jsonb_build_object('success', true);
  end if;

  if v_username = '' or v_password = '' then
    return jsonb_build_object('success', false, 'error', 'กรุณาระบุ Username และรหัสผ่าน');
  end if;
  if exists (select 1 from "Users" where lower("Username") = lower(v_username)) then
    return jsonb_build_object('success', false, 'error', 'มี Username นี้อยู่ในระบบแล้ว');
  end if;
  v_new := app.new_id('USR-', 'Users', 'UserID');
  insert into "Users" ("UserID", "Username", "Password", "DisplayName", "Role", "IsActive", "CreatedAt")
  values (v_new, v_username, v_hash, nullif(app.str(payload -> 'displayName'), ''),
          coalesce(nullif(app.str(payload -> 'role'), ''), 'staff'), 'TRUE', now())
  returning id into v_row;
  perform app.sync_auth_user(v_row, v_hash);
  return jsonb_build_object('success', true, 'userId', v_new);
end $$;

create or replace function api_toggleUserStatus(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  if not app.is_admin() and auth.uid() is not null then
    return jsonb_build_object('success', false, 'error', 'เฉพาะผู้ดูแลระบบเท่านั้น');
  end if;
  select * into u from "Users" where "UserID" = app.jstr(payload -> 'userId') order by id limit 1 for update;
  if not found then return jsonb_build_object('success', false, 'error', 'ไม่พบผู้ใช้งาน'); end if;
  update "Users" set "IsActive" = case when upper(coalesce("IsActive", 'TRUE')) = 'TRUE' then 'FALSE' else 'TRUE' end
   where id = u.id;
  perform app.sync_auth_user(u.id, null);
  return jsonb_build_object('success', true);
end $$;

create or replace function api_deleteUser(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  if not app.is_admin() and auth.uid() is not null then
    return jsonb_build_object('success', false, 'error', 'เฉพาะผู้ดูแลระบบเท่านั้น');
  end if;
  select * into u from "Users" where "UserID" = app.jstr(payload -> 'userId') order by id limit 1;
  if not found then return jsonb_build_object('success', false, 'error', 'ไม่พบผู้ใช้งาน'); end if;
  if u."AuthUserID" = auth.uid() then
    return jsonb_build_object('success', false, 'error', 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
  end if;
  delete from "Users" where id = u.id;
  if u."AuthUserID" is not null then
    delete from auth.users where id = u."AuthUserID";
  end if;
  return jsonb_build_object('success', true);
end $$;

-- ============================================================
-- Receipts / expense attachments (replaces Google Drive uploads)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'staff_upload_receipts') then
    create policy "staff_upload_receipts" on storage.objects for insert to authenticated
      with check (bucket_id = 'receipts' and (select app.is_active_user()));
  end if;
end $$;

-- ============================================================
-- Access control
-- ============================================================

-- Only active staff can touch shop data (was: any signed-in user).
do $$
declare
  t text;
begin
  foreach t in array array[
    'Products','StoreStock','StockMovements','InventoryReceipts','Suppliers',
    'Transactions','TaxInvoices','Returns','Shifts','Expenses',
    'Customers','PointsHistory','CreditsHistory','Pets',
    'Packages','CustomerPackages','PackageUsage','CashCoupons',
    'Coupons','CustomerCoupons','Promotions','Users','ActivityLog',
    'document_counters'
  ] loop
    execute format(
      'alter policy "authenticated_full_access" on %I to authenticated
         using ((select app.is_active_user())) with check ((select app.is_active_user()))', t);
  end loop;
end $$;

-- password hashes and the user list are managed only through the api_* functions
revoke all on "Users" from anon, authenticated;
grant select ("id", "UserID", "Username", "DisplayName", "Role", "IsActive", "CreatedAt", "LastLogin", "AuthUserID")
  on "Users" to authenticated;

-- document numbers are issued only by next_doc_number()
revoke insert, update, delete, truncate on document_counters from anon, authenticated;

-- functions: nothing for anon; staff get the api_* surface
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;
revoke execute on function hash_existing_passwords() from authenticated;
revoke execute on function sync_document_counters() from authenticated;
revoke execute on function login_user(text, text) from authenticated;
revoke execute on function app.sync_auth_user(bigint, text) from authenticated;

-- every SECURITY DEFINER / helper gets a fixed search_path
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'app'::regnamespace)
       and p.prokind = 'f'
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;

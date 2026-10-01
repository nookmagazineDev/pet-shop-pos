-- ============================================================
-- PET SHOP POS — Supabase (PostgreSQL) initial schema
-- ============================================================
-- Design notes:
--  * Column names mirror the Google Sheets headers exactly (quoted
--    CamelCase) so the React frontend keeps working with the same
--    object keys — PostgREST returns identifiers as-is.
--    Transactions / TaxInvoices follow TX_HEADERS / TAXINV_HEADERS in
--    backend/Code.gs (incl. the VAT breakdown columns).
--  * Every table gets a surrogate `id` primary key; the original
--    sheet "ID" columns keep their values and get UNIQUE indexes.
--  * Money/quantity columns are numeric; free-form sheet data that
--    may be dirty (dates typed by hand, etc.) stays text where the
--    app treats it as text.
--  * RLS is enabled on every table. Phase 1 policy: any signed-in
--    user (authenticated role) has full access; anon has none.
--    Tighten per-role later (see docs/SUPABASE_MIGRATION.md).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Core catalog
-- ------------------------------------------------------------
create table if not exists "Products" (
  id                bigint generated always as identity primary key,
  "Barcode"         text,
  "Name"            text not null,
  "VatStatus"       text default 'VAT',
  "CostPrice"       numeric default 0,
  "Price"           numeric default 0,
  "WholesalePrice"  numeric default 0,
  "ShopeePrice"     numeric default 0,
  "LazadaPrice"     numeric default 0,
  "LinemanPrice"    numeric default 0,
  "GrabFoodPrice"   numeric default 0,
  "Category"        text default 'ทั่วไป',
  "Quantity"        numeric default 0,
  "Location"        text,
  "LotNumber"       text,
  "ExpiryDate"      text,
  "ReceivingDate"   text,
  "ImageURL"        text,
  "LowStockThreshold" numeric default 5,
  "PackBarcode"     text,
  "PackMultiplier"  numeric,
  "HasExpiry"       text,
  "AcceptedPayments" text,
  "PackBarcode2"    text,
  "PackMultiplier2" numeric,
  "PackBarcode3"    text,
  "PackMultiplier3" numeric,
  "EarnPoints"      text
);
create unique index if not exists products_barcode_uq
  on "Products" ("Barcode") where "Barcode" is not null and "Barcode" <> '';
create index if not exists products_name_idx on "Products" ("Name");

create table if not exists "StoreStock" (
  id          bigint generated always as identity primary key,
  "Barcode"   text,
  "Name"      text,
  "Quantity"  numeric default 0,
  "StoreLocation" text,
  "UpdatedAt" timestamptz default now(),
  "LowStockThreshold" numeric default 5
);
create index if not exists storestock_barcode_idx on "StoreStock" ("Barcode");

create table if not exists "StockMovements" (
  id          bigint generated always as identity primary key,
  "Date"      timestamptz default now(),
  "Barcode"   text,
  "Name"      text,
  "Quantity"  numeric,
  "FromLocation" text,
  "ToLocation"   text,
  "MovedBy"      text,
  "ReferenceNo"  text
);

create table if not exists "InventoryReceipts" (
  id               bigint generated always as identity primary key,
  "Timestamp"      timestamptz default now(),
  "ReceiptID"      text,
  "CompanyName"    text,
  "OrderNumber"    text,
  "Barcode"        text,
  "ProductName"    text,
  "Quantity"       numeric,
  "Location"       text,
  "LotNumber"      text,
  "ExpiryDate"     text,
  "ReceivingDate"  text,
  "UnitCost"       numeric,
  "TotalCost"      numeric,
  "OrderTotalCost" numeric,
  "SupplierPhone"  text,
  "SupplierEmail"  text,
  "SupplierTaxID"  text
);

create table if not exists "Suppliers" (
  id             bigint generated always as identity primary key,
  "SupplierID"   text unique,
  "Name"         text,
  "ContactPerson" text,
  "Phone"        text,
  "Email"        text,
  "Address"      text,
  "TaxID"        text,
  "CreatedAt"    timestamptz default now()
);

-- ------------------------------------------------------------
-- Sales
-- ------------------------------------------------------------
create table if not exists "Transactions" (
  id              bigint generated always as identity primary key,
  "OrderID"       text unique not null,
  "Date"          timestamptz default now(),
  "TotalAmount"   numeric default 0,
  "Tax"           numeric default 0,
  "PaymentMethod" text,
  "CartDetails"   jsonb,
  "CashReceived"  numeric default 0,
  "ChangeReturn"  numeric default 0,
  "ShopPlatform"  text default 'Store',
  "ReceiptType"   text default 'ใบเสร็จ',
  "CustomerInfo"  jsonb,
  "DiscountAmount" numeric default 0,
  "Username"      text,
  "Status"        text default 'COMPLETED',
  "CancelNote"    text,
  "TaxInvoiceNo"  text,
  "ReceiptNo"     text,
  -- VAT breakdown exactly as printed on the receipt:
  -- NonVatAmount + VatableAmount + Tax = TotalAmount
  "GrossSubtotal" numeric,
  "VatableAmount" numeric,
  "NonVatAmount"  numeric
);
create index if not exists transactions_date_idx on "Transactions" ("Date");
create index if not exists transactions_status_idx on "Transactions" ("Status");

create table if not exists "TaxInvoices" (
  id                bigint generated always as identity primary key,
  "TaxInvoiceNo"    text unique,
  "Date"            timestamptz default now(),
  "OrderID"         text,
  "CustomerName"    text,
  "CustomerAddress" text,
  "CustomerTaxID"   text,
  "CustomerBranch"  text default 'สำนักงานใหญ่',
  "TotalAmount"     numeric,
  "TaxAmount"       numeric,
  "VatableAmount"   numeric,
  "NonVatAmount"    numeric,
  "Status"          text default 'ACTIVE',   -- CANCELLED when the bill is voided
  "CancelNote"      text,
  "IssuedBy"        text
);

create table if not exists "Returns" (
  id             bigint generated always as identity primary key,
  "Timestamp"    timestamptz default now(),
  "OrderID"      text,
  "Barcode"      text,
  "ProductName"  text,
  "ReturnQty"    numeric,
  "RefundAmount" numeric,
  "ReturnNote"   text,
  "ActionBy"     text
);

create table if not exists "Shifts" (
  id             bigint generated always as identity primary key,
  "ShiftID"      text unique,
  "Status"       text,
  "OpenTime"     timestamptz,
  "CloseTime"    timestamptz,
  "ExpectedCash" numeric,
  "ActualCash"   numeric,
  "Discrepancy"  numeric,
  "DetailsJSON"  jsonb
);

create table if not exists "Expenses" (
  id               bigint generated always as identity primary key,
  "Timestamp"      timestamptz default now(),
  "Date"           text,
  "Description"    text,
  "Category"       text,
  "Amount"         numeric,
  "ReceiptFileURL" text,
  "ItemsJSON"      jsonb
);

-- ------------------------------------------------------------
-- Customers & loyalty
-- ------------------------------------------------------------
create table if not exists "Customers" (
  id                bigint generated always as identity primary key,
  "CustomerID"      text unique,
  "Name"            text not null,
  "Phone"           text,
  "TaxID"           text,
  "TaxAddress"      text,
  "Address"         text,
  "Points"          numeric default 0,
  "Credits"         numeric default 0,
  "LastInvoiceID"   text,
  "LastInvoiceDate" text,
  "CreatedAt"       timestamptz default now(),
  "UpdatedAt"       timestamptz default now(),
  "PointsUpdatedAt" timestamptz,
  "Email"           text,
  "LineID"          text,
  "Notes"           text,
  "Birthday"        text,
  "CreditsExpiry"   text,
  "PointsExpiry"    text
);
create index if not exists customers_name_idx on "Customers" (lower("Name"));
create index if not exists customers_phone_idx on "Customers" ("Phone");

create table if not exists "PointsHistory" (
  id             bigint generated always as identity primary key,
  "HistoryID"    text,
  "CustomerName" text,
  "Date"         timestamptz default now(),
  "Type"         text,
  "Points"       numeric,
  "Balance"      numeric,
  "Reference"    text,
  "OrderID"      text,
  "Actor"        text
);

create table if not exists "CreditsHistory" (
  id             bigint generated always as identity primary key,
  "HistoryID"    text,
  "CustomerName" text,
  "Date"         timestamptz default now(),
  "Type"         text,
  "Credits"      numeric,
  "Balance"      numeric,
  "Reference"    text,
  "OrderID"      text,
  "Actor"        text
);

create table if not exists "Pets" (
  id               bigint generated always as identity primary key,
  "PetID"          text unique,
  "CustomerName"   text,
  "PetName"        text,
  "Species"        text,
  "Breed"          text,
  "BirthDate"      text,
  "Weight"         text,
  "Color"          text,
  "VaccineDate"    text,
  "NextVaccineDate" text,
  "MedicalNotes"   text,
  "Allergies"      text,
  "PhotoURL"       text,
  "Notes"          text,
  "Status"         text,
  "CreatedAt"      timestamptz default now(),
  "UpdatedAt"      timestamptz default now()
);

-- ------------------------------------------------------------
-- Packages / coupons / promotions
-- ------------------------------------------------------------
create table if not exists "Packages" (
  id             bigint generated always as identity primary key,
  "PackageID"    text unique,
  "Name"         text,
  "Price"        numeric,
  "Points"       numeric,
  "BonusPoints"  numeric,
  "Description"  text,
  "Status"       text,
  "CreatedAt"    timestamptz default now(),
  "PackageType"  text,
  "SessionCount" numeric,
  "ExpiryDays"   numeric,
  "BonusSessions" numeric,
  "BonusServiceName" text,
  "BonusServiceSessions" numeric,
  "Subtype"      text,
  "RewardType"   text,
  "RewardRef"    text,
  "RewardQty"    numeric,
  "RewardName"   text
);

create table if not exists "CustomerPackages" (
  id              bigint generated always as identity primary key,
  "ID"            text unique,
  "CustomerName"  text,
  "Phone"         text,
  "PackageID"     text,
  "PackageName"   text,
  "PackageType"   text,
  "TotalSessions" numeric,
  "UsedSessions"  numeric default 0,
  "PurchaseDate"  timestamptz,
  "ExpiryDate"    text,
  "Status"        text,
  "PaidAmount"    numeric,
  "Actor"         text,
  "BonusServiceName" text,
  "BonusServiceSessions" numeric,
  "BonusServiceUsed" numeric default 0
);

create table if not exists "PackageUsage" (
  id                  bigint generated always as identity primary key,
  "ID"                text,
  "CustomerPackageID" text,
  "CustomerName"      text,
  "Date"              timestamptz default now(),
  "SessionsUsed"      numeric,
  "Note"              text,
  "OrderID"           text,
  "Actor"             text
);

create table if not exists "CashCoupons" (
  id                bigint generated always as identity primary key,
  "ID"              text unique,
  "CustomerName"    text,
  "Phone"           text,
  "TemplateName"    text,
  "PaidAmount"      numeric,
  "BonusAmount"     numeric,
  "TotalCredit"     numeric,
  "UsedCredit"      numeric default 0,
  "RemainingCredit" numeric,
  "PurchaseDate"    timestamptz,
  "ExpiryDate"      text,
  "Status"          text,
  "Actor"           text
);

create table if not exists "Coupons" (
  id               bigint generated always as identity primary key,
  "CouponID"       text unique,
  "Name"           text,
  "Type"           text,
  "Value"          numeric,
  "Price"          numeric,
  "MinOrderAmount" numeric,
  "ExpiryDays"     numeric,
  "Description"    text,
  "Status"         text,
  "CreatedAt"      timestamptz default now(),
  "FreeItemBarcode" text,
  "FreeItemName"   text
);

create table if not exists "CustomerCoupons" (
  id               bigint generated always as identity primary key,
  "ID"             text unique,
  "CustomerName"   text,
  "CouponID"       text,
  "CouponName"     text,
  "Type"           text,
  "Value"          numeric,
  "MinOrderAmount" numeric,
  "Price"          numeric,
  "Status"         text,
  "IssuedAt"       timestamptz,
  "ExpiryDate"     text,
  "UsedAt"         timestamptz,
  "OrderID"        text,
  "IssuedBy"       text,
  "FreeItemBarcode" text,
  "FreeItemName"   text
);

create table if not exists "Promotions" (
  id                bigint generated always as identity primary key,
  "PromoID"         text unique,
  "Name"            text,
  "ConditionType"   text,
  "ConditionValue1" text,
  "ConditionValue2" text,
  "DiscountType"    text,
  "DiscountValue"   numeric,
  "Status"          text,
  "ExpiryDate"      text,
  "StartDate"       text,
  "EndDate"         text,
  "ActiveDays"      text,
  "BonusPoints"     numeric,
  "DiscountValue2"  numeric
);

-- ------------------------------------------------------------
-- Users & audit
-- ------------------------------------------------------------
create table if not exists "Users" (
  id            bigint generated always as identity primary key,
  "UserID"      text unique,
  "Username"    text unique not null,
  "Password"    text,                -- bcrypt hash (see hash_existing_passwords)
  "DisplayName" text,
  "Role"        text default 'staff',
  "IsActive"    text default 'TRUE',
  "CreatedAt"   timestamptz default now(),
  "LastLogin"   timestamptz
);

create table if not exists "ActivityLog" (
  id            bigint generated always as identity primary key,
  "Timestamp"   timestamptz default now(),
  "User"        text,
  "Role"        text,
  "Module"      text,
  "Action"      text,
  "ReferenceID" text,
  "Details"     text
);

-- ------------------------------------------------------------
-- Document numbering (ReceiptNo TXyymm####, TaxInvoiceNo INyymm####)
-- Replaces the scan-the-whole-sheet approach; safe under concurrency.
-- ------------------------------------------------------------
create table if not exists document_counters (
  prefix     text primary key,       -- e.g. 'TX2608', 'IN2608'
  last_value integer not null default 0
);

-- Highest sequence already issued for a prefix (e.g. 'TX2610') in the
-- imported sheet data, so numbering continues instead of restarting at 0001.
create or replace function max_doc_seq(p_prefix text)
returns integer
language sql
stable
as $$
  select coalesce(max(substring(no from length(p_prefix) + 1)::integer), 0)
    from (
      select upper(trim("ReceiptNo")) as no from "Transactions"
      union all
      select upper(trim("TaxInvoiceNo")) from "TaxInvoices"
    ) s
   where no like p_prefix || '%'
     and substring(no from length(p_prefix) + 1) ~ '^[0-9]{1,9}$';
$$;

create or replace function next_doc_number(p_kind text)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_next   integer;
begin
  v_prefix := p_kind || to_char(now() at time zone 'Asia/Bangkok', 'YYMM');
  update document_counters
     set last_value = last_value + 1
   where prefix = v_prefix
  returning last_value into v_next;

  if not found then
    -- first document of the month: start after anything already imported
    insert into document_counters (prefix, last_value)
    values (v_prefix, max_doc_seq(v_prefix) + 1)
    on conflict (prefix) do update
      set last_value = document_counters.last_value + 1
    returning last_value into v_next;
  end if;
  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

-- Raise every counter to the highest number found in the data.
-- Run after importing from Sheets (the migration script calls it).
create or replace function sync_document_counters()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into document_counters (prefix, last_value)
  select left(no, 6), max(substring(no from 7)::integer)
    from (
      select upper(trim("ReceiptNo")) as no from "Transactions"
      union all
      select upper(trim("TaxInvoiceNo")) from "TaxInvoices"
    ) s
   where no ~ '^(TX|IN)[0-9]{4}[0-9]{1,9}$'
   group by left(no, 6)
  on conflict (prefix) do update
    set last_value = greatest(document_counters.last_value, excluded.last_value);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Loyalty helpers (mirror _adjustCustomerPoints/_adjustCustomerCredits)
-- ------------------------------------------------------------
create or replace function adjust_customer_credits(
  p_customer text, p_delta numeric, p_type text,
  p_reference text default '', p_order_id text default '', p_actor text default 'System',
  p_expiry text default null
) returns numeric
language plpgsql
as $$
declare
  v_balance numeric;
begin
  update "Customers"
     set "Credits" = greatest(0, coalesce("Credits", 0) + p_delta),
         "CreditsExpiry" = coalesce(p_expiry, "CreditsExpiry"),
         "UpdatedAt" = now()
   where id = (
     select id from "Customers"
      where lower(trim("Name")) = lower(trim(p_customer))
      order by id limit 1
   )
  returning "Credits" into v_balance;

  if not found then
    v_balance := greatest(0, p_delta);
    insert into "Customers" ("CustomerID", "Name", "Credits", "Points")
    values ('CUST-' || (extract(epoch from now()) * 1000)::bigint, p_customer, v_balance, 0);
  end if;

  insert into "CreditsHistory" ("HistoryID", "CustomerName", "Type", "Credits", "Balance", "Reference", "OrderID", "Actor")
  values ('CH-' || (extract(epoch from now()) * 1000)::bigint, p_customer, p_type, abs(p_delta), v_balance, p_reference, p_order_id, p_actor);

  return v_balance;
end;
$$;

create or replace function adjust_customer_points(
  p_customer text, p_delta numeric, p_type text,
  p_reference text default '', p_order_id text default '', p_actor text default 'System'
) returns numeric
language plpgsql
as $$
declare
  v_balance numeric;
begin
  update "Customers"
     set "Points" = greatest(0, coalesce("Points", 0) + p_delta),
         "PointsUpdatedAt" = now(),
         "UpdatedAt" = now()
   where id = (
     select id from "Customers"
      where lower(trim("Name")) = lower(trim(p_customer))
      order by id limit 1
   )
  returning "Points" into v_balance;

  if not found then
    v_balance := greatest(0, p_delta);
    insert into "Customers" ("CustomerID", "Name", "Points", "Credits")
    values ('CUST-' || (extract(epoch from now()) * 1000)::bigint, p_customer, v_balance, 0);
  end if;

  insert into "PointsHistory" ("HistoryID", "CustomerName", "Type", "Points", "Balance", "Reference", "OrderID", "Actor")
  values ('PH-' || (extract(epoch from now()) * 1000)::bigint, p_customer, p_type, abs(p_delta), v_balance, p_reference, p_order_id, p_actor);

  return v_balance;
end;
$$;

-- ------------------------------------------------------------
-- Atomic checkout (mirrors processCheckout in Code.gs).
-- Everything in one transaction: numbering, tax invoice, sale row,
-- stock deduction, credits/points — all succeed or all roll back.
-- ------------------------------------------------------------
create or replace function process_checkout(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_order_ms   bigint;
  v_order_id   text;
  v_receipt_no text;
  v_tax_no     text := null;
  v_username   text := coalesce(payload #>> '{_actor,username}', '');
  v_actor      text := coalesce(nullif(v_username, ''), 'System');
  v_total      numeric := round(coalesce((payload ->> 'totalAmount')::numeric, 0), 2);
  v_vat        numeric := round(coalesce((payload ->> 'tax')::numeric, 0), 2);
  v_vatable    numeric;
  v_nonvat     numeric;
  v_gross      numeric;
  v_cname      text := coalesce(payload ->> 'customerName', payload #>> '{customerInfo,name}', payload #>> '{customerInfo,customerName}', '');
  v_item       jsonb;
  v_qty        numeric;
  v_barcode    text;
  v_name       text;
  v_credits    numeric := coalesce((payload ->> 'creditsUsed')::numeric, 0);
  v_points     numeric := coalesce((payload ->> 'pointsUsed')::numeric, 0);
  v_promo_pts  numeric := coalesce((payload ->> 'promoPoints')::numeric, 0);
  v_coupon_pts numeric := coalesce((payload ->> 'couponPoints')::numeric, 0);
begin
  -- VAT breakdown (mirrors _resolveVatBreakdown in Code.gs):
  -- use the base the screen printed; else derive it from VAT x 100/7.
  -- NonVat absorbs rounding so NonVat + Vatable + VAT = Total always.
  v_vatable := case
    when payload ->> 'vatableAmount' is not null then round((payload ->> 'vatableAmount')::numeric, 2)
    when v_vat > 0 then round(v_vat * 100 / 7, 2)
    else 0
  end;
  v_nonvat := round(v_total - v_vatable - v_vat, 2);
  if v_nonvat < 0 then
    v_nonvat := 0;
    v_vatable := round(v_total - v_vat, 2);
  end if;
  v_gross := case
    when payload ->> 'grossSubtotal' is not null then round((payload ->> 'grossSubtotal')::numeric, 2)
    else v_total + round(coalesce((payload ->> 'discount')::numeric, 0), 2)
  end;

  -- next_doc_number locks this month's counter row until commit, so
  -- checkouts are serialized from here; bump the ms-based OrderID when
  -- two terminals check out within the same millisecond.
  v_receipt_no := next_doc_number('TX');
  v_order_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  while exists (select 1 from "Transactions" where "OrderID" = 'TX' || v_order_ms) loop
    v_order_ms := v_order_ms + 1;
  end loop;
  v_order_id := 'TX' || v_order_ms;

  if payload ->> 'receiptType' = 'ใบกำกับภาษี' then
    v_tax_no := next_doc_number('IN');
    insert into "TaxInvoices" (
      "TaxInvoiceNo", "OrderID", "CustomerName", "CustomerAddress", "CustomerTaxID", "CustomerBranch",
      "TotalAmount", "TaxAmount", "VatableAmount", "NonVatAmount", "Status", "CancelNote", "IssuedBy"
    ) values (
      v_tax_no,
      v_order_id,
      coalesce(payload #>> '{customerInfo,name}', payload #>> '{customerInfo,customerName}', '-'),
      coalesce(payload #>> '{customerInfo,taxAddress}', payload #>> '{customerInfo,address}', payload #>> '{customerInfo,customerAddress}', '-'),
      coalesce(payload #>> '{customerInfo,taxId}', payload #>> '{customerInfo,customerTaxId}', '-'),
      coalesce(payload #>> '{customerInfo,branch}', payload #>> '{customerInfo,customerBranch}', 'สำนักงานใหญ่'),
      v_total, v_vat, v_vatable, v_nonvat, 'ACTIVE', '', v_username
    );
  end if;

  insert into "Transactions" (
    "OrderID", "TotalAmount", "Tax", "PaymentMethod", "CartDetails",
    "CashReceived", "ChangeReturn", "ShopPlatform", "ReceiptType",
    "CustomerInfo", "DiscountAmount", "Username", "Status", "TaxInvoiceNo", "ReceiptNo",
    "GrossSubtotal", "VatableAmount", "NonVatAmount"
  ) values (
    v_order_id,
    v_total,
    v_vat,
    payload ->> 'paymentMethod',
    payload -> 'cart',
    round(coalesce((payload ->> 'cashReceived')::numeric, 0), 2),
    round(coalesce((payload ->> 'changeReturn')::numeric, 0), 2),
    coalesce(payload ->> 'shopPlatform', 'Store'),
    coalesce(payload ->> 'receiptType', 'ใบเสร็จ'),
    payload -> 'customerInfo',
    round(coalesce((payload ->> 'discount')::numeric, 0), 2),
    v_username, 'COMPLETED', v_tax_no, v_receipt_no,
    v_gross, v_vatable, v_nonvat
  );

  -- Deduct stock: Products (warehouse) always, StoreStock when present
  for v_item in select * from jsonb_array_elements(payload -> 'cart') loop
    v_qty     := coalesce((v_item ->> 'qty')::numeric, 0);
    v_barcode := trim(coalesce(v_item ->> 'Barcode', ''));
    v_name    := trim(coalesce(v_item ->> 'Name', v_item ->> 'name', ''));
    if v_qty <= 0 then continue; end if;

    update "Products"
       set "Quantity" = greatest(0, coalesce("Quantity", 0) - v_qty)
     where id = (
       select id from "Products"
        where (v_barcode <> '' and trim("Barcode") = v_barcode)
           or (v_barcode = '' and trim("Name") = v_name)
        limit 1
     );

    update "StoreStock"
       set "Quantity" = greatest(0, coalesce("Quantity", 0) - v_qty),
           "UpdatedAt" = now()
     where id = (
       select id from "StoreStock"
        where ((v_barcode <> '' and trim("Barcode") = v_barcode)
           or (v_barcode = '' and trim("Name") = v_name))
          and coalesce("Quantity", 0) > 0
        limit 1
     );
  end loop;

  if v_credits > 0 and v_cname <> '' then
    perform adjust_customer_credits(v_cname, -v_credits, 'REDEEM', 'ชำระบิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_points > 0 and v_cname <> '' then
    perform adjust_customer_points(v_cname, -v_points, 'REDEEM', 'ชำระบิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_promo_pts > 0 and v_cname <> '' then
    perform adjust_customer_points(v_cname, v_promo_pts, 'PROMO_EARN', 'โปรโมชั่น บิล ' || v_order_id, v_order_id, v_actor);
  end if;
  if v_coupon_pts > 0 and v_cname <> '' then
    perform adjust_customer_points(v_cname, v_coupon_pts, 'COUPON_EARN', 'คูปองแต้ม บิล ' || v_order_id, v_order_id, v_actor);
  end if;

  insert into "ActivityLog" ("User", "Role", "Module", "Action", "ReferenceID")
  values (v_actor, coalesce(payload #>> '{_actor,role}', 'system'), 'POS/Online', 'Checkout', v_order_id);

  return jsonb_build_object(
    'success', true, 'orderId', v_order_id, 'receiptNo', v_receipt_no, 'taxInvoiceNo', v_tax_no,
    'date', now(), 'vatableAmount', v_vatable, 'nonVatAmount', v_nonvat, 'tax', v_vat, 'totalAmount', v_total
  );
end;
$$;

-- ------------------------------------------------------------
-- Login via RPC with bcrypt (replaces plaintext compare in Code.gs).
-- After importing legacy plaintext passwords, run once:
--   select hash_existing_passwords();
-- ------------------------------------------------------------
create or replace function hash_existing_passwords()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  update "Users"
     set "Password" = crypt("Password", gen_salt('bf'))
   where "Password" is not null and "Password" not like '$2%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function login_user(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  u record;
begin
  select * into u
    from "Users"
   where lower("Username") = lower(trim(p_username))
     and "Password" = crypt(p_password, "Password")
   limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  end if;
  if upper(coalesce(u."IsActive", 'TRUE')) <> 'TRUE' then
    return jsonb_build_object('success', false, 'error', 'บัญชีนี้ถูกระงับการใช้งาน');
  end if;

  update "Users" set "LastLogin" = now() where id = u.id;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'userId', u."UserID",
      'username', u."Username",
      'displayName', u."DisplayName",
      'role', u."Role",
      'isActive', true
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security — phase 1: signed-in users only, anon blocked.
-- ------------------------------------------------------------
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
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "authenticated_full_access" on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end;
$$;

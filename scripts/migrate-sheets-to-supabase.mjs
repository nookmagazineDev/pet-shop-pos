#!/usr/bin/env node
// ============================================================
// Migrate data: Google Sheets (ผ่าน Apps Script API เดิม) → Supabase หรือ NAS
// ============================================================
// วิธีใช้:
//   1. สร้างตารางก่อน
//      - Supabase: รัน supabase/migrations/0001_initial_schema.sql ใน SQL Editor
//      - NAS: docker compose up สร้างให้อัตโนมัติ (docs/NAS_SETUP.md)
//   2. ตั้งค่า environment variables แบบใดแบบหนึ่ง:
//      Supabase:
//        SUPABASE_URL          เช่น https://xxxx.supabase.co
//        SUPABASE_SERVICE_KEY  Secret key (sb_secret_...) จาก Project Settings → API Keys
//                              (หรือ service_role key แบบเก่าที่ขึ้นต้นด้วย eyJ ก็ใช้ได้)
//      NAS:
//        REST_URL              เช่น http://192.168.1.50:3000
//        JWT_SECRET            ค่าเดียวกับในไฟล์ nas/.env
//      ใส่ได้ทั้งคู่:
//        GAS_API_URL           (ไม่ใส่ก็ได้ จะใช้ URL ใน src/api.js)
//   3. node scripts/migrate-sheets-to-supabase.mjs
//
// รันซ้ำได้: สคริปต์จะ "เติมเฉพาะตารางที่ยังว่าง" (ข้ามตารางที่มีข้อมูลแล้ว)
// เพื่อไม่ให้ข้อมูลซ้ำ ถ้าต้องการล้างแล้วลงใหม่ ให้ truncate ตารางก่อน
//
// หมายเหตุ: ตาราง Users จะย้ายมา "โดยไม่มีรหัสผ่าน" เพราะ API เดิม
// ไม่ส่งรหัสผ่านออกมา (ถูกต้องแล้ว) — ให้ตั้งรหัสผ่านใหม่
// ตามขั้นตอนใน docs/SUPABASE_MIGRATION.md หรือ docs/NAS_SETUP.md
// ============================================================

import { createHmac } from "node:crypto";

const GAS_API_URL = process.env.GAS_API_URL
  || "https://script.google.com/macros/s/AKfycbw55ZnPhKMRIV_y1OoqhJEuhovL4_w8fikg4ARvFx_O7X9zHhiP3clE2F6-hDnXechNCw/exec";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const REST_URL = (process.env.REST_URL || (SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : "")).replace(/\/+$/, "");

// token ชั่วคราวสิทธิ์ service_role สำหรับ PostgREST บน NAS (หมดอายุใน 2 ชั่วโมง)
function serviceToken(secret) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 7200 })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

// Secret keys แบบใหม่ของ Supabase (sb_secret_...) ไม่ใช่ JWT ส่งเป็น Bearer แล้วจะโดนปฏิเสธ
// จึงใส่ Authorization เฉพาะ key แบบเก่า (JWT ขึ้นต้นด้วย eyJ)
const AUTH_HEADERS = JWT_SECRET
  ? { Authorization: `Bearer ${serviceToken(JWT_SECRET)}` }
  : SERVICE_KEY && SERVICE_KEY.startsWith("eyJ")
    ? { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    : { apikey: SERVICE_KEY };

if (!REST_URL || !(SERVICE_KEY || JWT_SECRET)) {
  console.error("❌ กรุณาตั้งค่า SUPABASE_URL + SUPABASE_SERVICE_KEY (Supabase) หรือ REST_URL + JWT_SECRET (NAS) ก่อนรัน");
  process.exit(1);
}

// action ของ API เดิม → ตารางใน Supabase + คอลัมน์ที่รับ
const TABLES = [
  { action: "getProducts", table: "Products", columns: ["Barcode","Name","VatStatus","CostPrice","Price","WholesalePrice","ShopeePrice","LazadaPrice","LinemanPrice","GrabFoodPrice","Category","Quantity","Location","LotNumber","ExpiryDate","ReceivingDate","ImageURL","LowStockThreshold","PackBarcode","PackMultiplier","HasExpiry","AcceptedPayments","PackBarcode2","PackMultiplier2","PackBarcode3","PackMultiplier3","EarnPoints"] },
  { action: "getStoreStock", table: "StoreStock", columns: ["Barcode","Name","Quantity","StoreLocation","UpdatedAt","LowStockThreshold"] },
  { action: "getStockMovements", table: "StockMovements", columns: ["Date","Barcode","Name","Quantity","FromLocation","ToLocation","MovedBy","ReferenceNo"] },
  { action: "getSuppliers", table: "Suppliers", columns: ["SupplierID","Name","ContactPerson","Phone","Email","Address","TaxID","CreatedAt"] },
  { action: "getTransactions", table: "Transactions", columns: ["OrderID","Date","TotalAmount","Tax","PaymentMethod","CartDetails","CashReceived","ChangeReturn","ShopPlatform","ReceiptType","CustomerInfo","DiscountAmount","Username","Status","CancelNote","TaxInvoiceNo","ReceiptNo"] },
  { action: "getTaxInvoices", table: "TaxInvoices", columns: ["TaxInvoiceNo","Date","OrderID","CustomerName","CustomerAddress","CustomerTaxID","TotalAmount","TaxAmount"] },
  { action: "getReturns", table: "Returns", columns: ["Timestamp","OrderID","Barcode","ProductName","ReturnQty","RefundAmount","ReturnNote","ActionBy"] },
  { action: "getShifts", table: "Shifts", columns: ["ShiftID","Status","OpenTime","CloseTime","ExpectedCash","ActualCash","Discrepancy","DetailsJSON"] },
  { action: "getExpenses", table: "Expenses", columns: ["Timestamp","Date","Description","Category","Amount","ReceiptFileURL","ItemsJSON"] },
  { action: "getCustomers", table: "Customers", columns: ["CustomerID","Name","Phone","TaxID","TaxAddress","Address","Points","Credits","LastInvoiceID","LastInvoiceDate","CreatedAt","UpdatedAt","PointsUpdatedAt","Email","LineID","Notes","Birthday","CreditsExpiry","PointsExpiry"] },
  { action: "getPointsHistory", table: "PointsHistory", columns: ["HistoryID","CustomerName","Date","Type","Points","Balance","Reference","OrderID","Actor"] },
  { action: "getCreditsHistory", table: "CreditsHistory", columns: ["HistoryID","CustomerName","Date","Type","Credits","Balance","Reference","OrderID","Actor"] },
  { action: "getPets", table: "Pets", columns: ["PetID","CustomerName","PetName","Species","Breed","BirthDate","Weight","Color","VaccineDate","NextVaccineDate","MedicalNotes","Allergies","PhotoURL","Notes","Status","CreatedAt","UpdatedAt"] },
  { action: "getPackages", table: "Packages", columns: ["PackageID","Name","Price","Points","BonusPoints","Description","Status","CreatedAt","PackageType","SessionCount","ExpiryDays","BonusSessions","BonusServiceName","BonusServiceSessions","Subtype","RewardType","RewardRef","RewardQty","RewardName"] },
  { action: "getCustomerPackages", table: "CustomerPackages", columns: ["ID","CustomerName","Phone","PackageID","PackageName","PackageType","TotalSessions","UsedSessions","PurchaseDate","ExpiryDate","Status","PaidAmount","Actor","BonusServiceName","BonusServiceSessions","BonusServiceUsed"] },
  { action: "getPackageUsage", table: "PackageUsage", columns: ["ID","CustomerPackageID","CustomerName","Date","SessionsUsed","Note","OrderID","Actor"] },
  { action: "getCashCoupons", table: "CashCoupons", columns: ["ID","CustomerName","Phone","TemplateName","PaidAmount","BonusAmount","TotalCredit","UsedCredit","RemainingCredit","PurchaseDate","ExpiryDate","Status","Actor"] },
  { action: "getCoupons", table: "Coupons", columns: ["CouponID","Name","Type","Value","Price","MinOrderAmount","ExpiryDays","Description","Status","CreatedAt","FreeItemBarcode","FreeItemName"] },
  { action: "getCustomerCoupons", table: "CustomerCoupons", columns: ["ID","CustomerName","CouponID","CouponName","Type","Value","MinOrderAmount","Price","Status","IssuedAt","ExpiryDate","UsedAt","OrderID","IssuedBy","FreeItemBarcode","FreeItemName"] },
  { action: "getPromotions", table: "Promotions", columns: ["PromoID","Name","ConditionType","ConditionValue1","ConditionValue2","DiscountType","DiscountValue","Status","ExpiryDate","StartDate","EndDate","ActiveDays","BonusPoints","DiscountValue2"] },
  { action: "getUsers", table: "Users", columns: ["UserID","Username","DisplayName","Role","IsActive","CreatedAt","LastLogin"] },
];

const NUMERIC_COLS = new Set(["CostPrice","Price","WholesalePrice","ShopeePrice","LazadaPrice","LinemanPrice","GrabFoodPrice","Quantity","LowStockThreshold","PackMultiplier","PackMultiplier2","PackMultiplier3","TotalAmount","Tax","CashReceived","ChangeReturn","DiscountAmount","TaxAmount","ReturnQty","RefundAmount","ExpectedCash","ActualCash","Discrepancy","Amount","Points","Credits","Balance","SessionsUsed","TotalSessions","UsedSessions","PaidAmount","BonusAmount","TotalCredit","UsedCredit","RemainingCredit","BonusPoints","SessionCount","ExpiryDays","BonusSessions","BonusServiceSessions","BonusServiceUsed","RewardQty","Value","MinOrderAmount","DiscountValue","DiscountValue2","UnitCost","TotalCost","OrderTotalCost"]);
const JSONB_COLS = new Set(["CartDetails","CustomerInfo","DetailsJSON","ItemsJSON"]);
const TIMESTAMP_COLS = new Set(["Date","Timestamp","UpdatedAt","CreatedAt","OpenTime","CloseTime","IssuedAt","UsedAt","PurchaseDate","LastLogin","PointsUpdatedAt"]);

function coerce(col, value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (NUMERIC_COLS.has(col)) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  if (JSONB_COLS.has(col)) {
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return null; }
  }
  if (TIMESTAMP_COLS.has(col)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return String(value);
}

// ชีต Products บางร้านใช้หัวคอลัมน์ภาษาไทย — map แบบเดียวกับ fetchApi ใน src/api.js
function normalizeProduct(item) {
  const isVat = (v) => v === "VAT" || v === "NON VAT";
  return {
    ...item,
    VatStatus: (isVat(item.Price) ? item.Price : item.VatStatus) || "VAT",
    CostPrice: item.CostPrice || item["ต้นทุน"] || 0,
    Price: (!isVat(item.Price) && item.Price) ? item.Price : (item["ขายปลีก"] || item["ราคาปลีก"] || item["ราคา"] || 0),
    WholesalePrice: item.WholesalePrice || item["ขายส่ง"] || item["ราคาส่ง"] || 0,
    ShopeePrice: item.ShopeePrice || item["shopee"] || item["shoppe"] || 0,
    LazadaPrice: item.LazadaPrice || item["lazada"] || 0,
    LinemanPrice: item.LinemanPrice || item["line"] || item["lineman"] || 0,
    GrabFoodPrice: item.GrabFoodPrice || item["grab"] || item["grabfood"] || 0,
    Category: item.Category || item["ประเภท"] || item["หมวดหมู่"] || "ทั่วไป",
  };
}

async function fetchRows(action) {
  const res = await fetch(`${GAS_API_URL}?action=${action}`);
  if (!res.ok) throw new Error(`GAS API ${action}: HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function tableIsEmpty(table) {
  const res = await fetch(`${REST_URL}/${encodeURIComponent(table)}?select=id&limit=1`, {
    headers: AUTH_HEADERS,
  });
  if (!res.ok) throw new Error(`ตรวจตาราง ${table} ไม่สำเร็จ: HTTP ${res.status} — รัน 0001_initial_schema.sql หรือยัง?`);
  return (await res.json()).length === 0;
}

async function insertBatch(table, columns, rows) {
  const cols = columns.map((c) => `"${c}"`).join(",");
  const res = await fetch(`${REST_URL}/${encodeURIComponent(table)}?columns=${encodeURIComponent(cols)}`, {
    method: "POST",
    headers: {
      ...AUTH_HEADERS,
      "Content-Type": "application/json",
      // missing=default: คอลัมน์ที่ไม่ได้ส่งมาใช้ค่า default ของตาราง (เช่น VatStatus='VAT')
      Prefer: "return=minimal,missing=default",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`insert ${table}: HTTP ${res.status} — ${await res.text()}`);
}

async function main() {
  console.log(`🚀 เริ่มย้ายข้อมูล\n   จาก: ${GAS_API_URL.slice(0, 60)}...\n   ไป : ${REST_URL}\n`);
  let totalRows = 0;

  for (const { action, table, columns } of TABLES) {
    process.stdout.write(`▸ ${table.padEnd(18)} `);
    try {
      if (!(await tableIsEmpty(table))) {
        console.log("ข้าม (มีข้อมูลอยู่แล้ว)");
        continue;
      }
      const raw = await fetchRows(action);
      if (raw.length === 0) { console.log("ไม่มีข้อมูลในชีต"); continue; }

      const rows = raw.map((r) => {
        const src = table === "Products" ? normalizeProduct(r) : r;
        const out = {};
        for (const col of columns) {
          const v = coerce(col, src[col]);
          // วันที่ว่างต้องคง null ไว้ ไม่ให้ default now() ทำให้บิลเก่ากลายเป็นบิลวันนี้
          if (v !== null || TIMESTAMP_COLS.has(col)) out[col] = v;
        }
        return out;
      }).filter((r) => Object.values(r).some((v) => v !== null));

      for (let i = 0; i < rows.length; i += 500) {
        await insertBatch(table, columns, rows.slice(i, i + 500));
      }
      totalRows += rows.length;
      console.log(`✅ ${rows.length} แถว`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  console.log(`\n🏁 เสร็จสิ้น รวม ${totalRows} แถว`);
  console.log(`\n⚠️  อย่าลืม:`);
  console.log(`   1. ตาราง Users ไม่มีรหัสผ่าน (API เดิมไม่ส่งออกมา) — ตั้งรหัสใหม่ด้วย SQL:`);
  console.log(`      update "Users" set "Password" = crypt('รหัสใหม่', gen_salt('bf')) where "Username" = 'admin';`);
  console.log(`   2. ตรวจนับยอดเทียบกับชีตเดิม (จำนวนแถว, ยอดขายรวม, สต็อกรวม)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

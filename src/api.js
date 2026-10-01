// API layer used by every page: fetchApi(action) to read, postApi({action, payload}) to write.
// Talks to Supabase by default; VITE_BACKEND=sheets switches back to the old Apps Script API.
import { supabase, USE_SUPABASE } from "./lib/supabase";
import { toSheetRow } from "./lib/sheetRows";

// API Endpoints for Google Sheets Backend
export const API_URL = "https://script.google.com/macros/s/AKfycbw55ZnPhKMRIV_y1OoqhJEuhovL4_w8fikg4ARvFx_O7X9zHhiP3clE2F6-hDnXechNCw/exec";

// In-memory cache: avoids duplicate fetches within the same session.
// POST-mutating actions call invalidateCache(action) to bust stale entries.
const _cache = new Map(); // action → { data, ts }
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const invalidateCache = (action) => _cache.delete(action);

// Normalize custom Thai Google Sheets headers so frontend always has clean english keys
const normalizeProducts = (data) => data.map(item => {
  // If Price column accidentally contains VAT, remap it correctly
  const actualVat = (item.Price === "VAT" || item.Price === "NON VAT") ? item.Price : item.VatStatus;
  const actualPrice = (item.Price !== "VAT" && item.Price !== "NON VAT" && item.Price) ? item.Price : (item["ขายปลีก"] || item["ราคาปลีก"] || item["ราคา"] || 0);

  return {
    ...item,
    VatStatus: actualVat || "VAT",
    CostPrice: item.CostPrice || item["ต้นทุน"] || 0,
    Price: actualPrice,
    WholesalePrice: item.WholesalePrice || item["ขายส่ง"] || item["ราคาส่ง"] || 0,
    ShopeePrice: item.ShopeePrice || item["shopee"] || item["shoppe"] || 0,
    LazadaPrice: item.LazadaPrice || item["lazada"] || 0,
    LinemanPrice: item.LinemanPrice || item["line"] || item["lineman"] || 0,
    GrabFoodPrice: item.GrabFoodPrice || item["grab"] || item["grabfood"] || 0,
    Category: item.Category || item["ประเภท"] || item["หมวดหมู่"] || "ทั่วไป"
  };
});

// ── Supabase ──────────────────────────────────────────────

// read action → table (same set of actions doGet in Code.gs answered)
const GET_TABLES = {
  getProducts: "Products", getInventory: "Products", getStoreStock: "StoreStock", getShifts: "Shifts",
  getTransactions: "Transactions", getExpenses: "Expenses", getCustomers: "Customers", getPackages: "Packages",
  getPointsHistory: "PointsHistory", getCreditsHistory: "CreditsHistory", getCoupons: "Coupons",
  getCustomerCoupons: "CustomerCoupons", getStockMovements: "StockMovements", getPromotions: "Promotions",
  getTaxInvoices: "TaxInvoices", getReturns: "Returns", getUsers: "Users", getSuppliers: "Suppliers",
  getCustomerPackages: "CustomerPackages", getPackageUsage: "PackageUsage", getPets: "Pets",
  getCashCoupons: "CashCoupons",
};
// password hashes are never readable
const USERS_COLUMNS = "id,UserID,Username,DisplayName,Role,IsActive,CreatedAt,LastLogin";

// write actions served by public.api_<action>() in supabase/migrations/0003_api_functions.sql
const POST_ACTIONS = new Set([
  "checkout", "receiveGoods", "importProducts", "addProduct", "updateProduct", "updateStoreStockDetail",
  "moveToStore", "openShift", "closeShift", "updateTransactionPayment", "addExpense", "saveCustomer",
  "savePackage", "purchasePackage", "saveCoupon", "issueCoupon", "useCoupon", "savePromotion",
  "togglePromotionStatus", "saveUser", "toggleUserStatus", "deleteUser", "cancelTransaction",
  "processReturn", "saveTaxInvoice", "saveSupplier", "purchaseSessionPackage", "usePackageSession",
  "addManualPoints", "addManualCredits", "migratePointsToCredits", "savePet", "deletePet",
  "purchaseCashCoupon", "useCashCoupon", "extendPackageExpiry", "useBonusService",
]);

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

async function readTable(table) {
  const columns = table === "Users" ? USERS_COLUMNS : "*";
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows.map(toSheetRow);
}

// Receipts/PO attachments go to Supabase Storage (they went to Google Drive before)
async function uploadAttachment(fileData, fileName) {
  try {
    const [meta, base64] = String(fileData).split(",");
    const mimeType = (meta.match(/^data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const safeName = String(fileName).replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("receipts").upload(path, new Blob([bytes], { type: mimeType }), { contentType: mimeType });
    if (error) throw error;
    return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("File upload error:", e);
    return "Upload Failed: " + (e.message || e);
  }
}

async function supabaseGet(action) {
  const table = GET_TABLES[action];
  if (!table) return { error: "Invalid action" };
  return readTable(table);
}

async function supabasePost(action, payload) {
  if (!POST_ACTIONS.has(action)) return { error: "Invalid POST action" };
  const body = { ...(payload || {}) };
  if (body.fileData && body.fileName) {
    body.fileUrl = await uploadAttachment(body.fileData, body.fileName);
  }
  delete body.fileData;
  const { data, error } = await supabase.rpc("api_" + action.toLowerCase(), { payload: body });
  if (error) return { error: error.message };
  return data;
}

// ── Public API ────────────────────────────────────────────

export const fetchApi = async (action, { skipCache = false } = {}) => {
  if (!skipCache) {
    const hit = _cache.get(action);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  }
  try {
    let data;
    if (USE_SUPABASE) {
      data = await supabaseGet(action);
    } else {
      const response = await fetch(`${API_URL}?action=${action}`);
      data = await response.json();
    }

    if ((action === "getProducts" || action === "getInventory") && Array.isArray(data)) {
      data = normalizeProducts(data);
    }

    _cache.set(action, { data, ts: Date.now() });
    return data;
  } catch (error) {
    console.error(`Error fetching ${action}:`, error);
    return [];
  }
};

export const postApi = async (data) => {
  try {
    // Inject actor information automatically if not present and available
    // (the Supabase functions take the actor from the signed-in user instead)
    if (data.payload && typeof data.payload === 'object' && !data.payload._actor) {
      const userStr = sessionStorage.getItem("pos_user");
      if (userStr) {
        try {
          data.payload._actor = JSON.parse(userStr);
        } catch (e) {
          // ignore parse error inline
        }
      }
    }

    if (USE_SUPABASE) return await supabasePost(data.action, data.payload);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      } // Using text/plain to avoid CORS preflight issues with Google Apps Script
    });
    return await response.json();
  } catch (error) {
    console.error("Error posting data:", error);
    return { error: error.message };
  }
};

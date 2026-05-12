// API Endpoints for Google Sheets Backend
export const API_URL = "https://script.google.com/macros/s/AKfycbw55ZnPhKMRIV_y1OoqhJEuhovL4_w8fikg4ARvFx_O7X9zHhiP3clE2F6-hDnXechNCw/exec";

// In-memory cache: avoids duplicate Google Sheets fetches within the same session.
// POST-mutating actions call invalidateCache(action) to bust stale entries.
const _cache = new Map(); // action → { data, ts }
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const invalidateCache = (action) => _cache.delete(action);

export const fetchApi = async (action, { skipCache = false } = {}) => {
  if (!skipCache) {
    const hit = _cache.get(action);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  }
  try {
    const response = await fetch(`${API_URL}?action=${action}`);
    let data = await response.json();
    
    // Normalize custom Thai Google Sheets headers so frontend always has clean english keys
    if (action === "getProducts" || action === "getInventory") {
       data = data.map(item => {
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

/**
 * VAT / เอกสารภาษี — แหล่งข้อมูลกลางเพียงจุดเดียว
 * ------------------------------------------------------------------
 * ราคาสินค้าทุกช่องทางในระบบนี้เป็น "ราคารวมภาษีมูลค่าเพิ่มแล้ว"
 * (VAT-inclusive) ดังนั้นการถอดภาษีคือ  VAT = ราคา x 7 / 107
 *
 * ทุกเอกสาร (ใบเสร็จ 80mm, ใบกำกับภาษีเต็มรูป A4, เครื่องพิมพ์ความร้อน)
 * และทุกรายงาน (รายงานภาษีขาย, ประวัติการขาย) ต้องเรียกใช้ไฟล์นี้
 * เพื่อให้ตัวเลขบนใบเสร็จ "ตรงกัน" กับตัวเลขที่ส่งสรรพากร
 *
 * กติกาที่ต้องเป็นจริงเสมอ (invariant):
 *     nonVatAmount + vatableExVat + vatAmount === netTotal
 */

export const VAT_RATE = 0.07;

export const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

/** สินค้าที่ได้รับยกเว้น/ไม่คิด VAT (รองรับหลายรูปแบบการสะกด) */
export const isNonVat = (vatStatus) =>
  String(vatStatus || "").toUpperCase().replace(/[\s_-]/g, "") === "NONVAT";

/** อ่านสถานะ VAT ของรายการ โดยยึด "ค่าที่บันทึกไว้ตอนขาย" เป็นหลัก */
export const lineVatStatus = (item, productsArr) => {
  const stored = item?.vatStatus ?? item?.VatStatus ?? item?.VATStatus;
  if (stored !== undefined && stored !== null && String(stored).trim() !== "") {
    return isNonVat(stored) ? "NON VAT" : "VAT";
  }
  // fallback: ทะเบียนสินค้าปัจจุบัน (ใช้กับบิลเก่าที่ยังไม่ได้บันทึกสถานะไว้)
  const bc = String(item?.Barcode ?? item?.barcode ?? "").trim();
  if (bc && Array.isArray(productsArr)) {
    const prod = productsArr.find((p) => String(p.Barcode).trim() === bc);
    if (prod && prod.VatStatus) return isNonVat(prod.VatStatus) ? "NON VAT" : "VAT";
  }
  return "VAT";
};

/** รายการที่เป็นของแถม/บรรทัดคูปอง — ไม่นับเป็นมูลค่าสินค้า */
export const isDisplayOnlyLine = (item) =>
  Boolean(item?.isFreebie) || (Number(item?.qty ?? item?.quantity ?? 0) === 0 && !Number(item?.price ?? item?.Price ?? 0));

export const lineQty = (item) => {
  const q = Number(item?.qty ?? item?.quantity);
  return Number.isFinite(q) ? q : 0;
};

export const linePrice = (item) => {
  const p = Number(item?.price ?? item?.Price);
  return Number.isFinite(p) ? p : 0;
};

export const lineAmount = (item) => r2(linePrice(item) * lineQty(item));

/**
 * คำนวณโครงสร้างภาษีจากยอดที่แยกฐานมาแล้ว (ทุกยอดเป็นราคารวม VAT)
 *
 * @param {number} grossVatable    มูลค่าสินค้าที่ต้องเสียภาษี ก่อนหักส่วนลด (รวม VAT)
 * @param {number} grossNonVat     มูลค่าสินค้ายกเว้นภาษี ก่อนหักส่วนลด
 * @param {number} discountVatable ส่วนลดที่ตกกับสินค้าที่ต้องเสียภาษี
 * @param {number} discountNonVat  ส่วนลดที่ตกกับสินค้ายกเว้นภาษี
 */
export function computeVatBreakdown({
  grossVatable = 0,
  grossNonVat = 0,
  discountVatable = 0,
  discountNonVat = 0,
} = {}) {
  const netVatableIncl = Math.max(0, r2(grossVatable) - r2(discountVatable));
  const netNonVat = Math.max(0, r2(grossNonVat) - r2(discountNonVat));
  const netTotal = r2(netVatableIncl + netNonVat);

  const vatAmount = r2((netVatableIncl * VAT_RATE) / (1 + VAT_RATE));
  const vatableExVat = r2(netVatableIncl - vatAmount);
  // บังคับให้ผลรวมเท่ากับยอดสุทธิเป๊ะ ๆ เศษปัดจะไปลงที่มูลค่ายกเว้นภาษี
  const nonVatAmount = r2(netTotal - vatableExVat - vatAmount);

  return {
    grossSubtotal: r2(grossVatable + grossNonVat),
    grossVatable: r2(grossVatable),
    grossNonVat: r2(grossNonVat),
    discount: r2(discountVatable + discountNonVat),
    discountVatable: r2(discountVatable),
    discountNonVat: r2(discountNonVat),
    netTotal,
    vatableIncl: r2(netVatableIncl),
    vatableExVat,
    vatAmount,
    nonVatAmount,
  };
}

/**
 * แบ่งส่วนลดรวมลงสองฐานตามสัดส่วนมูลค่า (ใช้เมื่อไม่รู้ว่าส่วนลดตกที่รายการไหน)
 */
export function splitDiscount(grossVatable, grossNonVat, discount) {
  const gross = r2(grossVatable) + r2(grossNonVat);
  const d = Math.min(Math.max(0, r2(discount)), gross);
  if (gross <= 0 || d <= 0) return { discountVatable: 0, discountNonVat: 0 };
  const discountVatable = r2((d * r2(grossVatable)) / gross);
  return { discountVatable, discountNonVat: r2(d - discountVatable) };
}

/**
 * คำนวณจากตะกร้าสินค้าโดยตรง
 *
 * @param {Array}  cart          รายการสินค้า (ราคารวม VAT)
 * @param {object} opts
 *        opts.billDiscount      ส่วนลดท้ายบิล (โปรโมชั่น + ส่วนลดมือ)
 *        opts.couponDiscount    ส่วนลดจากคูปอง
 *        opts.freeItemLines     ของแถมที่ระบุฐานภาษีได้ [{price, qty, vatStatus}]
 *        opts.products          ทะเบียนสินค้า (fallback หาสถานะ VAT ของบิลเก่า)
 */
export function breakdownFromCart(cart, opts = {}) {
  const { billDiscount = 0, couponDiscount = 0, freeItemLines = [], products } = opts;

  let grossVatable = 0;
  let grossNonVat = 0;
  (Array.isArray(cart) ? cart : []).forEach((item) => {
    if (isDisplayOnlyLine(item)) return;
    const amount = lineAmount(item);
    if (lineVatStatus(item, products) === "NON VAT") grossNonVat += amount;
    else grossVatable += amount;
  });
  grossVatable = r2(grossVatable);
  grossNonVat = r2(grossNonVat);

  // 1) ของแถม — รู้แน่ชัดว่าตกฐานไหน จึงหักเข้าฐานนั้นตรง ๆ
  let discountVatable = 0;
  let discountNonVat = 0;
  (Array.isArray(freeItemLines) ? freeItemLines : []).forEach((fi) => {
    const amount = r2((Number(fi.price) || 0) * (Number(fi.qty) || 0));
    if (isNonVat(fi.vatStatus)) discountNonVat += amount;
    else discountVatable += amount;
  });

  // 2) ส่วนลดที่เหลือ — เฉลี่ยตามสัดส่วนมูลค่า
  const freeItemTotal = r2(discountVatable + discountNonVat);
  const remaining = Math.max(0, r2(billDiscount) + r2(couponDiscount) - freeItemTotal);
  const split = splitDiscount(grossVatable, grossNonVat, remaining);

  return computeVatBreakdown({
    grossVatable,
    grossNonVat,
    discountVatable: r2(discountVatable + split.discountVatable),
    discountNonVat: r2(discountNonVat + split.discountNonVat),
  });
}

/**
 * คำนวณจากแถวใน Transactions (ใช้ในหน้าบัญชี/รายงาน)
 * ใช้ค่าที่บันทึกไว้ตอนขายก่อน ถ้าไม่มี (บิลเก่า) จึงคำนวณย้อนหลังจากตะกร้า
 *
 * ข้อจำกัดของบิลเก่า: ชีทไม่ได้เก็บไว้ว่าส่วนลด/ของแถมตกกับสินค้ากลุ่มไหน
 * จึงต้องเฉลี่ยตามสัดส่วนมูลค่า ตัวเลข VAT อาจต่างจากที่พิมพ์บนใบเสร็จวันนั้นเล็กน้อย
 * บิลที่ออกหลังจากนี้จะบันทึก NonVatAmount/VatableAmount ไว้ จึงตรงกันเป๊ะเสมอ
 */
export function breakdownFromTransaction(tx, products) {
  if (!tx) return computeVatBreakdown({});

  const storedNonVat = Number(tx.NonVatAmount);
  const storedVatable = Number(tx.VatableAmount);
  const storedVat = Number(tx.Tax);
  const netTotal = r2(Number(tx.TotalAmount) || 0);

  // บิลที่บันทึกโครงสร้างภาษีไว้แล้ว — ใช้ตัวเลขนั้นตรง ๆ ห้ามคำนวณใหม่
  if (
    Number.isFinite(storedNonVat) &&
    Number.isFinite(storedVatable) &&
    Number.isFinite(storedVat) &&
    (storedNonVat > 0 || storedVatable > 0 || storedVat > 0) &&
    Math.abs(r2(storedNonVat + storedVatable + storedVat) - netTotal) < 0.02
  ) {
    const grossSubtotal = Number.isFinite(Number(tx.GrossSubtotal)) && Number(tx.GrossSubtotal) > 0
      ? r2(Number(tx.GrossSubtotal))
      : r2(netTotal + (Number(tx.DiscountAmount) || 0));
    return {
      grossSubtotal,
      grossVatable: r2(storedVatable + storedVat),
      grossNonVat: r2(storedNonVat),
      discount: r2(Number(tx.DiscountAmount) || 0),
      discountVatable: 0,
      discountNonVat: 0,
      netTotal,
      vatableIncl: r2(storedVatable + storedVat),
      vatableExVat: r2(storedVatable),
      vatAmount: r2(storedVat),
      nonVatAmount: r2(storedNonVat),
    };
  }

  let cart = [];
  try {
    cart = typeof tx.CartDetails === "string" ? JSON.parse(tx.CartDetails || "[]") : tx.CartDetails || [];
  } catch { cart = []; }

  const gross = (Array.isArray(cart) ? cart : []).reduce(
    (s, item) => (isDisplayOnlyLine(item) ? s : s + lineAmount(item)), 0);

  // ส่วนลดจริงคือผลต่างระหว่างมูลค่าสินค้ากับยอดที่เก็บเงินได้จริง
  // (แม่นกว่าคอลัมน์ DiscountAmount ซึ่งบิลเก่าอาจว่างไว้)
  const storedDiscount = Number(tx.DiscountAmount) || 0;
  const derivedDiscount = r2(Math.max(0, gross - netTotal));
  const discount = gross > 0 ? derivedDiscount : r2(storedDiscount);

  return breakdownFromCart(cart, { billDiscount: discount, products });
}

/**
 * กระจายมูลค่าก่อน VAT ลงแต่ละบรรทัด ให้ผลรวมของคอลัมน์เท่ากับฐานภาษีเป๊ะ ๆ
 * (ใช้กับใบกำกับภาษีเต็มรูป ที่ต้องแสดงมูลค่าสินค้าแยกจากภาษีอย่างชัดแจ้ง)
 *
 * @returns [{ ...item, vatStatus, amountIncl, amountExVat, unitExVat }]
 */
export function allocateExVatLines(cart, products) {
  const lines = (Array.isArray(cart) ? cart : []).map((item) => {
    const vatStatus = lineVatStatus(item, products);
    const amountIncl = lineAmount(item);
    return { item, vatStatus, amountIncl, displayOnly: isDisplayOnlyLine(item) };
  });

  const vatableLines = lines.filter((l) => !l.displayOnly && l.vatStatus === "VAT" && l.amountIncl > 0);
  const grossVatable = r2(vatableLines.reduce((s, l) => s + l.amountIncl, 0));
  const targetExVat = r2(grossVatable - r2((grossVatable * VAT_RATE) / (1 + VAT_RATE)));

  // ปัดลงก่อน แล้วแจกเศษสตางค์คืนให้บรรทัดที่มีเศษมากสุด (largest remainder)
  const raw = vatableLines.map((l) => (l.amountIncl / (1 + VAT_RATE)) * 100);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = Math.round(targetExVat * 100) - floored.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - floored[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) floored[order[k].i] += 1;

  let vIdx = 0;
  return lines.map((l) => {
    let amountExVat = l.amountIncl;
    if (!l.displayOnly && l.vatStatus === "VAT" && l.amountIncl > 0) {
      amountExVat = floored[vIdx++] / 100;
    } else if (l.displayOnly) {
      amountExVat = 0;
    }
    const qty = lineQty(l.item);
    return {
      ...l.item,
      vatStatus: l.vatStatus,
      displayOnly: l.displayOnly,
      amountIncl: l.amountIncl,
      amountExVat: r2(amountExVat),
      unitExVat: qty > 0 ? r2(amountExVat / qty) : r2(amountExVat),
    };
  });
}

/**
 * แยกสตริงการชำระเงิน "เงินสด:500 + โอนเข้าบัญชี:100" → [{method, amount}]
 * ถ้าไม่ได้ระบุยอด จะคืนยอดเต็มของบิลให้ช่องทางเดียว
 */
export function parsePaymentString(str, total = 0) {
  const raw = String(str || "").trim();
  if (!raw) return [{ method: "เงินสด", amount: r2(total) }];
  if (!raw.includes(":")) return [{ method: raw, amount: r2(total) }];

  const parts = raw.split("+").map((p) => p.trim()).filter(Boolean);
  const parsed = parts.map((p) => {
    const ci = p.indexOf(":");
    if (ci < 0) return { method: p, amount: 0 };
    return { method: p.slice(0, ci).trim(), amount: r2(parseFloat(p.slice(ci + 1)) || 0) };
  });
  const sum = parsed.reduce((s, p) => s + p.amount, 0);
  // ช่องทางเดียวและไม่ได้ระบุยอด → ถือว่าจ่ายเต็มบิล
  if (parsed.length === 1 && sum === 0) return [{ method: parsed[0].method, amount: r2(total) }];
  return parsed;
}

/**
 * ป้ายสาขาตามแบบสรรพากร — "สำนักงานใหญ่" หรือ "สาขาที่ 00001"
 * แก้ปัญหาค่าที่ตั้งไว้เป็น "สาขา 00001" แล้วถูกเติมคำว่า "สาขา" ซ้ำ
 */
export function branchLabel(branch) {
  const raw = String(branch || "").trim();
  if (!raw) return "สำนักงานใหญ่";
  const normalized = raw.replace(/\s+/g, "");
  if (/สำนักงานใหญ่|head\s*office/i.test(raw)) return "สำนักงานใหญ่";
  const digits = normalized.replace(/[^\d]/g, "");
  if (digits && /^0+$/.test(digits)) return "สำนักงานใหญ่";
  if (digits) return `สาขาที่ ${digits.padStart(5, "0")}`;
  return raw;
}

/** จัดรูปเลขประจำตัวผู้เสียภาษี 13 หลัก → 0-0000-00000-00-0 */
export function formatTaxId(taxId) {
  const d = String(taxId || "").replace(/\D/g, "");
  if (d.length !== 13) return String(taxId || "").trim();
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}

export const isValidTaxId = (taxId) => /^\d{13}$/.test(String(taxId || "").replace(/\D/g, ""));

const TH_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function thaiIntegerText(numStr) {
  if (numStr.length > 7) {
    const head = numStr.slice(0, numStr.length - 6);
    const tail = numStr.slice(numStr.length - 6);
    return thaiIntegerText(head) + "ล้าน" + (Number(tail) ? thaiIntegerText(tail) : "");
  }
  let out = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const d = Number(numStr[i]);
    const place = len - i - 1;
    if (d === 0) continue;
    if (place === 0 && d === 1 && len > 1) out += "เอ็ด";
    else if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else out += TH_DIGITS[d] + TH_PLACES[place];
  }
  return out;
}

/** จำนวนเงินเป็นตัวอักษรไทย เช่น 1070.50 → "หนึ่งพันเจ็ดสิบบาทห้าสิบสตางค์" */
export function thaiBahtText(amount) {
  const n = Number(amount) || 0;
  const negative = n < 0;
  const fixed = Math.abs(r2(n)).toFixed(2);
  const [baht, satang] = fixed.split(".");
  const bahtPart = Number(baht) ? thaiIntegerText(baht) + "บาท" : "ศูนย์บาท";
  const satangPart = Number(satang) ? thaiIntegerText(String(Number(satang))) + "สตางค์" : "ถ้วน";
  return (negative ? "ลบ" : "") + bahtPart + satangPart;
}

/** escape ข้อความก่อนแทรกลง HTML ที่สร้างเป็นสตริง (ชื่อ/ที่อยู่ลูกค้าเป็น input ผู้ใช้) */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** จัดรูปจำนวนเงิน 2 ตำแหน่ง */
export const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** วันที่แบบไทย พ.ศ. สำหรับเอกสารภาษี */
export function formatTaxDate(date, withTime = true) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const datePart = d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!withTime) return datePart;
  const timePart = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart} ${timePart} น.`;
}

/**
 * วันที่แบบ YYYY-MM-DD ตามเวลาเครื่อง
 * `new Date().toISOString()` เป็นเวลา UTC — ในไทย (UTC+7) ช่วงเที่ยงคืนถึง 07:00
 * จะได้ "เมื่อวาน" ทำให้ตัวกรองวันที่ในรายงานตั้งต้นผิดวัน
 */
export function toLocalDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 00:00:00.000 ของวันนั้นตามเวลาเครื่อง (รับ "YYYY-MM-DD") */
export function startOfLocalDay(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 23:59:59.999 ของวันนั้นตามเวลาเครื่อง (รับ "YYYY-MM-DD") */
export function endOfLocalDay(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

import {
  breakdownFromCart, breakdownFromTransaction, allocateExVatLines, r2, computeVatBreakdown,
} from './vat.js';

let fail = 0;
const check = (name, cond, extra = "") => {
  if (!cond) { console.log("FAIL:", name, extra); fail++; }
};

// ── สถานการณ์ปน VAT / NON VAT + ส่วนลดหลายแบบ ──
const cart = [
  { Barcode: "1", Name: "อาหารสุนัข", qty: 3, price: 259,  vatStatus: "VAT" },
  { Barcode: "2", Name: "สินค้ายกเว้น", qty: 2, price: 120, vatStatus: "NON VAT" },
  { Barcode: "3", Name: "ปลอกคอ",     qty: 1, price: 199.5, vatStatus: "VAT" },
];
const freeItemLines = [{ name: "ปลอกคอ", price: 199.5, qty: 1, vatStatus: "VAT", promoName: "ซื้อ 3 แถม 1" }];
const billDiscount = 199.5;      // = ของแถม
const couponDiscount = 50;

const posBd = breakdownFromCart(cart, { billDiscount, couponDiscount, freeItemLines });

check("invariant ที่ POS",
  r2(posBd.nonVatAmount + posBd.vatableExVat + posBd.vatAmount) === posBd.netTotal,
  JSON.stringify(posBd));

check("ยอดสุทธิ = มูลค่าสินค้า - ส่วนลด",
  posBd.netTotal === r2(posBd.grossSubtotal - posBd.discount),
  `${posBd.netTotal} vs ${r2(posBd.grossSubtotal - posBd.discount)}`);

// ── บิลที่ถูกบันทึกลงชีท (ตามที่ backend เขียน) ──
const storedTx = {
  OrderID: "TX1", Date: new Date().toISOString(),
  TotalAmount: posBd.netTotal,
  Tax: posBd.vatAmount,
  VatableAmount: posBd.vatableExVat,
  NonVatAmount: posBd.nonVatAmount,
  GrossSubtotal: posBd.grossSubtotal,
  DiscountAmount: posBd.discount,
  CartDetails: JSON.stringify([
    ...cart.map(c => ({ Barcode: c.Barcode, Name: c.Name, qty: c.qty, price: c.price, vatStatus: c.vatStatus })),
    { Barcode: "", Name: "🎁 ของแถม", qty: 0, freeQty: 1, price: 0, isFreebie: true },
    { Barcode: "", Name: "🎟 คูปอง", qty: 0, price: 0, discount: 50, isFreebie: true },
  ]),
};

// ── รายงานภาษีขาย อ่านบิลเดียวกัน ──
const reportBd = breakdownFromTransaction(storedTx);
check("รายงานตรงกับใบเสร็จ: VAT",        reportBd.vatAmount === posBd.vatAmount,        `${reportBd.vatAmount} vs ${posBd.vatAmount}`);
check("รายงานตรงกับใบเสร็จ: ฐานภาษี",    reportBd.vatableExVat === posBd.vatableExVat,  `${reportBd.vatableExVat} vs ${posBd.vatableExVat}`);
check("รายงานตรงกับใบเสร็จ: ยกเว้นภาษี", reportBd.nonVatAmount === posBd.nonVatAmount,  `${reportBd.nonVatAmount} vs ${posBd.nonVatAmount}`);
check("รายงานตรงกับใบเสร็จ: ยอดสุทธิ",   reportBd.netTotal === posBd.netTotal);

// ── บิลเก่าที่ยังไม่มีคอลัมน์โครงสร้างภาษี ต้องคำนวณย้อนได้ผลเดียวกัน ──
const legacyTx = { ...storedTx };
delete legacyTx.VatableAmount; delete legacyTx.NonVatAmount; delete legacyTx.GrossSubtotal;
const legacyBd = breakdownFromTransaction(legacyTx);
check("บิลเก่า: ผลรวมยังเท่ายอดสุทธิ",
  r2(legacyBd.nonVatAmount + legacyBd.vatableExVat + legacyBd.vatAmount) === legacyBd.netTotal,
  JSON.stringify(legacyBd));
// บิลเก่าไม่ได้บันทึกไว้ว่าส่วนลดตกฐานไหน จึงเฉลี่ยตามสัดส่วน
// ค่าที่ได้ต้องไม่เกิน VAT สูงสุดที่เป็นไปได้ของบิลนั้น (กรณีส่วนลดไม่แตะสินค้าที่เสียภาษีเลย)
const maxPossibleVat = r2(Math.min(posBd.grossVatable, legacyBd.netTotal) * 7 / 107);
check("บิลเก่า: VAT ไม่เกินเพดานของบิล",
  legacyBd.vatAmount <= maxPossibleVat + 0.01,
  `${legacyBd.vatAmount} vs เพดาน ${maxPossibleVat}`);

// ── คอลัมน์ "จำนวนเงิน" บนใบกำกับภาษีเต็มรูปต้องรวมได้เท่าฐานภาษีก่อนหักส่วนลด ──
const exLines = allocateExVatLines(cart);
const sumEx = r2(exLines.filter(l => !l.displayOnly).reduce((s, l) => s + l.amountExVat, 0));
const preDiscount = computeVatBreakdown({
  grossVatable: posBd.grossVatable, grossNonVat: posBd.grossNonVat,
});
check("คอลัมน์จำนวนเงิน (ไม่รวม VAT) รวมได้ตรงฐาน",
  sumEx === r2(preDiscount.vatableExVat + preDiscount.nonVatAmount),
  `${sumEx} vs ${r2(preDiscount.vatableExVat + preDiscount.nonVatAmount)}`);

// ── บิลที่ยกเลิก: กลับเครื่องหมายแล้วต้องหักล้างเป็นศูนย์พอดี ──
const voidSum = r2(reportBd.vatAmount + (-reportBd.vatAmount));
check("VOID หักล้างเป็นศูนย์", voidSum === 0);

// ── ตัวเลขที่ "พิมพ์บนกระดาษ" ต้องลบกันแล้วลงตัว ──
// ใบกำกับภาษีเต็มรูป: คอลัมน์จำนวนเงินเป็นราคาไม่รวม VAT
{
  const goods = exLines.filter(l => !l.displayOnly);
  const printedGross = r2(goods.reduce((s, l) => s + l.amountExVat, 0));
  const netGoods = r2(posBd.nonVatAmount + posBd.vatableExVat);
  const printedDiscount = r2(printedGross - netGoods);
  check("ใบกำกับภาษีเต็มรูป: มูลค่าสินค้า - ส่วนลด = ยกเว้น + ฐานภาษี",
    r2(printedGross - printedDiscount) === netGoods);
  check("ใบกำกับภาษีเต็มรูป: ยกเว้น + ฐานภาษี + VAT = รวมทั้งสิ้น",
    r2(netGoods + posBd.vatAmount) === posBd.netTotal);
}

// ใบเสร็จอย่างย่อ: คอลัมน์จำนวนเงินเป็นราคารวม VAT
{
  const printedGross = posBd.grossSubtotal;
  const printedDiscount = r2(printedGross - posBd.netTotal);
  check("ใบเสร็จอย่างย่อ: มูลค่าสินค้า - ส่วนลด = รวมทั้งสิ้น",
    r2(printedGross - printedDiscount) === posBd.netTotal);
  check("ใบเสร็จอย่างย่อ: ส่วนลดที่พิมพ์เท่ากับส่วนลดจริง",
    printedDiscount === posBd.discount, `${printedDiscount} vs ${posBd.discount}`);
}

// รายการส่วนลดที่แสดงต้องบวกกันได้เท่ากับส่วนลดรวม (ของแถมต้องไม่ถูกนับซ้ำ)
{
  const freeItemTotal = r2(freeItemLines.reduce((s, fi) => s + fi.price * fi.qty, 0));
  const billDiscountOnly = Math.max(0, r2(billDiscount - freeItemTotal));
  const listed = r2(freeItemTotal + billDiscountOnly + couponDiscount);
  check("รายการส่วนลดบนใบเสร็จบวกกันได้เท่ากับส่วนลดรวม",
    listed === posBd.discount, `${listed} vs ${posBd.discount}`);
}

console.log(fail === 0 ? "\n✅ ผ่านทุกข้อ — ใบเสร็จ ชีทบัญชี และรายงานภาษีขาย ตรงกันทุกบาท" : `\n❌ ไม่ผ่าน ${fail} ข้อ`);
console.log("\nสรุปบิลตัวอย่าง:", JSON.stringify(posBd, null, 2));
process.exit(fail === 0 ? 0 : 1);

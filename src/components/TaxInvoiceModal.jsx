import { X, Printer } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";
import toast from "react-hot-toast";
import {
  breakdownFromCart, computeVatBreakdown, allocateExVatLines, parsePaymentString, branchLabel, r2,
  formatTaxId, thaiBahtText, escapeHtml, fmtMoney, formatTaxDate, lineQty, linePrice,
} from "../utils/vat";

async function getLogoBase64() {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1] || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export default function TaxInvoiceModal({
  isOpen, onClose, cart, paymentMethod, discountAmount = 0, freeItemLines = [],
  couponDiscount = 0, couponName = "", couponLines = [], tax, total, receiptType, customerInfo,
  taxInvoiceNo, receiptNo = "", issuedAt = null, breakdown: breakdownProp = null,
  cashReceived = 0, changeReturn = 0,
}) {
  const { settings } = usePrinter();

  if (!isOpen) return null;

  const paperMm = parseInt(settings.paperWidth) || 80;
  const isFullTaxInvoice = receiptType === "ใบกำกับภาษี";

  // ── วันที่ออกเอกสาร: ใช้วันที่ของรายการขาย ไม่ใช่เวลาที่กดพิมพ์ ──
  // (พิมพ์ใบเสร็จย้อนหลังจากหน้าบัญชีต้องได้วันที่เดิมเสมอ)
  const issuedDate = (() => {
    if (!issuedAt) return new Date();
    const d = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
    return isNaN(d.getTime()) ? new Date() : d;
  })();
  const issuedStr = formatTaxDate(issuedDate);

  // ── เลขที่เอกสาร: ต้องเป็นเลขรันจริงที่บันทึกไว้ในระบบบัญชีเท่านั้น ──
  const docNo = (isFullTaxInvoice ? taxInvoiceNo : receiptNo || taxInvoiceNo) || "";
  const isPreviewOnly = !docNo;

  let userObj = {};
  try { userObj = JSON.parse(sessionStorage.getItem("pos_user") || "{}"); } catch { /* ignore */ }
  const empName = userObj.displayName || userObj.name || userObj.username || "พนักงาน";

  // ── โครงสร้างภาษี: คำนวณจากแหล่งเดียวกับรายงานที่ส่งสรรพากร ──
  const hasLines = Array.isArray(cart) && cart.some(c => lineQty(c) > 0 || linePrice(c) > 0);
  const bd = breakdownProp || (hasLines
    ? breakdownFromCart(cart, { billDiscount: discountAmount, couponDiscount, freeItemLines })
    // สำรอง: ไม่มีรายการสินค้าให้แยกฐาน — ย้อนจากยอดสุทธิและ VAT ที่ส่งมา
    : computeVatBreakdown({
        grossVatable: (Number(tax) || 0) * (107 / 7),
        grossNonVat: Math.max(0, (Number(total) || 0) - (Number(tax) || 0) * (107 / 7)),
      }));

  // ใบกำกับภาษีเต็มรูปต้องแสดงมูลค่าสินค้าแยกออกจาก VAT อย่างชัดแจ้ง (ม.86/4(6)(7))
  const exVatLines = isFullTaxInvoice ? allocateExVatLines(cart) : null;

  const payments = parsePaymentString(paymentMethod, bd.netTotal);

  const posId = settings.posId || "POS-01";
  const branch = branchLabel(settings.shopBranch);
  const shopTaxIdFmt = formatTaxId(settings.shopTaxId);
  const hasNonVatItem = bd.nonVatAmount > 0;
  const amountText = thaiBahtText(bd.netTotal);

  // รายการส่วนลดที่แสดงต้องบวกกันได้เท่ากับ "รวมส่วนลด" พอดี
  // มูลค่าของแถมถูกรวมอยู่ใน discountAmount อยู่แล้ว จึงต้องหักออกจากบรรทัด
  // "ส่วนลดโปรโมชั่น" ไม่งั้นจะถูกนับซ้ำสองครั้งบนใบเสร็จ
  const freeItemTotal = freeItemLines.reduce(
    (sum, fi) => sum + (Number(fi.price) || 0) * (Number(fi.qty) || 0), 0);
  const billDiscountOnly = Math.max(0, r2(discountAmount) - r2(freeItemTotal));

  const discountRows = [
    ...freeItemLines.map(fi => ({
      label: `🎁 ${fi.name}${fi.promoName ? ` (${fi.promoName})` : ""}`,
      amount: (Number(fi.price) || 0) * (Number(fi.qty) || 0),
      tone: "green",
    })),
    ...(billDiscountOnly > 0 ? [{ label: "ส่วนลดโปรโมชั่น/ส่วนลดท้ายบิล", amount: billDiscountOnly, tone: "purple" }] : []),
    ...((couponLines && couponLines.length > 0
      ? couponLines
      : couponDiscount > 0 ? [{ name: couponName || "ส่วนลดจากคูปอง", discount: couponDiscount }] : []
    ).map(cl => ({ label: cl.name, amount: cl.discount, tone: "amber" }))),
  ].filter(d => Number(d.amount) > 0);

  const docTitle = isFullTaxInvoice
    ? "ใบกำกับภาษี / ใบเสร็จรับเงิน"
    : "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ";

  // ── ยอด "รวมมูลค่าสินค้า" และ "รวมส่วนลด" ที่พิมพ์ ──
  // คำนวณจากคอลัมน์จำนวนเงินที่พิมพ์จริง เพื่อให้เลขบนกระดาษลบกันแล้วลงตัวเสมอ
  //   ใบกำกับภาษีเต็มรูป : คอลัมน์เป็นราคาไม่รวม VAT  → ส่วนลดก็ต้องเป็นฐานไม่รวม VAT
  //   ใบเสร็จอย่างย่อ    : คอลัมน์เป็นราคารวม VAT     → ส่วนลดเป็นฐานรวม VAT
  const netGoodsValue = isFullTaxInvoice
    ? r2(bd.nonVatAmount + bd.vatableExVat)
    : bd.netTotal;
  const displayGross = isFullTaxInvoice
    ? r2((exVatLines || []).filter(l => !l.displayOnly).reduce((sum, l) => sum + l.amountExVat, 0))
    : bd.grossSubtotal;
  const displayDiscount = Math.max(0, r2(displayGross - netGoodsValue));

  // ── PRINT (thermal printer / browser) ───────────────────────
  const handlePrint = async () => {
    if (settings.enableDirectPrint) {
      const serverUrl = (settings.printServerUrl || "http://localhost:3001").replace(/\/$/, "");
      try {
        const logoBase64 = await getLogoBase64();
        const response = await fetch(`${serverUrl}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            // ใบกำกับภาษีเต็มรูปส่งราคาต่อหน่วยแบบไม่รวม VAT ไปด้วย
            items: exVatLines || cart,
            isTest: false,
            receiptType, paymentMethod, customerInfo,
            empName, posId,
            docNo, receiptNo, taxInvoiceNo,
            issuedAt: issuedDate.toISOString(),
            branchLabel: branch,
            // โครงสร้างภาษีชุดเดียวกับที่บันทึกลงบัญชี
            breakdown: bd,
            subtotal: bd.grossSubtotal, tax: bd.vatAmount, total: bd.netTotal,
            amountText,
            discountRows: isFullTaxInvoice ? [] : discountRows,
            displayGross, displayDiscount,
            discountAmount, freeItemLines, couponDiscount, couponName, couponLines,
            cashReceived, changeReturn,
            logoBase64,
          }),
        });
        const data = await response.json();
        if (!data.success) toast.error("พิมพ์ไม่สำเร็จ: " + data.message);
        else { toast.success("พิมพ์ใบเสร็จเรียบร้อยแล้ว"); onClose(); }
      } catch {
        toast.error(`เชื่อมต่อ Print Server ไม่ได้ (${serverUrl}) — เปิด .bat ค้างไว้หรือยัง?`);
      }
      return;
    }

    const esc = escapeHtml;

    const itemRows = (exVatLines || cart).map((item, i) => {
      const name = item.name || item.Name || "";
      const qty = lineQty(item);
      const unit = exVatLines ? item.unitExVat : linePrice(item);
      const amount = exVatLines ? item.amountExVat : (linePrice(item) * qty);
      const note = item.note || item.Note
        ? `<tr><td colspan="5" style="font-size:0.9em;padding-left:8px;color:#555">↳ ${esc(item.note || item.Note)}</td></tr>`
        : "";
      return `<tr>
        <td style="text-align:center;width:12px">${i + 1}</td>
        <td style="word-break:break-word;padding-right:4px;font-size:0.93em">${esc(name)}${item.vatStatus === "NON VAT" ? " (N)" : ""}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${fmtMoney(unit)}</td>
        <td style="text-align:right">${fmtMoney(amount)}</td>
      </tr>${note}`;
    }).join("");

    const discRowsHtml = discountRows.map(d => `
      <div class="flex-between" style="font-size:0.93em">
        <span>${esc(d.label)}</span>
        <span>-${fmtMoney(d.amount)}</span>
      </div>`).join("");

    const payRows = payments.map(p => `
      <div class="flex-between">
        <span>${esc(p.method)}</span>
        <span>${fmtMoney(p.amount)}</span>
      </div>`).join("");

    const buyerBlock = isFullTaxInvoice ? `
      <div style="font-size:0.88em;margin-bottom:4px">
        <div><b>ผู้ซื้อ:</b> ${esc(customerInfo?.customerName || customerInfo?.name || "-")}</div>
        <div><b>ที่อยู่:</b> ${esc(customerInfo?.customerAddress || customerInfo?.address || "-")}</div>
        <div><b>เลขประจำตัวผู้เสียภาษี:</b> ${esc(formatTaxId(customerInfo?.customerTaxId || customerInfo?.taxId || "-"))}</div>
        <div><b>สาขา:</b> ${esc(customerInfo?.customerBranch || "สำนักงานใหญ่")}</div>
      </div>
      <div class="hr"></div>` : "";

    const printHtml = `<!DOCTYPE html><html lang="th"><head>
      <meta charset="UTF-8">
      <title>${esc(docTitle)} ${esc(docNo)}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperMm}mm; padding:4mm 3mm; background:white; color:#000; }
        .center { text-align:center; }
        .bold   { font-weight:bold; }
        .hr     { border-top:1px dashed #999; margin:4px 0; }
        table   { width:100%; border-collapse:collapse; }
        td      { padding:2px; vertical-align:top; }
        .logo   { display:block; margin:0 auto 4px; max-height:${paperMm <= 58 ? "50px" : "80px"}; width:auto; filter:grayscale(100%); }
        .flex-between { display:flex; justify-content:space-between; gap:6px; margin:1px 0; }
        @media print { @page { size:${paperMm}mm auto; margin:0; } }
      </style>
    </head><body>

      <div class="center"><img class="logo" src="${window.location.origin}/logo.png" alt="" onerror="this.style.display='none'"/></div>
      <div class="center bold" style="font-size:1.1em">${esc(settings.shopName || "")}</div>
      <div class="center" style="font-size:0.9em">${esc(settings.shopAddress || "")}</div>
      ${settings.shopPhone ? `<div class="center" style="font-size:0.9em">โทร. ${esc(settings.shopPhone)}</div>` : ""}
      <div class="center" style="font-size:0.9em">เลขประจำตัวผู้เสียภาษี ${esc(shopTaxIdFmt)}</div>
      <div class="center" style="font-size:0.9em">${esc(branch)}</div>
      <div class="center bold" style="margin-top:3px">${esc(docTitle)}</div>
      ${isPreviewOnly ? `<div class="center" style="font-size:0.85em">** ตัวอย่าง — ยังไม่ออกเลขที่เอกสาร **</div>` : ""}
      <div class="hr"></div>

      <div class="flex-between"><span>เลขที่</span><span>${esc(docNo || "-")}</span></div>
      ${isFullTaxInvoice && receiptNo ? `<div class="flex-between"><span>เลขที่ใบเสร็จ</span><span>${esc(receiptNo)}</span></div>` : ""}
      <div class="flex-between"><span>วันที่</span><span>${esc(issuedStr)}</span></div>
      <div class="flex-between"><span>เครื่อง/พนักงาน</span><span>${esc(posId)} / ${esc(empName)}</span></div>
      <div class="hr"></div>

      ${buyerBlock}

      <table>
        <thead>
          <tr>
            <td style="text-align:center">#</td>
            <td>รายการ</td>
            <td style="text-align:center">จำนวน</td>
            <td style="text-align:right">${isFullTaxInvoice ? "ราคา/หน่วย" : "ราคา"}</td>
            <td style="text-align:right">จำนวนเงิน</td>
          </tr>
        </thead>
      </table>
      <div class="hr"></div>

      <table><tbody>${itemRows}</tbody></table>
      <div class="hr"></div>

      <div class="flex-between"><span>รวมมูลค่าสินค้า</span><span>${fmtMoney(displayGross)}</span></div>
      ${isFullTaxInvoice ? "" : discRowsHtml}
      ${displayDiscount > 0 ? `<div class="flex-between"><span>หักส่วนลด</span><span>-${fmtMoney(displayDiscount)}</span></div>` : ""}
      <div class="hr"></div>
      <div class="flex-between"><span>มูลค่าสินค้ายกเว้นภาษี</span><span>${fmtMoney(bd.nonVatAmount)}</span></div>
      <div class="flex-between"><span>มูลค่าสินค้าที่ต้องเสียภาษี</span><span>${fmtMoney(bd.vatableExVat)}</span></div>
      <div class="flex-between"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${fmtMoney(bd.vatAmount)}</span></div>
      <div class="hr"></div>
      <div class="flex-between bold" style="font-size:1.05em">
        <span>จำนวนเงินรวมทั้งสิ้น</span><span>${fmtMoney(bd.netTotal)}</span>
      </div>
      <div class="center" style="font-size:0.85em">(${esc(amountText)})</div>
      <div class="hr"></div>

      ${payRows}
      ${Number(cashReceived) > 0 ? `<div class="flex-between"><span>รับเงินสด</span><span>${fmtMoney(cashReceived)}</span></div>` : ""}
      ${Number(changeReturn) > 0 ? `<div class="flex-between"><span>เงินทอน</span><span>${fmtMoney(changeReturn)}</span></div>` : ""}

      <div class="hr"></div>
      <div class="center" style="font-size:0.85em">ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว</div>
      ${hasNonVatItem ? `<div class="center" style="font-size:0.8em">(N) = สินค้า/บริการที่ได้รับยกเว้นภาษีมูลค่าเพิ่ม</div>` : ""}
      ${settings.footerNote ? `<div class="center" style="font-size:0.9em;margin-top:2px">${esc(settings.footerNote)}</div>` : ""}
    </body></html>`;

    // Use hidden iframe to avoid popup blocker
    let iframe = document.getElementById("pos-print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "pos-print-frame";
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;";
      document.body.appendChild(iframe);
    }
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();
    iframe.contentWindow.focus();
    setTimeout(() => iframe.contentWindow.print(), 400);
  };

  const previewLines = exVatLines || cart;

  // ── PREVIEW (modal) ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 print:hidden shrink-0">
          <h2 className="text-lg font-bold">{docTitle} ({settings.paperWidth}mm)</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Receipt preview — monospace style to mimic thermal */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4">
          <div className="bg-white mx-auto rounded-lg shadow-sm border border-gray-200 font-mono text-[12px] leading-snug"
               style={{ maxWidth: `${Math.min(paperMm * 3.5, 400)}px`, padding: "12px 10px" }}>

            {/* Header — ข้อมูลผู้ประกอบการตามที่จดทะเบียนภาษีมูลค่าเพิ่ม */}
            <div className="text-center mb-1">
              <img src="/logo.png" alt="" className="block mx-auto mb-1 h-12 w-auto grayscale" onError={e => { e.target.style.display = "none"; }} />
              <div className="font-bold text-sm">{settings.shopName}</div>
              {settings.shopAddress && <div className="text-[11px] text-gray-500">{settings.shopAddress}</div>}
              {settings.shopPhone && <div className="text-[11px] text-gray-500">โทร. {settings.shopPhone}</div>}
              <div className="text-[11px]">เลขประจำตัวผู้เสียภาษี {shopTaxIdFmt}</div>
              <div className="text-[11px]">{branch}</div>
              <div className="font-bold mt-1">{docTitle}</div>
              {isPreviewOnly && (
                <div className="text-[10px] text-amber-600">** ตัวอย่าง — ยังไม่ออกเลขที่เอกสาร **</div>
              )}
            </div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* เลขที่ / วันที่ / เครื่อง */}
            <div className="flex justify-between text-[11px]"><span>เลขที่</span><span className="font-semibold">{docNo || "-"}</span></div>
            {isFullTaxInvoice && receiptNo && (
              <div className="flex justify-between text-[11px]"><span>เลขที่ใบเสร็จ</span><span>{receiptNo}</span></div>
            )}
            <div className="flex justify-between text-[11px]"><span>วันที่</span><span>{issuedStr}</span></div>
            <div className="flex justify-between text-[11px]"><span>เครื่อง/พนักงาน</span><span>{posId} / {empName}</span></div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* ข้อมูลผู้ซื้อ — บังคับแสดงบนใบกำกับภาษีเต็มรูป (ม.86/4(4)) */}
            {isFullTaxInvoice && (
              <>
                <div className="text-[11px] space-y-0.5 mb-1">
                  <div><span className="text-gray-500">ผู้ซื้อ:</span> {customerInfo?.customerName || customerInfo?.name || "-"}</div>
                  <div><span className="text-gray-500">ที่อยู่:</span> {customerInfo?.customerAddress || customerInfo?.address || "-"}</div>
                  <div><span className="text-gray-500">เลขประจำตัวผู้เสียภาษี:</span> {formatTaxId(customerInfo?.customerTaxId || customerInfo?.taxId || "-")}</div>
                  <div><span className="text-gray-500">สาขา:</span> {customerInfo?.customerBranch || "สำนักงานใหญ่"}</div>
                </div>
                <hr className="border-dashed border-gray-400 my-1.5" />
              </>
            )}

            {/* Items header */}
            <div className="flex justify-between text-[11px] text-gray-500 font-semibold">
              <span className="w-4 text-center shrink-0">#</span>
              <span className="flex-1">รายการ</span>
              <span className="w-8 text-center">จน.</span>
              <span className="w-16 text-right">{isFullTaxInvoice ? "ราคา/น." : "ราคา"}</span>
              <span className="w-16 text-right">รวม</span>
            </div>
            <hr className="border-dashed border-gray-400 my-1" />

            {/* Items */}
            {previewLines.map((item, i) => {
              const qty = lineQty(item);
              const unit = exVatLines ? item.unitExVat : linePrice(item);
              const amount = exVatLines ? item.amountExVat : linePrice(item) * qty;
              return (
                <div key={i}>
                  <div className="flex justify-between text-[11px] py-0.5">
                    <span className="w-4 text-center shrink-0 text-gray-400">{i + 1}</span>
                    <span className="flex-1 pr-1 break-words">
                      {item.name || item.Name}
                      {item.vatStatus === "NON VAT" && <span className="text-[9px] text-gray-400 ml-1">(N)</span>}
                    </span>
                    <span className="w-8 text-center shrink-0">{qty}</span>
                    <span className="w-16 text-right shrink-0">{fmtMoney(unit)}</span>
                    <span className="w-16 text-right shrink-0">{fmtMoney(amount)}</span>
                  </div>
                  {(item.note || item.Note) && (
                    <div className="text-[10px] text-gray-400 pl-2">↳ {item.note || item.Note}</div>
                  )}
                </div>
              );
            })}

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* ── สรุปยอด: เรียงตามลำดับที่สรรพากรอ่านได้ ── */}
            <div className="flex justify-between text-[11px]">
              <span>รวมมูลค่าสินค้า</span><span>{fmtMoney(displayGross)}</span>
            </div>

            {!isFullTaxInvoice && discountRows.map((d, idx) => (
              <div key={idx} className={`flex justify-between text-[11px] ${
                d.tone === "green" ? "text-green-700" : d.tone === "purple" ? "text-purple-700" : "text-amber-700"}`}>
                <span className="flex-1 pr-2">{d.label}</span>
                <span>-{fmtMoney(d.amount)}</span>
              </div>
            ))}
            {displayDiscount > 0 && (
              <div className="flex justify-between text-[11px] font-semibold">
                <span>หักส่วนลด</span><span>-{fmtMoney(displayDiscount)}</span>
              </div>
            )}

            <hr className="border-dashed border-gray-400 my-1.5" />

            <div className="flex justify-between text-[11px] text-gray-600">
              <span>มูลค่าสินค้ายกเว้นภาษี</span><span>{fmtMoney(bd.nonVatAmount)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>มูลค่าสินค้าที่ต้องเสียภาษี</span><span>{fmtMoney(bd.vatableExVat)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>ภาษีมูลค่าเพิ่ม 7%</span><span>{fmtMoney(bd.vatAmount)}</span>
            </div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            <div className="flex justify-between font-bold text-[13px]">
              <span>จำนวนเงินรวมทั้งสิ้น</span><span>{fmtMoney(bd.netTotal)}</span>
            </div>
            <div className="text-center text-[10px] text-gray-500 mt-0.5">({amountText})</div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* Payment method(s) */}
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span>{p.method}</span>
                <span>{fmtMoney(p.amount)}</span>
              </div>
            ))}
            {Number(cashReceived) > 0 && (
              <div className="flex justify-between text-[11px]"><span>รับเงินสด</span><span>{fmtMoney(cashReceived)}</span></div>
            )}
            {Number(changeReturn) > 0 && (
              <div className="flex justify-between text-[11px]"><span>เงินทอน</span><span>{fmtMoney(changeReturn)}</span></div>
            )}

            <hr className="border-dashed border-gray-400 my-1.5" />

            <div className="text-center text-[10px] text-gray-500">ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว</div>
            {hasNonVatItem && (
              <div className="text-center text-[10px] text-gray-400">(N) = สินค้า/บริการที่ได้รับยกเว้นภาษีมูลค่าเพิ่ม</div>
            )}
            {settings.footerNote && (
              <div className="text-center text-[10px] text-gray-400 mt-1">{settings.footerNote}</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 print:hidden shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors text-sm">
            ปิด
          </button>
          <button onClick={handlePrint} className="px-5 py-2 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors text-sm">
            <Printer size={16} />
            พิมพ์ ({settings.paperWidth}mm)
          </button>
        </div>
      </div>
    </div>
  );
}

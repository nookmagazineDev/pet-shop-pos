import { X, Printer } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";
import toast from "react-hot-toast";

export default function TaxInvoiceModal({ isOpen, onClose, cart, paymentMethod, subtotal, discountAmount = 0, freeItemLines = [], couponDiscount = 0, couponName = "", tax, total, receiptType, customerInfo, taxInvoiceNo }) {
  if (!isOpen) return null;

  const { settings } = usePrinter();
  const paperMm = parseInt(settings.paperWidth) || 80;

  const now = new Date();
  const dStr = now.toLocaleDateString("th-TH", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\//g, "");
  const recNo = (receiptType === "ใบกำกับภาษี" && taxInvoiceNo)
    ? taxInvoiceNo
    : "ST" + dStr + String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  let userObj = {};
  try { userObj = JSON.parse(sessionStorage.getItem("pos_user") || "{}"); } catch (e) {}
  const empName = userObj.displayName || userObj.name || "พนักงาน";

  const vatableInclAfterDiscount = tax > 0 ? tax * (107 / 7) : 0;
  const vatableAdjusted = tax > 0 ? tax * (100 / 7) : 0;
  const nonVatAdjusted  = Math.max(0, total - vatableInclAfterDiscount);

  // Parse split payment string "เงินสด:500 + โอน:100" → [{method, amount}]
  const parsePayments = (str) => {
    if (!str) return [{ method: "เงินสด", amount: total }];
    if (str.includes(":")) {
      return str.split(" + ").map(p => {
        const [method, amount] = p.split(":");
        return { method: method.trim(), amount: parseFloat(amount) || 0 };
      });
    }
    return [{ method: str, amount: total }];
  };
  const payments = parsePayments(paymentMethod);

  const hasDiscounts = freeItemLines.length > 0 || discountAmount > 0 || couponDiscount > 0;

  // ── PRINT (thermal printer popup) ───────────────────────────
  const handlePrint = async () => {
    if (settings.enableDirectPrint) {
      try {
        const response = await fetch("http://localhost:3001/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            items: cart,
            subtotal, tax, total, isTest: false,
            receiptType, paymentMethod, customerInfo,
            empName, recNo, nonVatAdjusted, vatableAdjusted,
            discountAmount, freeItemLines, couponDiscount, couponName,
          }),
        });
        const data = await response.json();
        if (!data.success) toast.error("พิมพ์ไม่สำเร็จ: " + data.message);
        else { toast.success("พิมพ์ใบเสร็จเรียบร้อยแล้ว"); onClose(); }
      } catch (e) {
        toast.error("ไม่สามารถเชื่อมต่อ Print Server ได้ (เปิดโปรแกรมหลังบ้านหรือยัง?)");
      }
      return;
    }

    const win = window.open("", "_blank", "width=420,height=700");
    const fmt = (n) => (parseFloat(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Item rows
    const itemRows = cart.map(item => {
      const note = item.note || item.Note
        ? `<tr><td colspan="4" style="font-size:0.9em;padding-left:8px;color:#555">↳ ${item.note || item.Note}</td></tr>`
        : "";
      return `<tr>
        <td style="word-break:break-word;padding-right:4px;font-size:0.93em">${item.name || item.Name}${item.vatStatus === "NON VAT" ? " (N)" : ""}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">${fmt(item.price)}</td>
        <td style="text-align:right">${fmt((parseFloat(item.price) || 0) * item.qty)}</td>
      </tr>${note}`;
    }).join("");

    // Discount rows (as flex-between divs, outside the table)
    const promoDiscRows = freeItemLines.map(fi => `
      <div class="flex-between" style="color:#16a34a;font-size:0.93em">
        <span>🎁 ${fi.name}${fi.promoName ? ` (${fi.promoName})` : ""}</span>
        <span>-${fmt(fi.price * fi.qty)}</span>
      </div>`).join("");

    const billDiscRow = discountAmount > 0 ? `
      <div class="flex-between" style="color:#9333ea;font-size:0.93em">
        <span>ส่วนลดโปรโมชั่น</span>
        <span>-${fmt(discountAmount)}</span>
      </div>` : "";

    const couponRow = couponDiscount > 0 ? `
      <div class="flex-between" style="color:#b45309;font-size:0.93em">
        <span>${couponName || "ส่วนลดจากคูปอง"}</span>
        <span>-${fmt(couponDiscount)}</span>
      </div>` : "";

    // Payment rows
    const payRows = payments.map(p => `
      <div class="flex-between">
        <span>${p.method}</span>
        <span>${fmt(p.amount > 0 ? p.amount : total)}</span>
      </div>`).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบเสร็จ</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperMm}mm; padding:4mm 3mm; background:white; color:#000; }
        .center { text-align:center; }
        .bold   { font-weight:bold; }
        .hr     { border-top:1px dashed #999; margin:4px 0; }
        table   { width:100%; border-collapse:collapse; }
        td      { padding:2px; vertical-align:top; }
        .logo   { display:block; margin:0 auto 4px; max-height:${paperMm <= 58 ? "50px" : "80px"}; width:auto; filter:grayscale(100%); }
        .flex-between { display:flex; justify-content:space-between; margin:1px 0; }
        @media print { @page { size:${paperMm}mm auto; margin:0; } }
      </style>
    </head><body>

      <div class="center"><img class="logo" src="${window.location.origin}/logo.png" alt="" onerror="this.style.display='none'"/></div>
      <div class="center bold" style="font-size:1.1em">${settings.shopName}</div>
      <div class="center" style="font-size:0.9em">${settings.shopAddress || ""}</div>
      <div class="center">สาขา ${settings.shopBranch || "00001"}</div>
      <div class="center">TAX# ${settings.shopTaxId || ""}</div>
      <div class="center bold" style="margin-top:3px">
        ${receiptType === "ใบกำกับภาษี"
          ? "ใบกำกับภาษี / ใบเสร็จรับเงิน"
          : "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ"}
      </div>
      <div class="center" style="font-size:0.85em">(VAT Included)</div>
      <div class="hr"></div>

      <table>
        <thead>
          <tr>
            <td>รายการ</td>
            <td style="text-align:center">จำนวน</td>
            <td style="text-align:right">ราคา</td>
            <td style="text-align:right">ราคารวม</td>
          </tr>
        </thead>
      </table>
      <div class="hr"></div>

      <table><tbody>${itemRows}</tbody></table>
      <div class="hr"></div>

      <div class="flex-between"><span>รวม</span><span>${fmt(subtotal)}</span></div>

      ${hasDiscounts ? `<div class="hr"></div>${promoDiscRows}${billDiscRow}${couponRow}` : ""}

      <div class="hr"></div>
      <div class="flex-between"><span>NonVAT</span><span>${fmt(nonVatAdjusted)}</span></div>
      <div class="flex-between"><span>VATable</span><span>${fmt(vatableAdjusted)}</span></div>
      <div class="flex-between"><span>VAT 7 %</span><span>${fmt(tax)}</span></div>
      <div class="hr"></div>
      <div class="flex-between bold" style="font-size:1.05em">
        <span>สุทธิ</span><span>${fmt(total)}</span>
      </div>
      <div class="hr"></div>

      ${payRows}

      <div class="hr"></div>
      <div class="flex-between"><span>พนักงาน</span><span>${empName}</span></div>
      <div class="flex-between"><span>จุดขาย</span><span>POS #1</span></div>
      <div class="flex-between"><span>เลขที่</span><span>${recNo}</span></div>

      <br/><br/>
      <div class="center">** วันที่ ${now.toLocaleString("th-TH", { hour12: false })} **</div>
      ${settings.footerNote ? `<div class="center" style="font-size:0.9em;margin-top:2px">${settings.footerNote}</div>` : ""}
      <script>window.onload = function() { window.print(); window.close(); }</script>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  // ── PREVIEW (modal) ──────────────────────────────────────────
  const fmt = (n) => (parseFloat(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 print:hidden shrink-0">
          <h2 className="text-lg font-bold">
            {receiptType === "ใบกำกับภาษี" ? "ใบกำกับภาษี / ใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน"} ({settings.paperWidth}mm)
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Receipt preview — monospace style to mimic thermal */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4">
          <div className="bg-white mx-auto rounded-lg shadow-sm border border-gray-200 font-mono text-[12px] leading-snug"
               style={{ maxWidth: `${Math.min(paperMm * 3.5, 400)}px`, padding: "12px 10px" }}>

            {/* Header */}
            <div className="text-center mb-1">
              <img src="/logo.png" alt="" className="block mx-auto mb-1 h-12 w-auto grayscale" onError={e => { e.target.style.display = "none"; }} />
              <div className="font-bold text-sm">{settings.shopName}</div>
              {settings.shopAddress && <div className="text-[11px] text-gray-500">{settings.shopAddress}</div>}
              <div className="text-[11px]">สาขา {settings.shopBranch || "00001"}</div>
              <div className="text-[11px]">TAX# {settings.shopTaxId}</div>
              <div className="font-bold mt-1">
                {receiptType === "ใบกำกับภาษี"
                  ? "ใบกำกับภาษี / ใบเสร็จรับเงิน"
                  : "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ"}
              </div>
              <div className="text-[10px] text-gray-500">(VAT Included)</div>
            </div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* Items header */}
            <div className="flex justify-between text-[11px] text-gray-500 font-semibold">
              <span className="flex-1">รายการ</span>
              <span className="w-8 text-center">จน.</span>
              <span className="w-16 text-right">ราคา</span>
              <span className="w-16 text-right">รวม</span>
            </div>
            <hr className="border-dashed border-gray-400 my-1" />

            {/* Items */}
            {cart.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] py-0.5">
                  <span className="flex-1 pr-1 break-words">
                    {item.name || item.Name}
                    {item.vatStatus === "NON VAT" && <span className="text-[9px] text-gray-400 ml-1">(N)</span>}
                  </span>
                  <span className="w-8 text-center shrink-0">{item.qty}</span>
                  <span className="w-16 text-right shrink-0">{fmt(item.price)}</span>
                  <span className="w-16 text-right shrink-0">{fmt((parseFloat(item.price) || 0) * item.qty)}</span>
                </div>
                {(item.note || item.Note) && (
                  <div className="text-[10px] text-gray-400 pl-2">↳ {item.note || item.Note}</div>
                )}
              </div>
            ))}

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* รวม (raw subtotal before discounts) */}
            <div className="flex justify-between font-semibold text-[12px]">
              <span>รวม</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {/* Discount section */}
            {hasDiscounts && (
              <>
                <hr className="border-dashed border-gray-400 my-1.5" />
                {freeItemLines.map((fi, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-green-700">
                    <span className="flex-1 pr-2">🎁 {fi.name}{fi.promoName ? ` (${fi.promoName})` : ""}</span>
                    <span>-{fmt(fi.price * fi.qty)}</span>
                  </div>
                ))}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[11px] text-purple-700">
                    <span>ส่วนลดโปรโมชั่น</span>
                    <span>-{fmt(discountAmount)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-[11px] text-amber-700">
                    <span className="flex-1 pr-2">{couponName || "ส่วนลดจากคูปอง"}</span>
                    <span>-{fmt(couponDiscount)}</span>
                  </div>
                )}
              </>
            )}

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* VAT breakdown */}
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>NonVAT</span><span>{fmt(nonVatAdjusted)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>VATable</span><span>{fmt(vatableAdjusted)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>VAT 7 %</span><span>{fmt(tax)}</span>
            </div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* สุทธิ */}
            <div className="flex justify-between font-bold text-[13px]">
              <span>สุทธิ</span><span>{fmt(total)}</span>
            </div>

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* Payment method(s) */}
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span>{p.method}</span>
                <span>{fmt(p.amount > 0 ? p.amount : total)}</span>
              </div>
            ))}

            <hr className="border-dashed border-gray-400 my-1.5" />

            {/* Footer info */}
            <div className="flex justify-between text-[11px]">
              <span>พนักงาน</span><span>{empName}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>จุดขาย</span><span>POS #1</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>เลขที่</span><span>{recNo}</span>
            </div>

            <div className="text-center text-[11px] mt-3 text-gray-500">
              ** วันที่ {now.toLocaleString("th-TH", { hour12: false })} **
            </div>
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

import { useState } from "react";
import { X, Printer, FileText, Receipt, ExternalLink } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";
import clsx from "clsx";

export default function ShiftSlipModal({ isOpen, onClose, shiftData, bills = [] }) {
  if (!isOpen || !shiftData) return null;

  const [viewTab, setViewTab] = useState("slip");
  const { settings } = usePrinter();
  const paperMm = parseInt(settings.paperWidth) || 80;
  const paperW = paperMm <= 58 ? "58mm" : "80mm";

  // --- Print shift slip ---
  const handlePrint = () => {
    const win = window.open("", "_blank", "width=420,height=700");

    let onlinePaidHtml = "";
    let onlinePendingHtml = "";

    if (shiftData.onlinePaid && typeof shiftData.onlinePaid === "object") {
      Object.entries(shiftData.onlinePaid).forEach(([platform, amt]) => {
        onlinePaidHtml += `<tr>
          <td style="text-align:left;">${platform} (ชำระแล้ว)</td>
          <td style="text-align:right;">${Number(amt).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>`;
      });
    }
    if (shiftData.onlinePending && typeof shiftData.onlinePending === "object") {
      Object.entries(shiftData.onlinePending).forEach(([platform, amt]) => {
        onlinePendingHtml += `<tr>
          <td style="text-align:left;">${platform} (รอชำระ)</td>
          <td style="text-align:right;">${Number(amt).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>`;
      });
    }

    const staffLine = shiftData.staffNames && shiftData.staffNames.length > 0
      ? `<tr><td>พนักงาน:</td><td>${shiftData.staffNames.join(", ")}</td></tr>`
      : `<tr><td>ผู้ทำรายการ:</td><td>${shiftData.actor || "พนักงาน"}</td></tr>`;

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบสรุปการปิดกะ</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperW}; padding:4mm 3mm; background:white; color:#000; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .mb-1 { margin-bottom: 2mm; }
        .mb-2 { margin-bottom: 4mm; }
        .border-b { border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
        .border-t { border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1mm 0; vertical-align: top; }
        @media print { @page { margin: 0; size: auto; } body { width: 100%; padding: 0; } }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="text-center font-bold mb-1" style="font-size:1.1em;">ใบสรุปการปิดกะ (SHIFT SLIP)</div>
      <div class="text-center mb-2">${settings.storeName || "ร้านค้าของคุณ"}</div>

      <div class="border-b">
        <table style="margin-bottom:2mm;">
          <tr><td style="width:38%;">รหัสกะ:</td><td>${shiftData.shiftId || "N/A"}</td></tr>
          <tr><td>เปิดกะ:</td><td>${shiftData.openTime ? new Date(shiftData.openTime).toLocaleString("th-TH") : "-"}</td></tr>
          <tr><td>ปิดกะ:</td><td>${shiftData.closeTime ? new Date(shiftData.closeTime).toLocaleString("th-TH") : "กำลังเปิดกะ"}</td></tr>
          ${staffLine}
          <tr><td>จำนวนบิล:</td><td>${shiftData.totalBills || bills.length || "-"} บิล</td></tr>
        </table>
      </div>

      <div class="font-bold mb-1">สรุปยอดขาย:</div>
      <table class="border-b">
        <tr><td style="text-align:left;">เงินทอนเริ่มต้น</td><td style="text-align:right;">${Number(shiftData.initialCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="text-align:left;">เงินสด (Cash)</td><td style="text-align:right;">${Number(shiftData.cashSales || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="text-align:left;">เงินโอน (Transfer)</td><td style="text-align:right;">${Number(shiftData.transferDirect || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="text-align:left;">สแกน QR</td><td style="text-align:right;">${Number(shiftData.transferQR || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="text-align:left;">บัตรเครดิต</td><td style="text-align:right;">${Number(shiftData.creditSales || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="text-align:left;">เครดิต (Credit)</td><td style="text-align:right;">${Number(shiftData.creditPts || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        ${onlinePaidHtml}${onlinePendingHtml}
      </table>

      <div class="font-bold border-b">
        <table style="font-size:1.1em;">
          <tr><td style="text-align:left;">รวมที่ต้องมีในลิ้นชัก</td><td style="text-align:right;">${Number(shiftData.expectedCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
          <tr><td style="text-align:left;">นับเงินได้จริง</td><td style="text-align:right;">${Number(shiftData.actualCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
          <tr><td style="text-align:left;">ส่วนต่าง (ขาด/เกิน)</td><td style="text-align:right;">${Number(shiftData.discrepancy || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        </table>
      </div>

      <div class="text-center" style="font-size:0.9em; margin-top:4mm;">--- สิ้นสุดรายงาน ---</div>
    </body></html>`);
    win.document.close();
  };

  // --- Open receipt popup for a bill ---
  const handleViewReceipt = (tx) => {
    const win = window.open("", "_blank", `width=${paperMm <= 58 ? 360 : 430},height=650`);
    let itemsHtml = "";
    try {
      const cart = typeof tx.CartDetails === "string" ? JSON.parse(tx.CartDetails) : (tx.CartDetails || []);
      if (Array.isArray(cart)) {
        cart.forEach(item => {
          const name  = item.name || item.Name || item.barcode || item.Barcode || "-";
          const qty   = parseFloat(item.qty || 1);
          const price = parseFloat(item.price || item.Price || 0);
          itemsHtml += `<tr>
            <td style="max-width:120px;word-break:break-word;">${name}</td>
            <td style="text-align:center;padding:0 4px;">${qty}</td>
            <td style="text-align:right;">${(qty * price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>`;
        });
      }
    } catch (e) {}

    const status = tx.Status === "CANCELLED"
      ? `<div style="color:red;font-weight:bold;text-align:center;margin:2mm 0;">*** บิลนี้ถูกยกเลิกแล้ว ***</div>`
      : "";

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบเสร็จ ${tx.ReceiptNo || tx.OrderID}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:12px; width:${paperW}; padding:4mm 3mm; background:white; color:#000; }
        .c { text-align:center; }
        .r { text-align:right; }
        .b { font-weight:bold; }
        .dash { border-bottom:1px dashed #000; padding-bottom:2mm; margin-bottom:2mm; }
        table { width:100%; border-collapse:collapse; }
        td { padding:0.8mm 0; vertical-align:top; }
        @media print { @page { margin:0; size:auto; } body { width:100%; } }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="c b" style="font-size:1.1em;margin-bottom:2mm;">${settings.storeName || "ร้านค้า"}</div>
      <div class="c dash">ใบเสร็จรับเงิน</div>
      ${status}
      <table style="margin-bottom:2mm;">
        <tr><td style="width:40%;">เลขที่บิล:</td><td class="r">${tx.ReceiptNo || tx.OrderID}</td></tr>
        <tr><td>วันที่:</td><td class="r">${new Date(tx.Date).toLocaleString("th-TH")}</td></tr>
        <tr><td>พนักงาน:</td><td class="r">${tx.Username || tx.Staff || "-"}</td></tr>
        <tr><td>ชำระด้วย:</td><td class="r">${tx.PaymentMethod || "-"}</td></tr>
      </table>
      <div class="dash">
        <table>
          <thead><tr class="b"><td>รายการ</td><td style="text-align:center;">จำนวน</td><td style="text-align:right;">ราคา</td></tr></thead>
          <tbody>${itemsHtml || `<tr><td colspan="3" style="text-align:center;color:#888;">ไม่มีข้อมูลสินค้า</td></tr>`}</tbody>
        </table>
      </div>
      <table class="b" style="font-size:1.05em;margin-top:2mm;">
        <tr><td>รวมทั้งสิ้น</td><td class="r">${parseFloat(tx.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</td></tr>
      </table>
      <div class="c" style="margin-top:4mm;font-size:0.9em;">--- ขอบคุณที่ใช้บริการ ---</div>
    </body></html>`);
    win.document.close();
  };

  const staffDisplay = shiftData.staffNames && shiftData.staffNames.length > 0
    ? shiftData.staffNames.join(", ")
    : (shiftData.actor || "พนักงาน");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">สลิปปิดกะ</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {shiftData.openTime ? new Date(shiftData.openTime).toLocaleString("th-TH") : ""}
              {shiftData.closeTime ? ` → ${new Date(shiftData.closeTime).toLocaleString("th-TH")}` : " (กำลังเปิดอยู่)"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">พนักงาน: {staffDisplay}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setViewTab("slip")}
            className={clsx("flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
              viewTab === "slip"
                ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <FileText size={15} /> ใบสรุปกะ
          </button>
          <button
            onClick={() => setViewTab("bills")}
            className={clsx("flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
              viewTab === "bills"
                ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Receipt size={15} /> รายการบิล
            <span className={clsx("px-2 py-0.5 rounded-full text-xs",
              viewTab === "bills" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
            )}>
              {bills.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ---- SLIP TAB ---- */}
          {viewTab === "slip" && (
            <div className="p-6 bg-gray-100 flex justify-center">
              <div className="bg-white shadow-sm p-4 font-mono text-sm leading-relaxed" style={{ width: paperW, minHeight: "150mm" }}>
                <div className="text-center font-bold mb-2">ใบสรุปการปิดกะ</div>
                <div className="text-center mb-3">{settings.storeName || "ร้านค้าของคุณ"}</div>

                <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-xs space-y-0.5">
                  <div className="flex justify-between"><span>รหัสกะ:</span><span className="font-bold">{shiftData.shiftId || "-"}</span></div>
                  <div className="flex justify-between"><span>เปิดกะ:</span><span>{shiftData.openTime ? new Date(shiftData.openTime).toLocaleString("th-TH") : "-"}</span></div>
                  <div className="flex justify-between"><span>ปิดกะ:</span><span>{shiftData.closeTime ? new Date(shiftData.closeTime).toLocaleString("th-TH") : "กำลังเปิดกะ"}</span></div>
                  <div className="flex justify-between"><span>พนักงาน:</span><span className="text-right max-w-[55%] truncate">{staffDisplay}</span></div>
                  <div className="flex justify-between font-bold"><span>จำนวนบิล:</span><span>{shiftData.totalBills || bills.length || "-"} บิล</span></div>
                </div>

                <div className="font-bold mb-1">สรุปยอดขาย:</div>
                <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-xs space-y-0.5">
                  {[
                    ["เงินทอนเริ่มต้น", shiftData.initialCash],
                    ["เงินสด",          shiftData.cashSales],
                    ["เงินโอน",         shiftData.transferDirect],
                    ["สแกน QR",          shiftData.transferQR],
                    ["บัตรเครดิต",       shiftData.creditSales],
                    ["เครดิต",           shiftData.creditPts],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span>{label}</span>
                      <span>{Number(val || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {shiftData.onlinePaid && Object.entries(shiftData.onlinePaid).map(([p, a]) => (
                    <div key={p} className="flex justify-between">
                      <span>{p} (จ่ายแล้ว)</span>
                      <span>{Number(a).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {shiftData.onlinePending && Object.entries(shiftData.onlinePending).map(([p, a]) => (
                    <div key={p} className="flex justify-between">
                      <span>{p} (รอชำระ)</span>
                      <span>{Number(a).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                <div className="font-bold text-xs space-y-0.5">
                  <div className="flex justify-between"><span>ในลิ้นชักต้องมี</span><span>{Number(shiftData.expectedCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>นับได้จริง</span><span>{Number(shiftData.actualCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between pt-1 border-t border-dashed border-gray-400">
                    <span>ส่วนต่าง</span>
                    <span className={Number(shiftData.discrepancy || 0) < 0 ? "text-red-600" : ""}>
                      {Number(shiftData.discrepancy || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- BILLS TAB ---- */}
          {viewTab === "bills" && (
            <div>
              {bills.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่พบรายการบิลในกะนี้</div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b text-xs font-semibold text-gray-500">
                      <th className="py-2.5 px-4 w-8">No.</th>
                      <th className="py-2.5 px-4">วันที่ / เวลา</th>
                      <th className="py-2.5 px-4">เลขที่บิล</th>
                      <th className="py-2.5 px-4">พนักงาน</th>
                      <th className="py-2.5 px-4 text-right">ยอดรวม</th>
                      <th className="py-2.5 px-4 text-center">สถานะ</th>
                      <th className="py-2.5 px-4 text-center">ใบเสร็จ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bills
                      .slice()
                      .sort((a, b) => new Date(a.Date) - new Date(b.Date))
                      .map((tx, i) => {
                        const isVoid = tx.Status === "CANCELLED";
                        return (
                          <tr key={i} className={clsx("text-sm", isVoid ? "bg-red-50/60" : "hover:bg-gray-50")}>
                            <td className="py-2.5 px-4 text-gray-400">{i + 1}</td>
                            <td className="py-2.5 px-4 text-gray-600 text-xs">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-blue-700 text-xs">{tx.ReceiptNo || tx.OrderID}</td>
                            <td className="py-2.5 px-4 text-gray-700">{tx.Username || tx.Staff || "-"}</td>
                            <td className={clsx("py-2.5 px-4 text-right font-bold", isVoid ? "text-red-500 line-through" : "text-gray-900")}>
                              ฿{parseFloat(tx.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {isVoid
                                ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">ยกเลิก</span>
                                : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">สมบูรณ์</span>
                              }
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() => handleViewReceipt(tx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <ExternalLink size={11} /> ดูใบเสร็จ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  {/* Summary footer */}
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 font-bold text-sm">
                      <td className="py-2.5 px-4 text-gray-600" colSpan="4">
                        รวม {bills.filter(t => t.Status !== "CANCELLED").length} บิล
                        {bills.filter(t => t.Status === "CANCELLED").length > 0 &&
                          ` (ยกเลิก ${bills.filter(t => t.Status === "CANCELLED").length} บิล)`}
                      </td>
                      <td className="py-2.5 px-4 text-right text-blue-700">
                        ฿{bills
                          .filter(t => t.Status !== "CANCELLED")
                          .reduce((s, t) => s + parseFloat(t.TotalAmount || 0), 0)
                          .toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
          {viewTab === "slip" ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handlePrint} className="py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 flex items-center justify-center gap-2">
                <Printer size={18} /> พิมพ์ใบสรุปกะ
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {bills.length} บิลทั้งหมดในกะนี้
              </span>
              <button onClick={onClose} className="py-2.5 px-6 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                ปิด
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

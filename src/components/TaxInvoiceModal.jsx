import { X, Printer } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";

export default function TaxInvoiceModal({ isOpen, onClose, cart, paymentMethod, subtotal, tax, total, receiptType, customerInfo }) {
  if (!isOpen) return null;

  const { settings } = usePrinter();
  const paperMm = parseInt(settings.paperWidth) || 80;

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=420,height=700");
    const rows = cart.map(item => `
      <tr>
        <td>${item.name || item.Name}<br/><span style="font-size:0.85em;color:#777">${item.barcode || item.Barcode || ""}</span></td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">${(item.price || item.Price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">${((item.price || item.Price || 0) * item.qty).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบเสร็จ</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperMm}mm; padding:4mm 3mm; background:white; color:#000; }
        .center { text-align:center; }
        .bold { font-weight:bold; }
        .hr { border-top:1px dashed #000; margin:3px 0; }
        table { width:100%; border-collapse:collapse; }
        td { padding:1px 2px; vertical-align:top; }
        @media print { @page { size:${paperMm}mm auto; margin:0; } }
      </style>
    </head><body>
      <div class="center bold" style="font-size:1.15em">${settings.shopName}</div>
      <div class="center" style="font-size:0.9em">${settings.shopAddress}</div>
      <div class="center">โทร: ${settings.shopPhone}</div>
      <div class="center">เลขภาษี: ${settings.shopTaxId} ${settings.shopBranch}</div>
      <div class="hr"></div>
      <div class="center bold">${receiptType === "ใบกำกับภาษี" ? "ใบกำกับภาษีเต็มรูป" : "ใบกำกับภาษีอย่างย่อ"}</div>
      <div>วันที่: ${new Date().toLocaleString("th-TH")}</div>
      <div>ชำระโดย: ${paymentMethod}</div>
      ${receiptType === "ใบกำกับภาษี" && customerInfo ? `
        <div class="hr"></div>
        <div>ลูกค้า: ${customerInfo.customerName || "-"}</div>
        <div>ที่อยู่: ${customerInfo.customerAddress || "-"}</div>
        <div>เลขภาษี: ${customerInfo.customerTaxId || "-"}</div>` : ""}
      <div class="hr"></div>
      <table>
        <thead><tr>
          <td class="bold">รายการ</td>
          <td class="bold" style="text-align:center">จน.</td>
          <td class="bold" style="text-align:right">ราคา</td>
          <td class="bold" style="text-align:right">รวม</td>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="hr"></div>
      <table>
        <tr><td>ราคาสินค้า</td><td style="text-align:right">${subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>VAT 7%</td><td style="text-align:right">${tax.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td></tr>
      </table>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.1em;border-top:1px solid #000;padding-top:3px;margin-top:3px">
        <span>รวมทั้งสิ้น (THB)</span><span>${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="hr"></div>
      <div class="center" style="margin-top:6px">${settings.footerNote}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden print:w-full print:max-w-none print:shadow-none print:rounded-none">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 print:hidden">
          <h2 className="text-xl font-bold">ตัวอย่างใบกำกับภาษี ({settings.paperWidth}mm)</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Invoice Preview */}
        <div className="flex-1 overflow-auto p-8 print:p-0">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-widest text-primary">{settings.shopName}</h1>
            <p className="text-gray-500 mt-1">{settings.shopAddress}</p>
            <p className="text-gray-500">โทร: {settings.shopPhone}</p>
            <p className="text-gray-500">เลขประจำตัวผู้เสียภาษี: {settings.shopTaxId} {settings.shopBranch}</p>
            <h2 className="text-xl font-bold mt-4">
              {receiptType === "ใบกำกับภาษี" ? "ใบกำกับภาษีเต็มรูป / Tax Invoice" : "ใบกำกับภาษีอย่างย่อ / ABB Tax Invoice"}
            </h2>
          </div>

          <div className="flex justify-between items-end mb-4 text-sm text-gray-600 border-b border-gray-100 pb-4">
            <div>
              <p>วันที่: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}</p>
              <p>ช่องทางชำระ: {paymentMethod}</p>
            </div>
          </div>

          {receiptType === "ใบกำกับภาษี" && customerInfo && (
            <div className="mb-6 text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3">
               <span className="font-bold">ลูกค้า: </span>{customerInfo.customerName || "สด"}<br/>
               <span className="font-bold">ที่อยู่: </span>{customerInfo.customerAddress || "-"}<br/>
               <span className="font-bold">เลขประจำตัวผู้เสียภาษี: </span>{customerInfo.customerTaxId || "-"}
            </div>
          )}

          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-2">รายการ</th>
                <th className="py-2 text-center w-16">จน.</th>
                <th className="py-2 text-right w-24">ราคา</th>
                <th className="py-2 text-right w-24">รวม</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 text-sm">{item.name || item.Name}<br/><span className="text-xs text-gray-400">{item.barcode || item.Barcode}</span></td>
                  <td className="py-3 text-center text-sm">{item.qty}</td>
                  <td className="py-3 text-right text-sm">{(item.price || item.Price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right text-sm">{((item.price || item.Price || 0) * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end space-y-2 mb-8">
            <div className="w-64 flex justify-between text-sm text-gray-500">
              <span>ราคาสินค้า</span>
              <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-64 flex justify-between text-sm text-gray-500">
              <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
              <span>{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-64 flex justify-between text-lg font-bold border-t border-gray-900 pt-2 mt-2">
              <span>รวมทั้งสิ้น (THB)</span>
              <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="text-center text-gray-500 text-sm mt-8 border-t border-gray-200 pt-4">
            <p>{settings.footerNote}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 print:hidden">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors">
            <Printer size={18} />
            พิมพ์ใบเสร็จ ({settings.paperWidth}mm)
          </button>
        </div>
      </div>
    </div>
  );
}

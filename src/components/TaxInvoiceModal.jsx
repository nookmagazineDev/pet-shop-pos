import { X, Printer } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";
import toast from "react-hot-toast";

export default function TaxInvoiceModal({ isOpen, onClose, cart, paymentMethod, subtotal, tax, total, receiptType, customerInfo }) {
  if (!isOpen) return null;

  const { settings } = usePrinter();
  const paperMm = parseInt(settings.paperWidth) || 80;

  // --- Shared receipt metadata (used by both Direct Print and Popup Print) ---
  const now = new Date();
  const dStr = now.toLocaleDateString("th-TH", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\//g, "");
  const recNo = "ST" + dStr + String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  let userObj = {};
  try { userObj = JSON.parse(sessionStorage.getItem("pos_user") || "{}"); } catch (e) {}
  const empName = userObj.displayName || "พนักงาน";

  const discountAmount = subtotal - (total - tax);
  const nonVatTotal = cart.reduce((sum, item) => sum + (item.vatStatus === "NON VAT" ? (item.price * item.qty) : 0), 0);
  const nonVatAdjusted = subtotal > 0 ? nonVatTotal - (discountAmount * (nonVatTotal / subtotal)) : 0;
  const vatableAdjusted = (total - tax) - nonVatAdjusted;
  // ---------------------------------------------------------------------------

  const handlePrint = async () => {
    if (settings.enableDirectPrint) {
      try {
        const response = await fetch("http://localhost:3001/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            items: cart,
            subtotal,
            tax,
            total,
            isTest: false,
            receiptType,
            paymentMethod,
            customerInfo,
            empName,
            recNo,
            nonVatAdjusted,
            vatableAdjusted
          })
        });
        const data = await response.json();
        if (!data.success) {
          toast.error("พิมพ์ไม่สำเร็จ: " + data.message);
        } else {
          toast.success("พิมพ์ใบเสร็จเรียบร้อยแล้ว");
          onClose(); // Auto close the modal on success
        }
      } catch (e) {
        toast.error("ไม่สามารถเชื่อมต่อ Print Server ได้ (เปิดโปรแกรมหลังบ้านหรือยัง?)");
      }
      return;
    }

    const win = window.open("", "_blank", "width=420,height=700");
    const rows = cart.map(item => `
      <tr>
        <td>${item.name || item.Name}<br/><span style="font-size:0.85em;color:#777">${item.barcode || item.Barcode || ""}</span></td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">${(parseFloat(item.price) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">${((parseFloat(item.price) || 0) * item.qty).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบเสร็จ</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperMm}mm; padding:4mm 3mm; background:white; color:#000; }
        .center { text-align:center; }
        .bold { font-weight:bold; }
        .hr { border-top:1px dashed #CCC; margin:4px 0; }
        table { width:100%; border-collapse:collapse; }
        td { padding:2px; vertical-align:top; }
        .logo { display:block; margin:0 auto 4px; max-height:${paperMm <= 58 ? "50px" : "80px"}; width:auto; filter:grayscale(100%); }
        .flex-between { display:flex; justify-content:space-between; }
        @media print { @page { size:${paperMm}mm auto; margin:0; } }
      </style>
    </head><body>
      <div class="center"><img class="logo" src="${window.location.origin}/logo.png" alt="logo" /></div>
      <div class="center bold" style="font-size:1.1em">${settings.shopName}</div>
      <div class="center" style="font-size:0.9em">${settings.shopAddress}</div>
      <div class="center">TAX# ${settings.shopTaxId} ${settings.shopBranch}</div>
      <div class="center bold" style="margin-top:2px">${receiptType === "ใบกำกับภาษี" ? "ใบกำกับภาษีเต็มรูป" : "ใบกำกับภาษีอย่างย่อ"}</div>
      <div class="center" style="font-size:0.9em;margin-bottom:2px">(VAT Included)</div>
      
      <div class="hr"></div>
      <table>
        <thead><tr>
          <td>รายการ</td>
          <td style="text-align:center">จำนวน</td>
          <td style="text-align:right">ราคา</td>
          <td style="text-align:right">ราคารวม</td>
        </tr></thead>
      </table>
      <div class="hr"></div>
      <table><tbody>${rows}</tbody></table>
      
      <div class="hr"></div>
      <div class="flex-between">
        <span>รวม</span>
        <span>${subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
      </div>
      
      <div class="hr"></div>
      <div class="flex-between"><span>NonVAT</span><span>${nonVatAdjusted.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
      <div class="flex-between"><span>VATable</span><span>${vatableAdjusted.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
      <div class="flex-between"><span>VAT 7 %</span><span>${tax.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span></div>
      <div class="flex-between bold" style="font-size:1.05em; margin-top:2px;">
        <span>สุทธิ</span><span>${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
      </div>
      
      <div class="hr"></div>
      <div class="flex-between">
        <span>${paymentMethod}</span>
        <span>${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
      </div>
      
      <div class="hr"></div>
      <div class="flex-between"><span>พนักงาน</span><span>${empName}</span></div>
      <div class="flex-between"><span>จุดขาย</span><span>POS #1</span></div>
      <div class="flex-between"><span>เลขที่</span><span>${recNo}</span></div>
      
      <br/><br/>
      <div class="center">** วันที่ ${now.toLocaleString("th-TH", { hour12: false })} **</div>
      <div class="center" style="margin-top:2px">${settings.footerNote || "-"}</div>
      <script>window.onload = function() { window.print(); window.close(); }</script>
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

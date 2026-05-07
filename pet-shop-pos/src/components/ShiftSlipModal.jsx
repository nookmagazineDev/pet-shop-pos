import { X, Printer } from "lucide-react";
import { usePrinter } from "../context/PrinterContext";
import toast from "react-hot-toast";

export default function ShiftSlipModal({ isOpen, onClose, shiftData }) {
  if (!isOpen || !shiftData) return null;

  const { settings } = usePrinter();
  const paperMm = parseInt(settings.paperWidth) || 80;

  const handlePrint = async () => {
    // For Shift Slip, we currently just use standard browser print or direct print if we support it.
    // For now, we'll use a clean popup print matching the slip size.
    const win = window.open("", "_blank", "width=420,height=700");
    
    let onlinePaidHtml = "";
    let onlinePendingHtml = "";
    
    if (shiftData.onlinePaid) {
      Object.entries(shiftData.onlinePaid).forEach(([platform, amt]) => {
        onlinePaidHtml += `
          <tr>
            <td style="text-align:left;">${platform} (ชำระแล้ว)</td>
            <td style="text-align:right;">${amt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
    }

    if (shiftData.onlinePending) {
      Object.entries(shiftData.onlinePending).forEach(([platform, amt]) => {
        onlinePendingHtml += `
          <tr>
            <td style="text-align:left;">${platform} (รอชำระ)</td>
            <td style="text-align:right;">${amt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
    }

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>ใบสรุปการปิดกะ</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:${paperMm <= 58 ? "11px" : "12px"}; width:${paperMm}mm; padding:4mm 3mm; background:white; color:#000; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .mb-1 { margin-bottom: 2mm; }
        .mb-2 { margin-bottom: 4mm; }
        .border-b { border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
        .border-t { border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1mm 0; vertical-align: top; }
        @media print {
          @page { margin: 0; size: auto; }
          body { width: 100%; padding: 0; }
        }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="text-center font-bold mb-1" style="font-size:1.1em;">ใบสรุปการปิดกะ (SHIFT SLIP)</div>
      <div class="text-center mb-2">${settings.storeName || "ร้านค้าของคุณ"}</div>
      
      <div class="border-b">
        <table style="margin-bottom:2mm;">
          <tr>
            <td style="width:35%;">รหัสกะ:</td>
            <td>${shiftData.shiftId || "N/A"}</td>
          </tr>
          <tr>
            <td>เปิดกะ:</td>
            <td>${new Date(shiftData.openTime).toLocaleString("th-TH")}</td>
          </tr>
          <tr>
            <td>ปิดกะ:</td>
            <td>${shiftData.closeTime ? new Date(shiftData.closeTime).toLocaleString("th-TH") : "กำลังเปิดกะ"}</td>
          </tr>
          <tr>
            <td>ผู้ทำรายการ:</td>
            <td>${shiftData.actor || "พนักงาน"}</td>
          </tr>
        </table>
      </div>

      <div class="font-bold mb-1">สรุปยอดขาย:</div>
      <table class="border-b">
        <tr>
          <td style="text-align:left;">เงินทอนเริ่มต้น</td>
          <td style="text-align:right;">${shiftData.initialCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="text-align:left;">เงินสด (Cash)</td>
          <td style="text-align:right;">${shiftData.cashSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="text-align:left;">เงินโอน (Transfer)</td>
          <td style="text-align:right;">${shiftData.transferDirect.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="text-align:left;">สแกน QR (QR)</td>
          <td style="text-align:right;">${shiftData.transferQR.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="text-align:left;">บัตรเครดิต (Credit)</td>
          <td style="text-align:right;">${shiftData.creditSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>
        ${onlinePaidHtml}
        ${onlinePendingHtml}
      </table>

      <div class="font-bold border-b">
        <table style="font-size:1.1em;">
          <tr>
            <td style="text-align:left;">รวมที่ต้องมีในลิ้นชัก</td>
            <td style="text-align:right;">${shiftData.expectedCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="text-align:left;">นับเงินได้จริง</td>
            <td style="text-align:right;">${(shiftData.actualCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="text-align:left;">ส่วนต่าง (ขาด/เกิน)</td>
            <td style="text-align:right;">${(shiftData.discrepancy || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>
      </div>

      <div class="text-center" style="font-size:0.9em; margin-top:4mm;">
        --- สิ้นสุดรายงาน ---
      </div>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">ตัวอย่างใบสรุปกะ</h3>
            <p className="text-xs text-gray-500">ขนาดกระดาษที่ตั้งค่า: {settings.paperWidth}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mock Receipt Preview */}
        <div className="p-6 bg-gray-100 flex-1 overflow-y-auto flex justify-center">
          <div 
            className="bg-white shadow-sm p-4 font-mono text-sm leading-relaxed"
            style={{ 
              width: paperMm === '58mm' ? '58mm' : '80mm',
              minHeight: '150mm'
            }}
          >
            <div className="text-center font-bold mb-2">ใบสรุปการปิดกะ</div>
            <div className="text-center mb-4">{settings.storeName || "ร้านค้าของคุณ"}</div>
            
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-xs">
              <div className="flex justify-between">
                <span>เปิดกะ:</span>
                <span>{new Date(shiftData.openTime).toLocaleString("th-TH")}</span>
              </div>
              <div className="flex justify-between">
                <span>ปิดกะ:</span>
                <span>{shiftData.closeTime ? new Date(shiftData.closeTime).toLocaleString("th-TH") : "กำลังเปิดกะ"}</span>
              </div>
            </div>

            <div className="font-bold mb-1">สรุปยอดขาย:</div>
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>เงินทอนเริ่มต้น</span>
                <span>{shiftData.initialCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>เงินสด</span>
                <span>{shiftData.cashSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>เงินโอน</span>
                <span>{shiftData.transferDirect.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>สแกน QR</span>
                <span>{shiftData.transferQR.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>บัตรเครดิต</span>
                <span>{shiftData.creditSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              
              {shiftData.onlinePaid && Object.entries(shiftData.onlinePaid).map(([platform, amt]) => (
                <div key={platform} className="flex justify-between">
                  <span>{platform} (จ่ายแล้ว)</span>
                  <span>{amt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {shiftData.onlinePending && Object.entries(shiftData.onlinePending).map(([platform, amt]) => (
                <div key={platform} className="flex justify-between">
                  <span>{platform} (รอชำระ)</span>
                  <span>{amt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div className="font-bold">
              <div className="flex justify-between">
                <span>ในลิ้นชักต้องมี</span>
                <span>{shiftData.expectedCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>นับได้จริง</span>
                <span>{(shiftData.actualCash || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-400">
                <span>ส่วนต่าง</span>
                <span>{(shiftData.discrepancy || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-2 gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handlePrint}
            className="py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            พิมพ์ใบสรุปกะ
          </button>
        </div>
      </div>
    </div>
  );
}

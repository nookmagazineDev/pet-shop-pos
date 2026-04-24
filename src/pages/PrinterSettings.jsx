import { useState } from "react";
import { usePrinter } from "../context/PrinterContext";
import { Printer, Save, TestTube, CheckCircle, Info, Wifi, Monitor, ServerCrash } from "lucide-react";
import toast from "react-hot-toast";

async function printReceipt(settings, isTest = false) {
  const paperMm = parseInt(settings.paperWidth) || 80;
  const items = isTest
    ? [
        { name: "สินค้าทดสอบ A", qty: 2, price: 150 },
        { name: "สินค้าทดสอบ B", qty: 1, price: 89.50 },
      ]
    : [];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const rows = items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${i.price.toFixed(2)}</td>
      <td style="text-align:right">${(i.price * i.qty).toFixed(2)}</td>
    </tr>`).join("");

  if (settings.enableDirectPrint) {
    // Send to Node.js local bridge
    try {
      const response = await fetch("http://localhost:3001/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          items,
          subtotal,
          tax,
          total,
          isTest,
          receiptType: "ใบกำกับภาษีอย่างย่อ"
        })
      });
      const data = await response.json();
      if (!data.success) {
        toast.error("พิมพ์ไม่สำเร็จ: " + data.message);
      } else {
        toast.success("ส่งคำสั่งพิมพ์เรียบร้อย");
      }
    } catch (e) {
      toast.error("ไม่สามารถเชื่อมต่อโปรแกรม Print Server ได้ (localhost:3001)");
    }
    return;
  }

  const win = window.open("", "_blank", "width=400,height=600");
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>ใบเสร็จ${isTest ? " (ทดสอบ)" : ""}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Courier New', monospace;
        font-size: ${paperMm <= 58 ? "11px" : "12px"};
        width: ${paperMm}mm;
        padding: 4mm 3mm;
        background: white;
        color: #000;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .hr { border-top: 1px dashed #000; margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1px 2px; vertical-align: top; }
      .total-line { font-weight: bold; font-size: 1.1em; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
      .footer { text-align: center; margin-top: 8px; font-size: 0.9em; }
      @media print {
        @page { size: ${paperMm}mm auto; margin: 0; }
      }
    </style>
  </head><body>
    <div class="center bold" style="font-size:1.2em">${settings.shopName}</div>
    <div class="center">${settings.shopAddress}</div>
    <div class="center">โทร: ${settings.shopPhone}</div>
    <div class="center">เลขภาษี: ${settings.shopTaxId} ${settings.shopBranch}</div>
    <div class="hr"></div>
    <div class="center bold">${isTest ? "** ใบทดสอบการพิมพ์ **" : "ใบกำกับภาษีอย่างย่อ"}</div>
    <div>วันที่: ${new Date().toLocaleString("th-TH")}</div>
    <div class="hr"></div>
    <table>
      <thead>
        <tr>
          <td class="bold">รายการ</td>
          <td class="bold" style="text-align:center">จน.</td>
          <td class="bold" style="text-align:right">ราคา</td>
          <td class="bold" style="text-align:right">รวม</td>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="hr"></div>
    <table>
      <tr><td>ยอดรวม</td><td style="text-align:right">${subtotal.toFixed(2)}</td></tr>
      <tr><td>VAT 7%</td><td style="text-align:right">${tax.toFixed(2)}</td></tr>
    </table>
    <div class="total-line" style="display:flex;justify-content:space-between">
      <span>รวมทั้งสิ้น</span><span>฿${total.toFixed(2)}</span>
    </div>
    <div class="hr"></div>
    <div class="footer">${settings.footerNote}</div>
    ${isTest ? `<div class="footer" style="color:#666;margin-top:6px">--- ทดสอบระบบพิมพ์ ---</div>` : ""}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export { printReceipt };

export default function PrinterSettings() {
  const { settings, updateSettings, resetSettings } = usePrinter();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleChange = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = () => {
    updateSettings(form); // save first to apply latest settings
    printReceipt(form, true);
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Printer className="text-indigo-600" /> ตั้งค่าเครื่องพิมพ์ใบเสร็จ
          </h2>
          <p className="text-sm text-gray-500 mt-1">กำหนดข้อมูลร้าน ขนาดกระดาษ และ IP เครื่องพิมพ์</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-xl font-semibold text-sm transition-colors"
          >
            <TestTube size={16} /> ทดสอบพิมพ์
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? "บันทึกแล้ว!" : "บันทึก"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Printer IP & Paper Settings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Wifi size={18} className="text-indigo-500" /> การตั้งค่าเครื่องพิมพ์</h3>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">IP เครื่องพิมพ์ (เช่น 192.168.1.100)</label>
            <input
              type="text"
              value={form.printerIp}
              onChange={handleChange("printerIp")}
              placeholder="192.168.1.100"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">บันทึกไว้เพื่ออ้างอิง หรือใช้งานร่วมกับ Direct Print ด้านล่าง</p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.enableDirectPrint}
                  onChange={(e) => setForm(prev => ({ ...prev, enableDirectPrint: e.target.checked }))}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${form.enableDirectPrint ? "bg-indigo-500" : "bg-gray-300"}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${form.enableDirectPrint ? "transform translate-x-4" : ""}`}></div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800">เปิดใช้งานเสิร์ฟเวอร์ปริ้นจิ๋ว (Direct Print Port 9100)</span>
                <span className="text-xs text-gray-500">พิมพ์ตรงหน้าต่างไม่เด้ง (ต้องเปิดโปรแกรมหลังบ้าน print-server ทิ้งไว้)</span>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">ขนาดกระดาษใบเสร็จ</label>
            <div className="flex gap-3">
              {["58", "80"].map(w => (
                <button
                  key={w}
                  onClick={() => setForm(p => ({ ...p, paperWidth: w }))}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    form.paperWidth === w
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {w} mm
                  <div className="text-xs font-normal mt-0.5 opacity-70">{w === "58" ? "ใบเสร็จเล็ก" : "ใบเสร็จมาตรฐาน"}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Shop Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Monitor size={18} className="text-indigo-500" /> ข้อมูลหัวใบเสร็จ</h3>
          {[
            { key: "shopName", label: "ชื่อร้าน / บริษัท *" },
            { key: "shopAddress", label: "ที่อยู่" },
            { key: "shopPhone", label: "เบอร์โทรศัพท์" },
            { key: "shopTaxId", label: "เลขประจำตัวผู้เสียภาษี" },
            { key: "shopBranch", label: "สาขา" },
            { key: "footerNote", label: "ข้อความท้ายใบเสร็จ" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={handleChange(key)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Windows Setup Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-4">
          <Info size={18} /> วิธีตั้งค่าเครื่องพิมพ์ IP บน Windows เพื่อพิมพ์โดยตรง
        </h3>
        <div className="space-y-2 text-sm text-blue-900">
          {[
            "เปิด Control Panel → Devices and Printers → Add a Printer",
            "เลือก \"Add a local printer or network printer with manual settings\"",
            "เลือก \"Create a new port\" → Type: Standard TCP/IP Port → กด Next",
            `กรอก IP เครื่องพิมพ์: ${form.printerIp || "192.168.x.x"} → กด Next รอสักครู่`,
            "เลือก Driver ให้ตรงกับรุ่น Printer (เช่น Epson TM-T82, Star, Bixolon) → ติดตั้ง",
            "ตั้งค่า Paper Size: ไปที่ Printer Properties → Printing Preferences → Paper → เลือก 80mm x Auto",
            "คลิกขวาที่ Printer → Set as Default Printer",
            "กลับมาที่เว็บแอปนี้ กด \"ทดสอบพิมพ์\" → เลือก Printer ที่ตั้งค่าไว้ → Print!",
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <button onClick={resetSettings} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
          รีเซ็ตค่าทั้งหมดกลับเป็นค่าเริ่มต้น
        </button>
      </div>
    </div>
  );
}

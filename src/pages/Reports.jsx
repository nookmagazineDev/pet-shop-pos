import { useState, useEffect } from "react";
import { FileText, ArrowRightLeft, Calendar, FileBox, Calculator, Loader2 } from "lucide-react";
import clsx from "clsx";
import { fetchApi } from "../api";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("sales");
  const [transactions, setTransactions] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === "sales" || activeTab === "history" || activeTab === "tax") {
      const tx = await fetchApi("getTransactions");
      setTransactions(Array.isArray(tx) ? tx : []);
    } else if (activeTab === "stock") {
      const moves = await fetchApi("getStockMovements");
      setStockMovements(Array.isArray(moves) ? moves : []);
    }
    setIsLoading(false);
  };

  const isBetweenDates = (dateStr) => {
    if (!dateStr) return false;
    const itemDate = new Date(dateStr);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return itemDate >= start && itemDate <= end;
  };

  // Process data for different views
  const filteredTransactions = transactions.filter(t => isBetweenDates(t.Date));
  const filteredStockMoves = stockMovements.filter(m => isBetweenDates(m.Date));

  // --- Reports Processing ---
  
  // 1. Sales by Product (รายการขายสินค้าตามวันที่เลือก)
  const salesByProduct = {};
  filteredTransactions.forEach(tx => {
    try {
      const cart = typeof tx.CartDetails === 'string' ? JSON.parse(tx.CartDetails) : tx.CartDetails;
      if (Array.isArray(cart)) {
        cart.forEach(item => {
          const barcode = item.Barcode || "Unknown";
          if (!salesByProduct[barcode]) {
            salesByProduct[barcode] = { name: item.name || item.Name || "Unknown", qty: 0, revenue: 0 };
          }
          salesByProduct[barcode].qty += parseFloat(item.qty || 0);
          salesByProduct[barcode].revenue += parseFloat(item.price || item.Price || 0) * parseFloat(item.qty || 0);
        });
      }
    } catch(e) {}
  });
  const salesByProductArray = Object.entries(salesByProduct).map(([barcode, data]) => ({ barcode, ...data }));

  // 2. Transasctions Split by Receipt / Tax Invoice
  const receiptsOnly = filteredTransactions.filter(t => (t.ReceiptType || "ใบเสร็จ") === "ใบเสร็จ");
  const taxInvoicesOnly = filteredTransactions.filter(t => t.ReceiptType === "ใบกำกับภาษี");

  // 3. Tax Report (รายงานภาษีขาย) Focus on Sales and Tax Collected
  const totalTaxCollected = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.Tax) || 0), 0);
  const totalSalesRevenue = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.TotalAmount) || 0), 0);


  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">ศูนย์รวมรายงาน (Reports)</h2>
        
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button 
            onClick={() => setActiveTab("sales")}
             className={clsx(
              "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === "sales" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
           >
             ยอดขายตามเมนู
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === "history" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            ประวัติการขาย (แยกใบเสร็จ/ใบกำกับ)
          </button>
          <button 
            onClick={() => setActiveTab("tax")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === "tax" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            รายงานภาษีขาย
          </button>
          <button 
            onClick={() => setActiveTab("stock")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
              activeTab === "stock" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            รายการย้ายสต็อก
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">ช่วงวันที่แสดงผล:</span>
        </div>
        <input 
          type="date" 
          value={startDate} 
          onChange={e => setStartDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
        />
        <span className="text-gray-400">ถึง</span>
        <input 
          type="date" 
          value={endDate} 
          onChange={e => setEndDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">
        {isLoading && (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
             <Loader2 size={32} className="animate-spin mb-2 text-primary" />
             กำลังโหลดข้อมูล...
          </div>
        )}

        {/* --- TAB: SALES BY PRODUCT --- */}
        {!isLoading && activeTab === "sales" && (
          <div className="flex-1 overflow-auto">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100">
               <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FileBox size={18}/> รายการขายสินค้าตามวันที่เลือก</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">Barcode</th>
                  <th className="py-3 px-6">ชื่อสินค้า</th>
                  <th className="py-3 px-6 text-right">จำนวนที่ขายได้</th>
                  <th className="py-3 px-6 text-right">ยอดขายรวม (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesByProductArray.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-gray-400">ไม่พบรายการขายในช่วงเวลานี้</td></tr>
                ) : (
                  salesByProductArray.sort((a,b) => b.qty - a.qty).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-4 px-6 text-sm text-gray-600">{item.barcode}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="py-4 px-6 text-sm text-right font-bold text-gray-800">{item.qty}</td>
                      <td className="py-4 px-6 text-sm text-right font-medium text-amber-600">฿{item.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- TAB: HISTORY BY RECEIPT/TAX INVOICE --- */}
        {!isLoading && activeTab === "history" && (
           <div className="flex-1 overflow-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              <div className="flex-1 p-0">
                <div className="p-4 bg-blue-50/50 border-b border-gray-100">
                  <h3 className="font-semibold text-blue-800">ฝั่งใบเสร็จรับเงินอย่างย่อ ({receiptsOnly.length} รายการ)</h3>
                </div>
                <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-blue-50 sticky top-0">
                      <tr className="border-b border-blue-100 text-xs font-medium text-blue-700">
                        <th className="py-2 px-4">OrderID</th>
                        <th className="py-2 px-4">วันที่</th>
                        <th className="py-2 px-4 text-right">ยอดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {receiptsOnly.length === 0 ? (
                         <tr><td colSpan="3" className="p-4 text-center text-gray-400 text-sm">ไม่พบใบเสร็จรับเงิน</td></tr>
                      ) : receiptsOnly.map((tx, i) => (
                         <tr key={i} className="hover:bg-gray-50 text-sm">
                           <td className="py-3 px-4 font-mono text-gray-600">{tx.OrderID}</td>
                           <td className="py-3 px-4 text-gray-500">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                           <td className="py-3 px-4 text-right font-medium">฿{parseFloat(tx.TotalAmount||0).toLocaleString()}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex-1 p-0">
                <div className="p-4 bg-purple-50/50 border-b border-gray-100">
                  <h3 className="font-semibold text-purple-800">ฝั่งใบกำกับภาษี ({taxInvoicesOnly.length} รายการ)</h3>
                </div>
                 <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-purple-50 sticky top-0">
                      <tr className="border-b border-purple-100 text-xs font-medium text-purple-700">
                        <th className="py-2 px-4">OrderID</th>
                        <th className="py-2 px-4">วันที่</th>
                        <th className="py-2 px-4 text-right">ยอดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {taxInvoicesOnly.length === 0 ? (
                         <tr><td colSpan="3" className="p-4 text-center text-gray-400 text-sm">ไม่พบใบกำกับภาษี</td></tr>
                      ) : taxInvoicesOnly.map((tx, i) => (
                         <tr key={i} className="hover:bg-gray-50 text-sm">
                           <td className="py-3 px-4 font-mono text-gray-600">{tx.OrderID}</td>
                           <td className="py-3 px-4 text-gray-500">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                           <td className="py-3 px-4 text-right font-medium">฿{parseFloat(tx.TotalAmount||0).toLocaleString()}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        )}

        {/* --- TAB: TAX REPORT --- */}
        {!isLoading && activeTab === "tax" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="bg-white border text-blue-800 border-blue-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Calculator className="text-blue-500" />
                    <h3 className="font-semibold text-lg">ยอดขายรวมทั้งหมด (Total Sales)</h3>
                  </div>
                  <div className="text-4xl font-bold">฿{totalSalesRevenue.toLocaleString("th-TH", {minimumFractionDigits: 2})}</div>
               </div>

               <div className="bg-white border text-amber-800 border-amber-200 rounded-2xl p-6 shadow-sm">
                 <div className="flex items-center gap-3 mb-2">
                    <Calculator className="text-amber-500" />
                    <h3 className="font-semibold text-lg">มูลค่าภาษีขายที่เก็บมาได้ (Output Tax)</h3>
                  </div>
                  <div className="text-4xl font-bold text-amber-600">฿{totalTaxCollected.toLocaleString("th-TH", {minimumFractionDigits: 2})}</div>
               </div>
            </div>

            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-4 text-lg">รายการธุรกรรมภาษี</h3>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
               <table className="w-full text-left">
                  <thead className="bg-gray-50">
                     <tr className="border-b text-sm font-medium text-gray-500">
                        <th className="p-3">วันที่</th>
                        <th className="p-3">ประเภทใบเสร็จ</th>
                        <th className="p-3">เลขที่อ้างอิง</th>
                        <th className="p-3 text-right">ยอดขายสุทธิ</th>
                        <th className="p-3 text-right text-amber-600">ภาษีมูลค่าเพิ่ม (VAT)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.filter(t => parseFloat(t.Tax) > 0).map((tx, i) => (
                      <tr key={i} className="hover:bg-gray-50 text-sm">
                        <td className="p-3 text-gray-600">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                        <td className="p-3">
                           <span className={clsx("px-2 py-1 rounded text-xs font-bold", tx.ReceiptType === "ใบกำกับภาษี" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                             {tx.ReceiptType || "ใบเสร็จ"}
                           </span>
                        </td>
                        <td className="p-3 font-mono text-gray-500">{tx.OrderID}</td>
                        <td className="p-3 text-right font-medium">฿{parseFloat(tx.TotalAmount||0).toLocaleString()}</td>
                        <td className="p-3 text-right text-amber-600 font-bold">฿{parseFloat(tx.Tax||0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredTransactions.filter(t => parseFloat(t.Tax) > 0).length === 0 && (
                      <tr><td colSpan="5" className="p-8 text-center text-gray-400">ไม่มีรายการที่มีภาษีขายในช่วงที่เลือก</td></tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {/* --- TAB: STOCK MOVEMENTS --- */}
        {!isLoading && activeTab === "stock" && (
          <div className="flex-1 overflow-auto">
            <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
               <h3 className="font-semibold text-emerald-800 flex items-center gap-2"><ArrowRightLeft size={18}/> ประวัติการย้ายสต็อกเข้าหน้าร้าน</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-50 sticky top-0">
                <tr className="border-b border-emerald-100 text-sm font-medium text-emerald-700">
                  <th className="py-3 px-6">วันที่เวลา</th>
                  <th className="py-3 px-6">Barcode / สินค้า</th>
                  <th className="py-3 px-6 text-right">จำนวน</th>
                  <th className="py-3 px-6">จาก → ถึง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredStockMoves.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-emerald-500/80">ไม่พบประวัติการย้ายสต็อกในช่วงวันที่นี้<br/><span className="text-sm opacity-80">(ระบบจะบันทึกประวัติเฉพาะเวลาที่คุณทำรายการ "ย้ายสินค้าจากคลัง → หน้าร้าน" เท่านั้น)</span></td></tr>
                ) : (
                  filteredStockMoves.map((m, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/30 text-sm">
                      <td className="py-4 px-6 text-emerald-900">{new Date(m.Date).toLocaleString("th-TH")}</td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-800">{m.Name}</div>
                        <div className="text-xs text-gray-500 font-mono">BC: {m.Barcode}</div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-emerald-700">{m.Quantity} ชิ้น</td>
                      <td className="py-4 px-6 text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{m.FromLocation}</span>
                        <span className="mx-2 text-gray-300">→</span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-semibold">{m.ToLocation}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

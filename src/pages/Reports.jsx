import { useState, useEffect } from "react";
import { FileText, ArrowRightLeft, Calendar, FileBox, Calculator, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";
import toast from "react-hot-toast";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("sales");
  const [transactions, setTransactions] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [taxInvoices, setTaxInvoices] = useState([]);
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Detail Modal States
  const [selectedTx, setSelectedTx] = useState(null);
  const [cancelNote, setCancelNote] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [returnQtys, setReturnQtys] = useState({});

  // Filter States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === "sales" || activeTab === "history" || activeTab === "tax" || activeTab === "returns") {
      const [tx, taxInv, prods, ret] = await Promise.all([
        fetchApi("getTransactions"),
        fetchApi("getTaxInvoices"),
        fetchApi("getProducts"),
        fetchApi("getReturns")
      ]);
      setTransactions(Array.isArray(tx) ? tx : []);
      setTaxInvoices(Array.isArray(taxInv) ? taxInv : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setReturnsHistory(Array.isArray(ret) ? ret : []);
    } else if (activeTab === "stock") {
      const moves = await fetchApi("getStockMovements");
      setStockMovements(Array.isArray(moves) ? moves : []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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
  const filteredTaxInvoices = taxInvoices.filter(t => isBetweenDates(t.Date));
  const filteredReturns = returnsHistory.filter(r => isBetweenDates(r.Timestamp));

  const handleViewDetails = (tx) => {
    const fullTx = filteredTransactions.find(t => t.OrderID === tx.OrderID) || tx;
    setSelectedTx(fullTx);
    setCancelNote("");
    
    // Auto-select ALL possible quantities by default for convenience
    const newQtys = {};
    try {
      const cart = typeof fullTx.CartDetails === 'string' ? JSON.parse(fullTx.CartDetails) : fullTx.CartDetails;
      if (Array.isArray(cart)) {
        cart.forEach((item, idx) => {
          const bCode = String(item.Barcode || item.barcode);
          const alreadyReturned = filteredReturns.filter(r => r.OrderID === fullTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty||0), 0);
          newQtys[idx] = Math.max(0, (parseFloat(item.qty)||0) - alreadyReturned);
        });
      }
    } catch(e) {}
    setReturnQtys(newQtys);
  };

  const handleCancelTransaction = async () => {
    // Collect selected items
    const cart = typeof selectedTx.CartDetails === 'string' ? JSON.parse(selectedTx.CartDetails) : selectedTx.CartDetails;
    let itemsToReturn = [];
    if (Array.isArray(cart)) {
      cart.forEach((item, idx) => {
        const qty = returnQtys[idx] || 0;
        if (qty > 0) {
          itemsToReturn.push({
            barcode: item.Barcode || item.barcode || "Unknown",
            name: item.Name || item.name || "Unknown",
            returnQty: qty,
            price: item.Price || item.price || 0
          });
        }
      });
    }

    if (itemsToReturn.length === 0) { toast.error("กรุณาเลือกสินค้าที่ต้องการคืนอย่างน้อย 1 ชิ้น"); return; }
    if (!cancelNote.trim()) { toast.error("กรุณาระบุเหตุผลการคืนสินค้า"); return; }
    const totalRef = itemsToReturn.reduce((sq, it) => sq + (it.returnQty * it.price), 0);
    if (!window.confirm(`คุณต้องการคืนสินค้า ${itemsToReturn.length} รายการ (มูลค่าคืนเงิน ฿${totalRef.toLocaleString()})\nแน่ใจหรือไม่? สต็อกจะบวกกลับอัตโนมัติ`)) return;
    
    setIsCancelling(true);
    let isFullCancel = true;
    if (Array.isArray(cart)) {
      cart.forEach((item, idx) => {
        const bCode = String(item.Barcode || item.barcode);
        const alreadyReturned = filteredReturns.filter(r => r.OrderID === selectedTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty||0), 0);
        const returningNow = returnQtys[idx] || 0;
        if ((parseFloat(item.qty)||0) - alreadyReturned - returningNow > 0) isFullCancel = false;
      });
    }

    const res = await postApi({
      action: "processReturn",
      payload: { orderId: selectedTx.OrderID, cancelNote, returnedItems: itemsToReturn, isFullCancel }
    });
    setIsCancelling(false);
    
    if (res.success) {
      toast.success(res.message || "ทำรายการสำเร็จ");
      setSelectedTx(null);
      setCancelNote("");
      setReturnQtys({});
      fetchData(); // Reload data
    } else {
      toast.error(res.error || "เกิดข้อผิดพลาดในการทำรายการ");
    }
  };

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
            salesByProduct[barcode] = { name: item.name || item.Name || "Unknown", qty: 0, revenue: 0, cost: 0, profit: 0 };
          }
          
          const qty = parseFloat(item.qty || 0);
          const price = parseFloat(item.price || item.Price || 0);
          let costPrice = parseFloat(item.costPrice || item.CostPrice || 0);
          
          if (costPrice === 0) {
            const fallbackProd = products.find(p => String(p.Barcode) === String(barcode)) || {};
            costPrice = parseFloat(fallbackProd.CostPrice || 0);
          }
          
          const revenue = price * qty;
          const cost = costPrice * qty;
          
          salesByProduct[barcode].qty += qty;
          salesByProduct[barcode].revenue += revenue;
          salesByProduct[barcode].cost += cost;
          salesByProduct[barcode].profit += (revenue - cost);
        });
      }
    } catch(e) {}
  });
  // Deduct Returned Items from Sales
  filteredReturns.forEach(ret => {
    const barcode = String(ret.Barcode || "Unknown");
    if (salesByProduct[barcode]) {
      const retQty = parseFloat(ret.ReturnQty || 0);
      const retRefund = parseFloat(ret.RefundAmount || 0);
      const costPerUnit = salesByProduct[barcode].qty > 0 ? (salesByProduct[barcode].cost / salesByProduct[barcode].qty) : 0;
      const retCost = costPerUnit * retQty;

      salesByProduct[barcode].qty -= retQty;
      salesByProduct[barcode].revenue -= retRefund;
      salesByProduct[barcode].cost -= retCost;
      salesByProduct[barcode].profit -= (retRefund - retCost);
    }
  });

  const salesByProductArray = Object.entries(salesByProduct).map(([barcode, data]) => ({ barcode, ...data }));
  
  const totalMenuQty = salesByProductArray.reduce((acc, obj) => acc + obj.qty, 0);
  const totalMenuRevenue = salesByProductArray.reduce((acc, obj) => acc + obj.revenue, 0);
  const totalMenuCost = salesByProductArray.reduce((acc, obj) => acc + obj.cost, 0);
  const totalMenuProfit = salesByProductArray.reduce((acc, obj) => acc + obj.profit, 0);

  // 2. Transasctions Split by Receipt / Tax Invoice
  const receiptsOnly = filteredTransactions.filter(t => (t.ReceiptType || "ใบเสร็จ") === "ใบเสร็จ");
  const taxInvoicesOnly = filteredTransactions.filter(t => t.ReceiptType === "ใบกำกับภาษี");

  // 3. Tax Report (รายงานภาษีขาย) Focus on Sales and Tax Collected
  const totalRefundAmount = filteredReturns.reduce((acc, ret) => acc + (parseFloat(ret.RefundAmount) || 0), 0);
  const grossSalesRevenue = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.TotalAmount) || 0), 0);
  const totalSalesRevenue = grossSalesRevenue - totalRefundAmount;
  
  // Try mapping tax proportion. We'll simply scale down tax by the refund ratio
  const grossTaxCollected = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.Tax) || 0), 0);
  const taxRefundRatio = grossSalesRevenue > 0 ? totalSalesRevenue / grossSalesRevenue : 1;
  const totalTaxCollected = grossTaxCollected * taxRefundRatio;


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
            onClick={() => setActiveTab("returns")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-1.5",
              activeTab === "returns" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-rose-600"
            )}
          >
            ประวัติการคืนสินค้า
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
             <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
               <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FileBox size={18}/> รายการขายสินค้าตามวันที่เลือก</h3>
               <div className="flex gap-4 text-sm font-medium">
                 <div className="text-gray-600">ยอดขายรวม: <span className="text-gray-900 font-bold">฿{totalMenuRevenue.toLocaleString()}</span></div>
                 <div className="text-gray-600">ต้นทุนรวม: <span className="text-amber-600 font-bold">฿{totalMenuCost.toLocaleString()}</span></div>
                 <div className="text-gray-600">กำไรรวม: <span className={clsx("font-bold", totalMenuProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>฿{totalMenuProfit.toLocaleString()}</span></div>
               </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">Barcode</th>
                  <th className="py-3 px-6">ชื่อสินค้า</th>
                  <th className="py-3 px-6 text-right">จำนวนที่ขายได้</th>
                  <th className="py-3 px-6 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-6 text-right">ต้นทุนรวม</th>
                  <th className="py-3 px-6 text-right">กำไรขั้นต้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesByProductArray.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-gray-400">ไม่พบรายการขายในช่วงเวลานี้</td></tr>
                ) : (
                  salesByProductArray.sort((a,b) => b.qty - a.qty).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-4 px-6 text-sm text-gray-600">{item.barcode}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="py-4 px-6 text-sm text-right font-bold text-gray-800">{item.qty}</td>
                      <td className="py-4 px-6 text-sm text-right font-medium text-blue-600">฿{item.revenue.toLocaleString()}</td>
                      <td className="py-4 px-6 text-sm text-right font-medium text-amber-600">฿{item.cost.toLocaleString()}</td>
                      <td className={clsx("py-4 px-6 text-sm text-right font-bold", item.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>฿{item.profit.toLocaleString()}</td>
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
                         <tr key={i} onClick={() => handleViewDetails(tx)} className="hover:bg-gray-50 text-sm cursor-pointer transition-colors">
                           <td className="py-3 px-4 font-mono text-gray-600 flex items-center gap-2">
                             {tx.OrderID}
                             {tx.Status === "CANCELLED" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">ยกเลิกแล้ว</span>}
                           </td>
                           <td className="py-3 px-4 text-gray-500">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                           <td className="py-3 px-4 text-right font-medium">฿{parseFloat(tx.TotalAmount||0).toLocaleString()}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex-[1.5] p-0">
                <div className="p-4 bg-purple-50/50 border-b border-gray-100">
                  <h3 className="font-semibold text-purple-800">ฝั่งใบกำกับภาษี ({filteredTaxInvoices.length} รายการ)</h3>
                </div>
                 <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-purple-50 sticky top-0">
                      <tr className="border-b border-purple-100 text-xs font-medium text-purple-700">
                        <th className="py-2 px-4">เลขใบกำกับ</th>
                        <th className="py-2 px-4">วันที่</th>
                        <th className="py-2 px-4">ลูกค้า</th>
                        <th className="py-2 px-4">เลขประตัวผู้เสียภาษี</th>
                        <th className="py-2 px-4 text-right">ยอดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTaxInvoices.length === 0 ? (
                         <tr><td colSpan="5" className="p-4 text-center text-gray-400 text-sm">ไม่พบใบกำกับภาษี</td></tr>
                      ) : filteredTaxInvoices.map((tx, i) => {
                         const matchStatus = filteredTransactions.find(t => t.OrderID === tx.OrderID)?.Status;
                         return (
                         <tr key={i} onClick={() => handleViewDetails(tx)} className="hover:bg-gray-50 text-sm cursor-pointer transition-colors">
                           <td className="py-3 px-4 font-mono text-purple-600 flex flex-col items-start gap-1">
                             <span>{tx.TaxInvoiceNo}</span>
                             {matchStatus === "CANCELLED" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">ยกเลิกแล้ว</span>}
                           </td>
                           <td className="py-3 px-4 text-gray-500">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                           <td className="py-3 px-4 text-gray-800">{tx.CustomerName}</td>
                           <td className="py-3 px-4 text-gray-500 font-mono">{tx.CustomerTaxID}</td>
                           <td className="py-3 px-4 text-right font-bold text-gray-800">฿{parseFloat(tx.TotalAmount||0).toLocaleString()}</td>
                         </tr>
                      )})}
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
                   <ArrowRightLeft className="text-emerald-500" />
                   <h3 className="font-semibold text-lg">ภาษีขายโดยประมาณ (Estimated Tax)</h3>
                 </div>
                 <div className="text-4xl font-bold">฿{totalTaxCollected.toLocaleString("th-TH", {minimumFractionDigits: 2})}</div>
                 <div className="text-sm mt-3 font-medium opacity-80">(หักลบยอดส่วนลดและยอดคืนสินค้าแล้ว)</div>
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

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">รายละเอียดบิล <span className="font-mono text-primary text-sm bg-blue-50 px-2 py-0.5 rounded">{selectedTx.OrderID}</span></h3>
              <button onClick={() => setSelectedTx(null)} className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 flex-1 overflow-auto">
              <div className="mb-5 grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div><strong>วันที่:</strong> <span className="text-gray-900">{new Date(selectedTx.Date).toLocaleString("th-TH")}</span></div>
                <div><strong>พนักงาน (ดึงชื่อ):</strong> <span className="text-gray-900">{selectedTx.Username || "-"}</span></div>
                <div><strong>ช่องทาง:</strong> <span className="text-gray-900">{selectedTx.PaymentMethod || "-"}</span></div>
                <div>
                   <strong>สถานะ:</strong> 
                   {selectedTx.Status === "CANCELLED" 
                     ? <span className="text-red-600 font-bold ml-1 bg-red-100 px-2 py-0.5 rounded">ยกเลิก/ขอคืน</span>
                     : <span className="text-emerald-600 font-bold ml-1 bg-emerald-100 px-2 py-0.5 rounded">สมบูรณ์</span>}
                </div>
              </div>
              
              {selectedTx.Status === "CANCELLED" && (
                <div className="mb-5 p-3 bg-red-50 text-red-800 text-sm rounded-xl border border-red-200 shadow-sm flex flex-col gap-1">
                   <div className="font-bold text-red-900 flex items-center gap-2"><ArrowRightLeft size={16}/> บิลนี้ถูกยกเลิกแล้ว</div>
                   <div className="text-red-700 font-medium">หมายเหตุ: {selectedTx.CancelNote || "-"}</div>
                </div>
              )}

              <h4 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex justify-between">
                <span>รายการสินค้า</span>
                {selectedTx.Status !== "CANCELLED" && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">* ปรับ +/- เพื่อระบุจำนวนที่ต้องการคืน</span>}
              </h4>
              <ul className="space-y-3 mb-5">
                {(()=>{
                  try {
                    const cart = typeof selectedTx.CartDetails === 'string' ? JSON.parse(selectedTx.CartDetails) : selectedTx.CartDetails;
                    if (Array.isArray(cart)) {
                      return cart.map((item, idx) => {
                        const bCode = String(item.Barcode || item.barcode);
                        const alreadyReturned = filteredReturns.filter(r => r.OrderID === selectedTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty||0), 0);
                        const maxReturn = (parseFloat(item.qty)||0) - alreadyReturned;
                        const returnQty = returnQtys[idx] || 0;
                        const price = item.price || item.Price || 0;

                        return (
                        <li key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm border-b border-gray-50 pb-2">
                           <div className="flex-1 mb-2 sm:mb-0">
                             <span className="font-medium text-gray-800">{item.qty}x {item.name || item.Name}</span>
                             <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">฿{price.toLocaleString()} ต่อชิ้น</div>
                             {alreadyReturned > 0 && <div className="text-xs text-rose-500 font-bold mt-0.5">ถูกคืนไปแล้ว {alreadyReturned} ชิ้น</div>}
                           </div>
                           <div className="flex items-center gap-3">
                              {selectedTx.Status !== "CANCELLED" && maxReturn > 0 ? (
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                  <button onClick={() => setReturnQtys(p => ({...p, [idx]: Math.max(0, (p[idx]||0) - 1)}))} className="px-2 py-1 bg-gray-50 hover:bg-red-50 text-red-500 font-bold transition-colors">-</button>
                                  <span className="px-3 text-sm font-bold text-gray-700 w-8 text-center">{returnQty}</span>
                                  <button onClick={() => setReturnQtys(p => ({...p, [idx]: Math.min(maxReturn, (p[idx]||0) + 1)}))} className="px-2 py-1 bg-gray-50 hover:bg-emerald-50 text-emerald-600 font-bold transition-colors">+</button>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 font-medium px-2 truncate w-24 text-right">
                                  {maxReturn === 0 && selectedTx.Status !== "CANCELLED" ? "(ไม่มีให้คืนเพิ่ม)" : ""}
                                </div>
                              )}
                              <span className="font-medium text-gray-900 text-right w-16">฿{(price * item.qty).toLocaleString()}</span>
                           </div>
                        </li>
                      )});
                    }
                  } catch(e) {}
                  return <li className="text-sm text-gray-500">ไม่สามารถโหลดรายการสินค้าได้</li>;
                })()}
              </ul>
              
              <div className="flex justify-between border-t border-gray-200 pt-3 font-bold text-gray-800 text-lg">
                 <span>ยอดสุทธิ (เดิม)</span>
                 <span className="text-primary">฿{parseFloat(selectedTx.TotalAmount || 0).toLocaleString()}</span>
              </div>

              {selectedTx.Status !== "CANCELLED" && (
                <div className="flex justify-between mt-2 font-bold text-rose-600 text-lg bg-rose-50 p-3 rounded-xl border border-rose-100 shadow-sm">
                   <span>ยอดที่จะคืนเงินลูกค้า (Refund)</span>
                   <span>฿{(()=>{
                     let ref = 0;
                     const c = typeof selectedTx.CartDetails === 'string' ? JSON.parse(selectedTx.CartDetails) : selectedTx.CartDetails;
                     if(Array.isArray(c)) c.forEach((it, i) => ref += (it.price||it.Price||0)*(returnQtys[i]||0));
                     return ref.toLocaleString();
                   })()}</span>
                </div>
              )}
            </div>
            
            {/* Action Bar */}
            {selectedTx.Status !== "CANCELLED" && (
              <div className="p-4 bg-gray-50 border-t flex flex-col gap-3">
                 <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">* ⚠️ สินค้าที่ระบุยอดคืน จะถูกบวกสต็อกกลับเข้าคลังหน้าร้าน และเก็บเข้าประวัติย้ายสต็อกโดยอัตโนมัติ</p>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      placeholder="ระบุหมายเหตุ/เหตุผลที่ยกเลิก (บังคับ)" 
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all font-medium"
                      value={cancelNote}
                      onChange={e => setCancelNote(e.target.value)}
                    />
                    <button 
                      onClick={handleCancelTransaction}
                      disabled={isCancelling}
                      className="whitespace-nowrap px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCancelling ? "ระบบกำลังดำเนินการ..." : "ยืนยันยกเลิก/คืนออเดอร์"}
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

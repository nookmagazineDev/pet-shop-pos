import { useState, useEffect, useMemo, useRef } from "react";
import { fetchApi, postApi } from "../api";
import { Wallet, FileText, Printer, CheckCircle, FileUp, Loader2, RefreshCw, X, TrendingUp, TrendingDown, DollarSign, Calendar, FileSpreadsheet, Ban } from "lucide-react";
import clsx from "clsx";
import * as XLSX from "xlsx";
import TaxInvoiceModal from "../components/TaxInvoiceModal";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("income");
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef(null);

  // Date filter
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  // Computed filtered data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.Date || tx.Timestamp || tx[1]);
      return d >= new Date(dateFrom) && d <= new Date(dateTo + 'T23:59:59');
    });
  }, [transactions, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = new Date(exp.Date || exp.Timestamp || exp[1] || exp[0]);
      return d >= new Date(dateFrom) && d <= new Date(dateTo + 'T23:59:59');
    });
  }, [expenses, dateFrom, dateTo]);

  const totalIncome = useMemo(() => filteredTransactions.filter(tx => (tx.Status || tx[13]) !== "CANCELLED").reduce((sum, tx) => sum + (parseFloat(tx.TotalAmount || tx[2]) || 0), 0), [filteredTransactions]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount || exp[4]) || 0), 0), [filteredExpenses]);
  const netProfit = totalIncome - totalExpenses;

  // Expense form state
  const [expenseData, setExpenseData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    category: "วัตถุดิบ/สินค้า",
    amount: "",
  });
  const [expenseFile, setExpenseFile] = useState(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "", address: "", taxId: "", phone: "" });
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  // Expense Items modal
  const [expenseItemsModal, setExpenseItemsModal] = useState(false);
  const [selectedExpenseItems, setSelectedExpenseItems] = useState([]);

  // Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipData, setSlipData] = useState(null);

  // Cancel Bill Modal
  const [cancelModal, setCancelModal] = useState(null); // tx object or null
  const [cancelNoteInput, setCancelNoteInput] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === "income") {
      const data = await fetchApi("getTransactions");
      const taxInvoicesData = await fetchApi("getTaxInvoices");
      
      let txList = Array.isArray(data) ? data : [];
      let taxInvList = Array.isArray(taxInvoicesData) ? taxInvoicesData : [];
      
      // Map TaxInvoiceNo from TaxInvoices sheet (Col A) using OrderID
      txList = txList.map(tx => {
        const orderId = tx.OrderID || tx[0];
        const taxInv = taxInvList.find(t => (t.OrderID || t[2]) === orderId);
        if (taxInv) {
          tx.TaxInvoiceNo = taxInv.TaxInvoiceNo || taxInv[0];
          tx.TaxInvoiceCustomerName = taxInv.CustomerName || taxInv[3];
          tx.TaxInvoiceCustomerAddress = taxInv.CustomerAddress || taxInv[4];
          tx.TaxInvoiceCustomerTaxID = taxInv.CustomerTaxID || taxInv[5];
        }
        return tx;
      });
      
      setTransactions(txList.reverse());
      
      const custData = await fetchApi("getCustomers");
      setCustomers(Array.isArray(custData) ? custData : []);
    } else {
      const data = await fetchApi("getExpenses");
      setExpenses(Array.isArray(data) ? data.reverse() : []);
    }
    setIsLoading(false);
  };

  const exportToExcel = (type) => {
    if (type === "income") {
      const rows = filteredTransactions.map(tx => ({
        "วันที่/เวลา": new Date(tx.Date || tx.Timestamp || tx[1]).toLocaleString("th-TH"),
        "รหัสออเดอร์": tx.OrderID || tx[0],
        "ยอดรับ (บาท)": parseFloat(tx.TotalAmount || tx[2]) || 0,
        "ช่องทางชำระ": tx.PaymentMethod || tx[4],
      }));
      rows.push({});
      rows.push({ "วันที่/เวลา": "รวมทั้งสิ้น", "ยอดรับ (บาท)": totalIncome });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายรับ");
      XLSX.writeFile(wb, `income_${dateFrom}_to_${dateTo}.xlsx`);
    } else {
      const rows = filteredExpenses.map(exp => ({
        "วันที่ชำระ": new Date(exp.Date || exp.Timestamp || exp[1] || exp[0]).toLocaleDateString("th-TH"),
        "รายการ": exp.Description || exp[2],
        "หมวดหมู่": exp.Category || exp[3],
        "ยอดเงิน (บาท)": parseFloat(exp.Amount || exp[4]) || 0,
      }));
      rows.push({});
      rows.push({ "วันที่ชำระ": "รวมทั้งสิ้น", "ยอดเงิน (บาท)": totalExpenses });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายจ่าย");
      XLSX.writeFile(wb, `expenses_${dateFrom}_to_${dateTo}.xlsx`);
    }
  };

  const exportToPDF = (type) => {
    const printWindow = window.open("", "_blank");
    const title = type === "income" ? "รายงานรายรับ" : "รายงานรายจ่าย";
    const rows = type === "income"
      ? filteredTransactions.map(tx => `<tr>
          <td>${new Date(tx.Date || tx.Timestamp || tx[1]).toLocaleString("th-TH")}</td>
          <td>${tx.OrderID || tx[0]}</td>
          <td style="text-align:right">฿${parseFloat(tx.TotalAmount || tx[2]).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
          <td>${tx.PaymentMethod || tx[4] || ""}</td>
        </tr>`).join("")
      : filteredExpenses.map(exp => `<tr>
          <td>${new Date(exp.Date || exp.Timestamp || exp[1] || exp[0]).toLocaleDateString("th-TH")}</td>
          <td>${exp.Description || exp[2] || ""}</td>
          <td>${exp.Category || exp[3] || ""}</td>
          <td style="text-align:right">฿${parseFloat(exp.Amount || exp[4]).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
        </tr>`).join("");
    const headers = type === "income"
      ? `<th>วันที่/เวลา</th><th>รหัสออเดอร์</th><th>ยอดรับ (บาท)</th><th>ช่องทางชำระ</th>`
      : `<th>วันที่ชำระ</th><th>รายการ</th><th>หมวดหมู่</th><th>ยอดเงิน (บาท)</th>`;
    const total = type === "income" ? totalIncome : totalExpenses;
    printWindow.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; }
        th { background: #f0f0f0; text-align: left; }
        tfoot td { font-weight: bold; background: #f9f9f9; }
        @page { margin: 15mm; }
      </style></head><body>
      <h1>${title}</h1>
      <p>ช่วงวันที่: ${dateFrom} ถึง ${dateTo}</p>
      <table><thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3"><strong>ยอดรวม</strong></td><td style="text-align:right"><strong>฿${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></td></tr></tfoot>
      </table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleExpenseFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExpenseFile({
          fileName: file.name,
          base64: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setIsSubmittingExpense(true);

    const payload = {
      action: "addExpense",
      payload: {
        date: expenseData.date,
        description: expenseData.description,
        category: expenseData.category,
        amount: expenseData.amount,
        fileName: expenseFile ? expenseFile.fileName : "",
        fileData: expenseFile ? expenseFile.base64 : ""
      }
    };

    const res = await postApi(payload);
    setIsSubmittingExpense(false);

    if (res.success) {
      alert("บันทึกรายจ่ายเรียบร้อยแล้ว!");
      setExpenseData({
        date: new Date().toISOString().split('T')[0],
        description: "",
        category: "วัตถุดิบ/สินค้า",
        amount: "",
      });
      setExpenseFile(null);
      e.target.reset();
      fetchData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleIssueTaxInvoice = async () => {
    if (!selectedTx) return;
    setIsSavingInvoice(true);
    const res = await postApi({
      action: "saveTaxInvoice",
      payload: {
        orderId: selectedTx.OrderID || selectedTx[0],
        totalAmount: parseFloat(selectedTx.TotalAmount || selectedTx[2]) || 0,
        taxAmount: parseFloat(selectedTx.Tax || selectedTx[3]) || 0,
        customerInfo
      }
    });
    setIsSavingInvoice(false);
    if (res.success) {
      setTransactions(prev => prev.map(tx =>
        (tx.OrderID || tx[0]) === (selectedTx.OrderID || selectedTx[0])
          ? { ...tx, TaxInvoiceNo: res.taxInvoiceNo }
          : tx
      ));
      setSelectedTx(prev => ({ ...prev, TaxInvoiceNo: res.taxInvoiceNo }));
      alert(`ออกใบกำกับภาษีเลขที่: ${res.taxInvoiceNo}\n${res.message}`);
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleCancelBill = async () => {
    if (!cancelNoteInput.trim()) { alert("กรุณาระบุสาเหตุการยกเลิกบิล"); return; }
    setIsCancelling(true);
    const res = await postApi({
      action: "cancelTransaction",
      payload: { orderId: cancelModal.OrderID || cancelModal[0], cancelNote: cancelNoteInput.trim() }
    });
    setIsCancelling(false);
    if (res.success) {
      setTransactions(prev => prev.map(tx =>
        (tx.OrderID || tx[0]) === (cancelModal.OrderID || cancelModal[0])
          ? { ...tx, Status: "CANCELLED", CancelNote: cancelNoteInput.trim() }
          : tx
      ));
      setCancelModal(null);
      setCancelNoteInput("");
      alert("ยกเลิกบิลสำเร็จแล้ว");
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handlePrintTaxInvoice = async () => {
    if (customerInfo.name) {
      postApi({
        action: "saveCustomer",
        payload: {
          name: customerInfo.name,
          phone: customerInfo.phone,
          address: customerInfo.address,
          taxId: customerInfo.taxId,
          lastInvoiceId: selectedTx.OrderID || selectedTx[0] || "",
          lastInvoiceDate: new Date().toISOString()
        }
      });
    }
    // Set timeout to allow React to render any UI state, though optional.
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header + Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">บัญชี / รายรับ-รายจ่าย</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab("income")} className={clsx("px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2", activeTab === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-900")}>
            <Wallet size={16} /> รายรับ (Income)
          </button>
          <button onClick={() => setActiveTab("expense")} className={clsx("px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2", activeTab === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-900")}>
            <FileText size={16} /> รายจ่าย (Expenses)
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm">
        <Calendar size={16} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-600">กรองตามวันที่:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">เริ่มต้น</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">สิ้นสุด</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={() => { setDateFrom(firstOfMonth); setDateTo(today); }} className="text-xs text-primary hover:underline ml-2">รีเซ็ต</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp size={22} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-600 mb-0.5">รายรับรวม</p>
            <p className="text-xl font-bold text-emerald-700">฿{totalIncome.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-emerald-500">{filteredTransactions.length} รายการ</p>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingDown size={22} className="text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-rose-600 mb-0.5">รายจ่ายรวม</p>
            <p className="text-xl font-bold text-rose-700">฿{totalExpenses.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-rose-500">{filteredExpenses.length} รายการ</p>
          </div>
        </div>
        <div className={clsx("border rounded-2xl p-5 flex items-center gap-4", netProfit >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100")}>
          <div className={clsx("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", netProfit >= 0 ? "bg-blue-100" : "bg-orange-100")}>
            <DollarSign size={22} className={netProfit >= 0 ? "text-blue-600" : "text-orange-600"} />
          </div>
          <div>
            <p className={clsx("text-xs font-medium mb-0.5", netProfit >= 0 ? "text-blue-600" : "text-orange-600")}>{netProfit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</p>
            <p className={clsx("text-xl font-bold", netProfit >= 0 ? "text-blue-700" : "text-orange-700")}>฿{Math.abs(netProfit).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-400">รายรับ - รายจ่าย</p>
          </div>
        </div>
      </div>

      {/* INCOME TAB */}
      {activeTab === "income" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-emerald-50/50 rounded-t-2xl">
            <h3 className="font-semibold text-emerald-800">ประวัติการขาย (รายรับ)</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => exportToExcel("income")} className="text-emerald-700 flex items-center gap-1 text-sm bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={() => exportToPDF("income")} className="text-blue-700 flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                <Printer size={14} /> PDF
              </button>
              <button onClick={fetchData} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm bg-emerald-100 px-3 py-1.5 rounded-lg">
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> รีเฟรช
              </button>
            </div>
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">วันที่เวลา</th>
                  <th className="py-3 px-6">เลขที่ใบเสร็จ</th>
                  <th className="py-3 px-6">เลขที่ใบกำกับภาษี</th>
                  <th className="py-3 px-6 text-right">ยอดก่อน VAT</th>
                  <th className="py-3 px-6 text-right">ยอด VAT</th>
                  <th className="py-3 px-6 text-right">ยอดรับสุทธิ (บาท)</th>
                  <th className="py-3 px-6 text-center">ช่องทาง</th>
                  <th className="py-3 px-6 text-center">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan="8" className="py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr><td colSpan="8" className="py-8 text-center text-gray-400">ไม่มีรายการในช่วงวันที่เลือก</td></tr>
                ) : filteredTransactions.map((tx, idx) => {
                  const totalAmt = parseFloat(tx.TotalAmount || tx[2]) || 0;
                  const preVat = totalAmt * 100 / 107;
                  const vatAmt = totalAmt * 7 / 107;
                  const isCancelled = (tx.Status || tx[13]) === "CANCELLED";
                  return (
                    <tr key={idx} className={`hover:bg-emerald-50/30 transition-colors group ${isCancelled ? "opacity-60 bg-red-50/40" : ""}`}>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {new Date(tx.Date || tx.Timestamp || tx[1]).toLocaleString("th-TH")}
                        {isCancelled && <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">VOID</span>}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono font-medium text-gray-900">{tx.ReceiptNo || tx.OrderID || tx[0]}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-700">
                        {tx.TaxInvoiceNo || tx[15] ? <span className="uppercase text-primary font-bold">{tx.TaxInvoiceNo || tx[15]}</span> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-gray-700">
                        ฿{preVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-rose-600">
                        ฿{vatAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-emerald-600">
                        ฿{totalAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {tx.PaymentMethod || tx[4]}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            onClick={() => {
                              try {
                                const cart = JSON.parse(tx.CartDetails || tx[5] || "[]");
                                const total = parseFloat(tx.TotalAmount || tx[2]) || 0;
                                const tax = parseFloat(tx.Tax || tx[3] || 0) || (total * 7 / 107);
                                const subtotal = cart.reduce((sum, item) => sum + ((item.price || item.Price || 0) * (item.qty || item.quantity || 1)), 0);
                                const discountAmount = subtotal - total;
                                setSlipData({
                                  cart: cart.map(c => ({...c, qty: c.qty || c.quantity, price: c.price || c.Price, name: c.name || c.Name})),
                                  paymentMethod: tx.PaymentMethod || tx[4],
                                  subtotal,
                                  discountAmount: discountAmount > 0 ? discountAmount : 0,
                                  tax,
                                  total,
                                  receiptType: tx.ReceiptType || tx[6] || "ใบเสร็จรับเงิน",
                                  taxInvoiceNo: tx.TaxInvoiceNo || tx[15] || tx.ReceiptNo || tx.OrderID || tx[0]
                                });
                                setSlipModalOpen(true);
                              } catch(e) {
                                alert("ไม่สามารถโหลดข้อมูลสลิปได้");
                              }
                            }}
                            className="w-full px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            ปริ้นสลิป
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTx(tx);
                              let cName = "", cAddress = "", cTaxId = "", cPhone = "";
                              if (tx.TaxInvoiceCustomerName && tx.TaxInvoiceCustomerName !== "-") {
                                 cName = tx.TaxInvoiceCustomerName;
                                 cAddress = tx.TaxInvoiceCustomerAddress === "-" ? "" : (tx.TaxInvoiceCustomerAddress || "");
                                 cTaxId = tx.TaxInvoiceCustomerTaxID === "-" ? "" : (tx.TaxInvoiceCustomerTaxID || "");
                              } else if (tx.CustomerInfo || tx[10]) {
                                 try {
                                   const ci = JSON.parse(tx.CustomerInfo || tx[10]);
                                   cName = ci.name || ci.customerName || "";
                                   cAddress = ci.address || ci.customerAddress || "";
                                   cTaxId = ci.taxId || ci.customerTaxId || "";
                                   cPhone = ci.phone || ci.customerPhone || "";
                                 } catch (e) {}
                              }
                              setCustomerInfo({ name: cName, address: cAddress, taxId: cTaxId, phone: cPhone });
                              setInvoiceModal(true);
                            }}
                            className="w-full px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                          >
                            ใบเสร็จ (A4)
                          </button>
                          {tx.TaxInvoiceNo || tx[15]
                            ? <span className="text-[10px] text-purple-600 font-mono font-bold bg-purple-50 px-2 py-0.5 rounded w-full text-center">{tx.TaxInvoiceNo || tx[15]}</span>
                            : <button
                                onClick={() => {
                                  setSelectedTx(tx);
                                  let cName = "", cAddress = "", cTaxId = "", cPhone = "";
                                  if (tx.CustomerInfo || tx[10]) {
                                    try {
                                      const ci = JSON.parse(tx.CustomerInfo || tx[10]);
                                      cName = ci.name || ci.customerName || "";
                                      cAddress = ci.address || ci.customerAddress || "";
                                      cTaxId = ci.taxId || ci.customerTaxId || "";
                                      cPhone = ci.phone || ci.customerPhone || "";
                                    } catch (e) {}
                                  }
                                  setCustomerInfo({ name: cName, address: cAddress, taxId: cTaxId, phone: cPhone });
                                  setInvoiceModal(true);
                                }}
                                className="w-full px-3 py-1 text-[10px] font-semibold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                              >
                                + ออกใบกำกับภาษี
                              </button>
                          }
                          {isCancelled
                            ? <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded w-full text-center border border-red-200">{tx.CancelNote || tx[14] || "VOID"}</span>
                            : <button
                                onClick={() => { setCancelModal(tx); setCancelNoteInput(""); }}
                                className="w-full px-3 py-1 text-[10px] font-semibold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200 flex items-center justify-center gap-1"
                              >
                                <Ban size={10} /> ยกเลิกบิล
                              </button>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPENSE TAB */}
      {activeTab === "expense" && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          
          {/* New Expense Form */}
          <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-max shrink-0">
            <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <FileUp className="text-rose-500" size={20} /> บันทึกรายจ่ายใหม่
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                <input 
                  type="date" required
                  value={expenseData.date}
                  onChange={e => setExpenseData({...expenseData, date: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                <select 
                  value={expenseData.category}
                  onChange={e => setExpenseData({...expenseData, category: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                >
                  <option>วัตถุดิบ/สินค้า</option>
                  <option>ค่าขนส่ง</option>
                  <option>ค่าสาธารณูปโภค</option>
                  <option>เงินเดือน/ค่าจ้าง</option>
                  <option>อุปกรณ์/สำนักงาน</option>
                  <option>อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายการ (คำอธิบาย)</label>
                <input 
                  type="text" required
                  value={expenseData.description}
                  onChange={e => setExpenseData({...expenseData, description: e.target.value})}
                  placeholder="เช่น ค่าจัดส่ง Kerry"
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงิน (บาท)</label>
                <input 
                  type="number" required min="0" step="0.01"
                  value={expenseData.amount}
                  onChange={e => setExpenseData({...expenseData, amount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แนบไฟล์แจ้งยอด/บิล (รูปภาพ/PDF) *</label>
                <input 
                  type="file" required accept="image/*,.pdf"
                  onChange={handleExpenseFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />
              </div>
              <button 
                type="submit" disabled={isSubmittingExpense}
                className="w-full mt-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmittingExpense ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {isSubmittingExpense ? "กำลังอัปโหลดและบันทึก..." : "บันทึกรายจ่าย"}
              </button>
            </form>
          </div>

          {/* Expense History Table */}
          <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-rose-50/50 rounded-t-2xl">
              <h3 className="font-semibold text-rose-800">ประวัติรายจ่ายทั้งหมด</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => exportToExcel("expense")} className="text-rose-700 flex items-center gap-1 text-sm bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button onClick={() => exportToPDF("expense")} className="text-blue-700 flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <Printer size={14} /> PDF
                </button>
                <button onClick={fetchData} className="text-rose-600 hover:text-rose-700 flex items-center gap-1 text-sm bg-rose-100 px-3 py-1.5 rounded-lg">
                  <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> รีเฟรช
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                    <th className="py-3 px-6">วันที่ชำระ</th>
                    <th className="py-3 px-6">รายการ</th>
                    <th className="py-3 px-6">หมวดหมู่</th>
                    <th className="py-3 px-6 text-right">ยอดเงิน</th>
                    <th className="py-3 px-6 text-center">เอกสารอ้างอิง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-400">ไม่มีรายการในช่วงวันที่เลือก</td></tr>
                  ) : filteredExpenses.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                      {/* Note: Auto-mapped from Sheet headers to Object properties */}
                      <td className="py-4 px-6 text-sm text-gray-600">{new Date(exp.Date || exp.Timestamp || exp[1] || exp[0]).toLocaleDateString("th-TH")}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900">{exp.Description || exp[2]}</td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">{exp.Category || exp[3]}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-rose-600">
                        ฿{parseFloat(exp.Amount || exp[4]).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {exp.ItemsJSON || exp[6] ? (
                            <button 
                              onClick={() => {
                                try {
                                  setSelectedExpenseItems(JSON.parse(exp.ItemsJSON || exp[6]));
                                  setExpenseItemsModal(true);
                                } catch(e) {
                                  alert("ไม่สามารถเปิดข้อมูลเอกสารได้");
                                }
                              }}
                              className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors w-full text-center"
                            >
                              ดูข้อมูลเอกสาร
                            </button>
                          ) : null}
                          {exp.ReceiptFileURL || exp[5] ? (
                            <a href={exp.ReceiptFileURL || exp[5]} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors w-full text-center">ดูเอกสารแนบ</a>
                          ) : <span className="text-gray-400 text-xs">-</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceModal && selectedTx && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:block overflow-auto">
          {/* We hide the modal wrapper border and backgrounds in `print:` context. */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] print:max-w-full print:shadow-none print:max-h-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 print:hidden shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Printer size={20} className="text-primary" /> ออกใบกำกับภาษี / ใบเสร็จรับเงิน
              </h3>
              <button onClick={() => { setInvoiceModal(false); setSelectedTx(null); }} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            {/* INVOICE CONTENT */}
            <div className="p-8 overflow-y-auto print:overflow-visible">
              
              {/* Form Input for Customer Details (Hidden while printing) */}
              <div className="mb-6 grid grid-cols-2 gap-4 border-b border-gray-200 pb-6 print:hidden">
                <div className="col-span-2 text-sm text-gray-500 font-medium mb-2">กรอกข้อมูลลูกค้า (ถ้ามี)</div>
                <div className="col-span-2 sm:col-span-1">
                  <input type="text" list="customers-list" placeholder="ชื่อลูกค้า / บริษัท" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.name} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = customers.find(c => c.Name === val);
                      if (match) {
                        setCustomerInfo({ name: match.Name, phone: match.Phone || "", address: match.Address || "", taxId: match.TaxID || "" });
                      } else {
                        setCustomerInfo({...customerInfo, name: val});
                      }
                    }} 
                  />
                  <datalist id="customers-list">
                    {customers.map((c, i) => <option key={i} value={c.Name} />)}
                  </datalist>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <input type="text" placeholder="เบอร์โทรศัพท์" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <textarea placeholder="ที่อยู่..." className="w-full px-3 py-2 border rounded-lg h-16" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})}></textarea>
                </div>
                <div className="col-span-2">
                  <input type="text" placeholder="เลขประจำตัวผู้เสียภาษี (13 หลัก)" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.taxId} onChange={e => setCustomerInfo({...customerInfo, taxId: e.target.value})} />
                </div>
              </div>

              {/* Printable Area below */}
              <div id="printable-tax-invoice" className="font-sans text-gray-900 bg-white">
                <div className="text-center mb-6 border-b pb-4 border-gray-800">
                  <h1 className="text-2xl font-bold mb-1">ใบกำกับภาษี / ใบเสร็จรับเงิน</h1>
                  <p className="text-sm">TAX INVOICE / RECEIPT</p>
                  <p className="text-sm mt-2 font-bold">บริษัทมะมามี (1989) จำกัด</p>
                  <p className="text-xs text-gray-600">100/116 พุทธมณฑลสาย 2 ซอย 24 แขวงศาลาธรรมสพน์ เขตทวีวัฒนา กรุงเทพมหานคร 10170</p>
                  <p className="text-xs text-gray-600">โทร : 0853638383</p>
                  <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี 0105565009021 สาขา 00001</p>
                </div>

                <div className="flex justify-between items-start mb-6 text-sm">
                  <div className="w-1/2 pr-4 space-y-1">
                    <p><span className="font-semibold">ชื่อลูกค้า:</span> {customerInfo.name || "-"}</p>
                    <p><span className="font-semibold">เบอร์โทรศัพท์:</span> {customerInfo.phone || "-"}</p>
                    <p><span className="font-semibold">ที่อยู่:</span> {customerInfo.address || "-"}</p>
                    <p><span className="font-semibold">เลขประจำตัวผู้เสียภาษี:</span> {customerInfo.taxId || "-"}</p>
                  </div>
                  <div className="w-1/2 pl-4 text-right space-y-1">
                    {(selectedTx.TaxInvoiceNo || selectedTx[15]) && (
                      <p><span className="font-semibold">เลขที่ใบกำกับภาษี:</span> <span className="uppercase">{selectedTx.TaxInvoiceNo || selectedTx[15]}</span></p>
                    )}
                    <p><span className="font-semibold">เลขที่ใบเสร็จ:</span> {selectedTx.ReceiptNo || selectedTx.OrderID || selectedTx[0]}</p>
                    <p><span className="font-semibold">วันที่:</span> {new Date(selectedTx.Date || selectedTx.Timestamp || selectedTx[1]).toLocaleString("th-TH")}</p>
                    <p><span className="font-semibold">ช่องทางชำระ:</span> {selectedTx.PaymentMethod || selectedTx[4]}</p>
                  </div>
                </div>

                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="border-y border-gray-800 bg-gray-50/50">
                      <th className="py-2 px-2">ลำดับ</th>
                      <th className="py-2 px-2">รายการสินค้า</th>
                      <th className="py-2 px-2 text-center">จำนวน</th>
                      <th className="py-2 px-2 text-right">ราคาต่อหน่วย</th>
                      <th className="py-2 px-2 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-gray-200">
                    {(() => {
                      try {
                        const cart = JSON.parse(selectedTx.CartDetails || selectedTx[5]);
                        return cart.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 px-2">{i+1}</td>
                            <td className="py-2 px-2">{item.name || item.Name}</td>
                            <td className="py-2 px-2 text-center">{item.qty || item.quantity}</td>
                            <td className="py-2 px-2 text-right">{(item.price || item.Price).toLocaleString("th-TH")}</td>
                            <td className="py-2 px-2 text-right">{((item.price || item.Price) * (item.qty || item.quantity)).toLocaleString("th-TH")}</td>
                          </tr>
                        ));
                      } catch(e) {
                        return <tr><td colSpan="5" className="text-center py-2">เกิดข้อผิดพลาดในการดึงรายการสินค้า</td></tr>;
                      }
                    })()}
                  </tbody>
                </table>

                <div className="ml-auto w-1/2 border-t border-gray-800 pt-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>มูลค่าสินค้ายกเว้นภาษี (บาท)</span>
                    <span>0.00</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>มูลค่าสินค้าที่ต้องเสียภาษี (บาท)</span>
                    {/* Reverse Calculate VAT for Demo */}
                    <span>{(parseFloat(selectedTx.TotalAmount || selectedTx[2]) * 100 / 107).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                    <span>{(parseFloat(selectedTx.TotalAmount || selectedTx[2]) * 7 / 107).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-800">
                    <span>จำนวนเงินรวมทั้งสิ้น (บาท)</span>
                    <span>{parseFloat(selectedTx.TotalAmount || selectedTx[2]).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                </div>

                <div className="mt-12 text-center text-xs text-gray-500">
                  <p>....................................................................</p>
                  <p className="mt-2 text-sm">(ผู้รับเงิน / Authorized Signature)</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                {selectedTx?.TaxInvoiceNo || selectedTx?.[15]
                  ? <span className="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                      ใบกำกับภาษี: {selectedTx.TaxInvoiceNo || selectedTx[15]}
                    </span>
                  : <button
                      onClick={handleIssueTaxInvoice}
                      disabled={isSavingInvoice}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSavingInvoice ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      ออกใบกำกับภาษีและบันทึก
                    </button>
                }
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setInvoiceModal(false); setSelectedTx(null); }}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  onClick={handlePrintTaxInvoice}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex items-center gap-2"
                >
                  <Printer size={18} /> ปริ้นต์ / เซฟเป็น PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE ITEMS MODAL */}
      {expenseItemsModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" /> ข้อมูลเอกสาร (รายการสินค้านำเข้า)
              </h3>
              <button onClick={() => { setExpenseItemsModal(false); setSelectedExpenseItems([]); }} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-2 px-3">บาร์โค้ด</th>
                    <th className="py-2 px-3">รายการสินค้า</th>
                    <th className="py-2 px-3 text-center">จำนวน</th>
                    <th className="py-2 px-3 text-right">ต้นทุน/หน่วย</th>
                    <th className="py-2 px-3 text-right">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedExpenseItems.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-gray-500">{item.barcode || "-"}</td>
                      <td className="py-3 px-3 font-medium">{item.productName || item.name || "-"}</td>
                      <td className="py-3 px-3 text-center font-bold">{item.quantity || item.qty || 0}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-medium">฿{parseFloat(item.unitCost || 0).toLocaleString("th-TH", {minimumFractionDigits: 2})}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        ฿{(parseFloat(item.unitCost || 0) * parseFloat(item.quantity || item.qty || 0)).toLocaleString("th-TH", {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                  {selectedExpenseItems.length === 0 && (
                    <tr><td colSpan="5" className="py-4 text-center text-gray-500">ไม่มีข้อมูลรายการสินค้า</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end shrink-0 bg-gray-50 rounded-b-2xl">
               <button 
                onClick={() => { setExpenseItemsModal(false); setSelectedExpenseItems([]); }}
                className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-100"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLIP MODAL */}
      {slipData && (
        <TaxInvoiceModal
          isOpen={slipModalOpen}
          onClose={() => { setSlipModalOpen(false); setSlipData(null); }}
          cart={slipData.cart}
          paymentMethod={slipData.paymentMethod}
          subtotal={slipData.subtotal}
          discountAmount={slipData.discountAmount}
          tax={slipData.tax}
          total={slipData.total}
          receiptType={slipData.receiptType}
          taxInvoiceNo={slipData.taxInvoiceNo}
        />
      )}

      {/* CANCEL BILL MODAL */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
                <Ban size={20} /> ยกเลิกบิล (VOID)
              </h3>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-sm font-semibold text-red-800">เลขที่ใบเสร็จ: {cancelModal.ReceiptNo || cancelModal.OrderID || cancelModal[0]}</p>
                <p className="text-sm text-red-600 mt-1">ยอด: ฿{parseFloat(cancelModal.TotalAmount || cancelModal[2] || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-red-400 mt-2">⚠️ การยกเลิกบิลจะคืนสต็อกสินค้าอัตโนมัติ และไม่สามารถกู้คืนได้</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">สาเหตุการยกเลิก <span className="text-red-500">*</span></label>
                <textarea
                  value={cancelNoteInput}
                  onChange={(e) => setCancelNoteInput(e.target.value)}
                  placeholder="ระบุสาเหตุการยกเลิกบิล..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setCancelModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm">
                ยกเลิก
              </button>
              <button
                onClick={handleCancelBill}
                disabled={isCancelling || !cancelNoteInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isCancelling ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                {isCancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิกบิล"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

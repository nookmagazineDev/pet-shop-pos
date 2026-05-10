import { useState, useEffect } from "react";
import { FileText, ArrowRightLeft, Calendar, FileBox, Calculator, Loader2, X, Download, Search, ChevronDown, ChevronUp, Receipt, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";
import { exportToExcel, exportReportToExcel, getCartVatSplit, formatThaiPeriod } from "../utils/excelExport";
import ShiftSlipModal from "../components/ShiftSlipModal";
import { usePrinter } from "../context/PrinterContext";
import toast from "react-hot-toast";

const r2 = (n) => Math.round(n * 100) / 100;

export default function Reports() {
  const { settings: ps } = usePrinter();
  const [activeTab, setActiveTab] = useState("sales");
  const [transactions, setTransactions] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [taxInvoices, setTaxInvoices] = useState([]);
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Shift Slip Modal
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [shiftSlipData, setShiftSlipData] = useState(null);

  // Detail Modal States
  const [selectedTx, setSelectedTx] = useState(null);
  const [cancelNote, setCancelNote] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [returnQtys, setReturnQtys] = useState({});

  // Sales Menu Drill-down Modal
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);

  // Void bill expand
  const [expandedVoidId, setExpandedVoidId] = useState(null);

  // Filter States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");

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
    } else if (activeTab === "shifts") {
      const shifts = await fetchApi("getShifts");
      setShiftsHistory(Array.isArray(shifts) ? shifts : []);
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
  const filteredVoids = transactions.filter(t => t.Status === "CANCELLED" && isBetweenDates(t.Date));
  const filteredShifts = shiftsHistory.filter(s => isBetweenDates(s.CloseTime || s.OpenTime));

  // --- Search helpers ---
  const lq = searchQuery.toLowerCase().trim();

  const txCartContains = (tx) => {
    if (!lq) return true;
    try {
      const cart = typeof tx.CartDetails === 'string' ? JSON.parse(tx.CartDetails) : tx.CartDetails;
      if (Array.isArray(cart)) {
        return cart.some(item =>
          String(item.Barcode || item.barcode || "").toLowerCase().includes(lq) ||
          String(item.name || item.Name || "").toLowerCase().includes(lq)
        );
      }
    } catch (e) {}
    return false;
  };

  const txDateStr = (tx) => new Date(tx.Date).toLocaleDateString("th-TH");

  const searchTx = (tx) => {
    if (!lq) return true;
    return (
      String(tx.OrderID || "").toLowerCase().includes(lq) ||
      String(tx.ReceiptNo || "").toLowerCase().includes(lq) ||
      txDateStr(tx).includes(lq) ||
      String(tx.Date || "").includes(lq) ||
      txCartContains(tx)
    );
  };

  const searchTaxInv = (tx) => {
    if (!lq) return true;
    return (
      String(tx.TaxInvoiceNo || "").toLowerCase().includes(lq) ||
      String(tx.OrderID || "").toLowerCase().includes(lq) ||
      String(tx.CustomerName || "").toLowerCase().includes(lq) ||
      new Date(tx.Date).toLocaleDateString("th-TH").includes(lq) ||
      String(tx.Date || "").includes(lq)
    );
  };

  const searchReturn = (ret) => {
    if (!lq) return true;
    return (
      String(ret.OrderID || "").toLowerCase().includes(lq) ||
      String(ret.Barcode || "").toLowerCase().includes(lq) ||
      String(ret.ProductName || "").toLowerCase().includes(lq) ||
      new Date(ret.Timestamp).toLocaleDateString("th-TH").includes(lq) ||
      String(ret.Timestamp || "").includes(lq)
    );
  };

  const searchVoid = (tx) => {
    if (!lq) return true;
    return (
      String(tx.OrderID || "").toLowerCase().includes(lq) ||
      String(tx.ReceiptNo || "").toLowerCase().includes(lq) ||
      String(tx.CancelNote || "").toLowerCase().includes(lq) ||
      new Date(tx.Date).toLocaleDateString("th-TH").includes(lq)
    );
  };

  const searchStock = (m) => {
    if (!lq) return true;
    return (
      String(m.Barcode || "").toLowerCase().includes(lq) ||
      String(m.Name || "").toLowerCase().includes(lq) ||
      new Date(m.Date).toLocaleDateString("th-TH").includes(lq) ||
      String(m.Date || "").includes(lq)
    );
  };

  const searchShift = (s) => {
    if (!lq) return true;
    const d = s.CloseTime || s.OpenTime || "";
    return (
      String(s.ShiftID || "").toLowerCase().includes(lq) ||
      new Date(d).toLocaleDateString("th-TH").includes(lq) ||
      String(d).includes(lq)
    );
  };

  const searchSales = (item) => {
    if (!lq) return true;
    return (
      String(item.barcode || "").toLowerCase().includes(lq) ||
      String(item.name || "").toLowerCase().includes(lq)
    );
  };

  const handleViewDetails = (tx) => {
    const fullTx = filteredTransactions.find(t => t.OrderID === tx.OrderID) || tx;
    setSelectedTx(fullTx);
    setCancelNote("");
    const newQtys = {};
    try {
      const cart = typeof fullTx.CartDetails === 'string' ? JSON.parse(fullTx.CartDetails) : fullTx.CartDetails;
      if (Array.isArray(cart)) {
        cart.forEach((item, idx) => {
          const bCode = String(item.Barcode || item.barcode);
          const alreadyReturned = filteredReturns.filter(r => r.OrderID === fullTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty || 0), 0);
          newQtys[idx] = Math.max(0, (parseFloat(item.qty) || 0) - alreadyReturned);
        });
      }
    } catch (e) {}
    setReturnQtys(newQtys);
  };

  const handleCancelTransaction = async () => {
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
        const alreadyReturned = filteredReturns.filter(r => r.OrderID === selectedTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty || 0), 0);
        const returningNow = returnQtys[idx] || 0;
        if ((parseFloat(item.qty) || 0) - alreadyReturned - returningNow > 0) isFullCancel = false;
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
      fetchData();
    } else {
      toast.error(res.error || "เกิดข้อผิดพลาดในการทำรายการ");
    }
  };

  // --- Reports Processing ---
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
    } catch (e) {}
  });

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
  const salesByProductFiltered = salesByProductArray.filter(searchSales);

  const totalMenuRevenue = salesByProductArray.reduce((acc, obj) => acc + obj.revenue, 0);
  const totalMenuCost = salesByProductArray.reduce((acc, obj) => acc + obj.cost, 0);
  const totalMenuProfit = salesByProductArray.reduce((acc, obj) => acc + obj.profit, 0);

  const receiptsOnly = filteredTransactions.filter(t => (t.ReceiptType || "ใบเสร็จ") === "ใบเสร็จ" || t.ReceiptType === "online");
  const taxInvoicesOnly = filteredTransactions.filter(t => t.ReceiptType === "ใบกำกับภาษี");

  const totalRefundAmount = filteredReturns.reduce((acc, ret) => acc + (parseFloat(ret.RefundAmount) || 0), 0);
  const grossSalesRevenue = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.TotalAmount) || 0), 0);
  const totalSalesRevenue = grossSalesRevenue - totalRefundAmount;
  const grossTaxCollected = filteredTransactions.reduce((acc, tx) => acc + (parseFloat(tx.Tax) || 0), 0);
  const taxRefundRatio = grossSalesRevenue > 0 ? totalSalesRevenue / grossSalesRevenue : 1;
  const totalTaxCollected = grossTaxCollected * taxRefundRatio;

  // --- Drill-down data for selected menu item ---
  const buildMenuDrilldown = (barcode) => {
    const byDay = {};
    filteredTransactions.forEach(tx => {
      try {
        const cart = typeof tx.CartDetails === 'string' ? JSON.parse(tx.CartDetails) : tx.CartDetails;
        if (!Array.isArray(cart)) return;
        const matchItem = cart.find(item => String(item.Barcode || item.barcode) === String(barcode));
        if (!matchItem) return;
        const dateObj = new Date(tx.Date);
        const dayKey = dateObj.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
        if (!byDay[dayKey]) byDay[dayKey] = { bills: [], dateObj };
        byDay[dayKey].bills.push({
          time: dateObj.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          orderID: tx.OrderID,
          receiptNo: tx.ReceiptNo || tx.OrderID,
          qty: parseFloat(matchItem.qty || 1),
          status: tx.Status,
          rawDate: tx.Date,
        });
      } catch (e) {}
    });
    return Object.entries(byDay)
      .sort((a, b) => new Date(b[1].dateObj) - new Date(a[1].dateObj))
      .map(([day, v]) => ({ day, bills: v.bills, total: v.bills.reduce((s, b) => s + b.qty, 0) }));
  };

  const drilldownData = selectedMenuItem ? buildMenuDrilldown(selectedMenuItem.barcode) : [];
  const drilldownTotalBills = drilldownData.reduce((s, d) => s + d.bills.length, 0);
  const drilldownTotalQty = drilldownData.reduce((s, d) => s + d.total, 0);

  const handleExportExcel = () => {
    const company = {
      name: ps?.shopName || "",
      branch: ps?.shopBranch || "",
      taxId: ps?.shopTaxId || "",
      address: ps?.shopAddress || "",
    };
    const period = formatThaiPeriod(startDate, endDate);

    if (activeTab === "sales") {
      const headers = [
        { key: "no",        label: "No." },
        { key: "barcode",   label: "Barcode" },
        { key: "name",      label: "ชื่อเมนู/สินค้า" },
        { key: "qty",       label: "จำนวน" },
        { key: "cost",      label: "ต้นทุนรวม" },
        { key: "nonVAT",    label: "Non VAT" },
        { key: "beforeVAT", label: "Before VAT" },
        { key: "vat",       label: "VAT" },
        { key: "rounding",  label: "Rounding" },
        { key: "total",     label: "Total" },
      ];
      const rows = salesByProductArray.map((item, i) => {
        const prod = products.find(p => String(p.Barcode) === String(item.barcode)) || {};
        const vatStatus = prod.VatStatus || "VAT";
        let nonVAT = 0, beforeVAT = 0, vat = 0;
        if (vatStatus === "NON VAT") {
          nonVAT = r2(item.revenue);
        } else {
          beforeVAT = r2(item.revenue / 1.07);
          vat = r2(item.revenue - beforeVAT);
        }
        return { no: i + 1, barcode: item.barcode, name: item.name, qty: item.qty, cost: r2(item.cost), nonVAT, beforeVAT, vat, rounding: 0, total: r2(item.revenue) };
      });
      const sum = (key) => r2(rows.reduce((s, r) => s + (r[key] || 0), 0));
      const totals = { no: "Grand total", qty: sum("qty"), cost: sum("cost"), nonVAT: sum("nonVAT"), beforeVAT: sum("beforeVAT"), vat: sum("vat"), rounding: 0, total: sum("total") };
      exportReportToExcel({ title: "รายงานยอดขายตามเมนู", company, period, headers, rows, totals, sheetName: "SalesDetail", fileName: "Sales_Report" });

    } else if (activeTab === "history") {
      const headers = [
        { key: "no",           label: "No." },
        { key: "date",         label: "Date" },
        { key: "orderID",      label: "Number" },
        { key: "taxInvoiceNo", label: "เลขที่ใบกำกับ" },
        { key: "customer",     label: "Buyer name" },
        { key: "payment",      label: "Payment" },
        { key: "status",       label: "Status" },
        { key: "nonVAT",       label: "Non VAT" },
        { key: "beforeVAT",    label: "Before VAT" },
        { key: "vat",          label: "VAT" },
        { key: "rounding",     label: "Rounding" },
        { key: "total",        label: "Total" },
      ];
      const rows = filteredTransactions.map((tx, i) => {
        const { nonVAT, vatableTotal } = getCartVatSplit(tx.CartDetails, products);
        const beforeVAT = r2(vatableTotal / 1.07);
        const vat = r2(parseFloat(tx.Tax || 0));
        let customer = "-";
        try { const ci = JSON.parse(tx.CustomerInfo || "{}"); customer = ci.name || ci.customerName || "-"; } catch (e) {}
        const taxInv = taxInvoices.find(t => t.OrderID === tx.OrderID);
        return {
          no: i + 1,
          date: new Date(tx.Date).toLocaleString("th-TH"),
          orderID: tx.ReceiptNo || tx.OrderID,
          taxInvoiceNo: taxInv?.TaxInvoiceNo || "-",
          customer,
          payment: tx.PaymentMethod || "-",
          status: tx.Status || "COMPLETED",
          nonVAT: r2(nonVAT),
          beforeVAT,
          vat,
          rounding: 0,
          total: r2(parseFloat(tx.TotalAmount || 0)),
        };
      });
      const sum = (key) => r2(rows.reduce((s, r) => s + (r[key] || 0), 0));
      const totals = { no: "Grand total", nonVAT: sum("nonVAT"), beforeVAT: sum("beforeVAT"), vat: sum("vat"), rounding: 0, total: sum("total") };
      exportReportToExcel({ title: "รายงานประวัติการขาย", company, period, headers, rows, totals, sheetName: "SalesHistory", fileName: "Sales_History" });

    } else if (activeTab === "tax") {
      const headers = [
        { key: "no",           label: "No." },
        { key: "date",         label: "Date" },
        { key: "taxInvoiceNo", label: "เลขที่ใบกำกับ" },
        { key: "buyer",        label: "Buyer name" },
        { key: "taxId",        label: "Tax id" },
        { key: "branch",       label: "Branch" },
        { key: "nonVAT",       label: "Non VAT" },
        { key: "beforeVAT",    label: "Before VAT" },
        { key: "vat",          label: "VAT" },
        { key: "rounding",     label: "Rounding" },
        { key: "total",        label: "Total" },
      ];
      const taxRows = filteredTransactions.filter(t => t.Status !== "CANCELLED");
      const voidRows = filteredVoids;
      const buildRow = (tx, i, isVoid = false) => {
        const { nonVAT, vatableTotal } = getCartVatSplit(tx.CartDetails, products);
        const sign = isVoid ? -1 : 1;
        const beforeVAT = r2((vatableTotal / 1.07) * sign);
        const vat = r2(parseFloat(tx.Tax || 0) * sign);
        let buyer = "ลูกค้าทั่วไป", buyerTaxId = "-";
        try {
          const ci = JSON.parse(tx.CustomerInfo || "{}");
          buyer = ci.name || ci.customerName || "ลูกค้าทั่วไป";
          buyerTaxId = ci.taxId || ci.TaxID || "-";
        } catch (e) {}
        const taxInv = taxInvoices.find(t => t.OrderID === tx.OrderID);
        if (taxInv) { buyer = taxInv.CustomerName || buyer; buyerTaxId = taxInv.CustomerTaxID || buyerTaxId; }
        return {
          no: i + 1,
          date: new Date(tx.Date).toLocaleString("th-TH"),
          taxInvoiceNo: (isVoid ? "[VOID] " : "") + (taxInv?.TaxInvoiceNo || tx.ReceiptNo || tx.OrderID),
          buyer,
          taxId: buyerTaxId,
          branch: company.branch,
          nonVAT: r2(nonVAT * sign),
          beforeVAT,
          vat,
          rounding: 0,
          total: r2(parseFloat(tx.TotalAmount || 0) * sign),
        };
      };
      const rows = [
        ...taxRows.map((tx, i) => buildRow(tx, i, false)),
        ...voidRows.map((tx, i) => buildRow(tx, taxRows.length + i, true)),
      ];
      const sum = (key) => r2(rows.reduce((s, r) => s + (r[key] || 0), 0));
      const totals = { no: "Grand total", nonVAT: sum("nonVAT"), beforeVAT: sum("beforeVAT"), vat: sum("vat"), rounding: 0, total: sum("total") };
      exportReportToExcel({ title: "Output tax report", company, period, headers, rows, totals, sheetName: "TaxReport", fileName: "Tax_Report", textCols: ['taxId'] });

    } else if (activeTab === "returns") {
      const headers = [
        { key: "no",         label: "No." },
        { key: "date",       label: "วันที่เวลา" },
        { key: "receiptNo",  label: "เลขที่ใบเสร็จ" },
        { key: "total",      label: "ยอดรวม (บาท)" },
        { key: "payment",    label: "ช่องทางชำระ" },
        { key: "cancelNote", label: "สาเหตุการยกเลิก" },
        { key: "username",   label: "ผู้ทำรายการ" },
      ];
      const rows = filteredVoids.map((tx, i) => ({
        no: i + 1,
        date: new Date(tx.Date).toLocaleString("th-TH"),
        receiptNo: tx.ReceiptNo || tx.OrderID,
        total: r2(parseFloat(tx.TotalAmount || 0)),
        payment: tx.PaymentMethod || "-",
        cancelNote: tx.CancelNote || "-",
        username: tx.Username || "-",
      }));
      const totals = { no: "Grand total", total: r2(rows.reduce((s, r) => s + (r.total || 0), 0)) };
      exportReportToExcel({ title: "รายงานการยกเลิกบิล VOID", company, period, headers, rows, totals, sheetName: "VoidBills", fileName: "Void_Bills" });

    } else if (activeTab === "stock") {
      const headers = [
        { key: "no",      label: "No." },
        { key: "date",    label: "Date" },
        { key: "barcode", label: "Barcode" },
        { key: "name",    label: "ชื่อสินค้า" },
        { key: "qty",     label: "จำนวน" },
        { key: "from",    label: "จาก" },
        { key: "to",      label: "ถึง" },
        { key: "by",      label: "ผู้ทำรายการ" },
      ];
      const rows = filteredStockMoves.map((m, i) => ({
        no: i + 1, date: new Date(m.Date).toLocaleString("th-TH"), barcode: m.Barcode, name: m.Name, qty: m.Quantity, from: m.FromLocation, to: m.ToLocation, by: m.MovedBy || "System"
      }));
      const totals = { no: "Grand total", qty: rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0) };
      exportReportToExcel({ title: "รายงานการย้ายสต็อก", company, period, headers, rows, totals, sheetName: "StockMovements", fileName: "Stock_Movements" });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">ศูนย์รวมรายงาน (Reports)</h2>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { key: "sales", label: "ยอดขายตามเมนู" },
            { key: "history", label: "ประวัติการขาย (แยกใบเสร็จ/ใบกำกับ)" },
            { key: "tax", label: "รายงานภาษีขาย" },
            { key: "returns", label: "ประวัติการยกเลิกบิล VOID" },
            { key: "stock", label: "รายการย้ายสต็อก" },
            { key: "shifts", label: "รายงานการปิดกะ" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
              className={clsx(
                "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
                activeTab === tab.key
                  ? tab.key === "returns" ? "bg-white text-rose-600 shadow-sm"
                    : tab.key === "shifts" ? "bg-white text-blue-600 shadow-sm"
                    : "bg-white text-primary shadow-sm"
                  : tab.key === "returns" ? "text-gray-500 hover:text-rose-600"
                    : tab.key === "shifts" ? "text-gray-500 hover:text-blue-600"
                    : "text-gray-500 hover:text-gray-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Filter + Search + Export */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">ช่วงวันที่:</span>
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

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหา: บาร์โค้ด / ชื่อสินค้า / เลขที่บิล / วันที่..."
              className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary w-72"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 font-medium text-sm whitespace-nowrap"
        >
          <Download size={18} />
          <span>Export Excel</span>
        </button>
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
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileBox size={18} /> รายการขายสินค้าตามวันที่เลือก
                <span className="text-xs font-normal text-gray-400 ml-1">* คลิกที่แถวเพื่อดูรายละเอียดบิลรายวัน</span>
              </h3>
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
                {salesByProductFiltered.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-gray-400">ไม่พบรายการขายในช่วงเวลานี้</td></tr>
                ) : (
                  salesByProductFiltered.sort((a, b) => b.qty - a.qty).map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedMenuItem(item)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                      title="คลิกเพื่อดูรายละเอียดบิลรายวัน"
                    >
                      <td className="py-4 px-6 text-sm text-gray-600 font-mono">{item.barcode}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900 group-hover:text-blue-700">{item.name}</td>
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

        {/* --- TAB: HISTORY (unified table) --- */}
        {!isLoading && activeTab === "history" && (() => {
          const historyRows = filteredTransactions.filter(searchTx);
          return (
            <div className="flex-1 overflow-auto">
              <div className="p-4 bg-blue-50/50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Receipt size={18} /> ประวัติการขายทั้งหมด
                </h3>
                <span className="text-sm text-blue-600 font-medium">
                  {historyRows.length} รายการ{lq ? ` / กรองจาก ${filteredTransactions.length}` : ""}
                </span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-50 sticky top-0">
                  <tr className="border-b border-blue-100 text-xs font-medium text-blue-700">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">วันที่ / เวลา</th>
                    <th className="py-3 px-4">เลขที่บิล</th>
                    <th className="py-3 px-4">เลขที่ใบกำกับภาษี</th>
                    <th className="py-3 px-4">ประเภท</th>
                    <th className="py-3 px-4">ลูกค้า</th>
                    <th className="py-3 px-4">ช่องทางชำระ</th>
                    <th className="py-3 px-4 text-right">ยอดสุทธิ</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyRows.length === 0 ? (
                    <tr><td colSpan="9" className="py-8 text-center text-gray-400">ไม่พบรายการในช่วงเวลานี้</td></tr>
                  ) : historyRows.map((tx, i) => {
                    const taxInv = taxInvoices.find(t => t.OrderID === tx.OrderID);
                    let customerName = "-";
                    try { const ci = JSON.parse(tx.CustomerInfo || "{}"); customerName = ci.name || ci.customerName || "-"; } catch (e) {}
                    if (taxInv?.CustomerName) customerName = taxInv.CustomerName;
                    const isCancelled = tx.Status === "CANCELLED";
                    const receiptType = tx.ReceiptType || "ใบเสร็จ";
                    return (
                      <tr
                        key={i}
                        onClick={() => handleViewDetails(tx)}
                        className={clsx("text-sm cursor-pointer transition-colors", isCancelled ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-blue-50/40")}
                      >
                        <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                        <td className="py-3 px-4 font-mono text-gray-700 font-semibold">{tx.ReceiptNo || tx.OrderID}</td>
                        <td className="py-3 px-4">
                          {taxInv?.TaxInvoiceNo
                            ? <span className="font-mono text-purple-700 font-semibold">{taxInv.TaxInvoiceNo}</span>
                            : <span className="text-gray-300 text-xs">-</span>
                          }
                        </td>
                        <td className="py-3 px-4">
                          <span className={clsx("px-2 py-0.5 rounded text-xs font-bold",
                            receiptType === "ใบกำกับภาษี" ? "bg-purple-100 text-purple-700" :
                            receiptType === "online" ? "bg-emerald-100 text-emerald-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {receiptType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{customerName}</td>
                        <td className="py-3 px-4 text-gray-500">{tx.PaymentMethod || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-800">฿{parseFloat(tx.TotalAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          {isCancelled
                            ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">ยกเลิกแล้ว</span>
                            : <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">สมบูรณ์</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* --- TAB: TAX REPORT --- */}
        {!isLoading && activeTab === "tax" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white border text-blue-800 border-blue-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Calculator className="text-blue-500" />
                  <h3 className="font-semibold text-lg">ยอดขายรวมทั้งหมด (Total Sales)</h3>
                </div>
                <div className="text-4xl font-bold">฿{totalSalesRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-white border text-amber-800 border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowRightLeft className="text-emerald-500" />
                  <h3 className="font-semibold text-lg">ภาษีขายโดยประมาณ (Estimated Tax)</h3>
                </div>
                <div className="text-4xl font-bold">฿{totalTaxCollected.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
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
                  {(() => {
                    // Normal rows (non-void) with Tax > 0
                    const taxRows = filteredTransactions.filter(t => t.Status !== "CANCELLED" && parseFloat(t.Tax) > 0 && searchTx(t));
                    // Void rows that had Tax > 0 (shown as negative reversal)
                    const voidTaxRows = filteredVoids.filter(t => parseFloat(t.Tax) > 0 && searchTx(t));

                    if (taxRows.length === 0 && voidTaxRows.length === 0) {
                      return <tr><td colSpan="5" className="p-8 text-center text-gray-400">ไม่มีรายการที่มีภาษีขายในช่วงที่เลือก</td></tr>;
                    }

                    const grandTotal = taxRows.reduce((s, t) => s + (parseFloat(t.TotalAmount) || 0), 0)
                                     - voidTaxRows.reduce((s, t) => s + (parseFloat(t.TotalAmount) || 0), 0);
                    const grandTax   = taxRows.reduce((s, t) => s + (parseFloat(t.Tax) || 0), 0)
                                     - voidTaxRows.reduce((s, t) => s + (parseFloat(t.Tax) || 0), 0);

                    return (
                      <>
                        {/* Normal rows */}
                        {taxRows.map((tx, i) => (
                          <tr key={`tx-${i}`} className="hover:bg-gray-50 text-sm">
                            <td className="p-3 text-gray-600">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                            <td className="p-3">
                              <span className={clsx("px-2 py-1 rounded text-xs font-bold",
                                tx.ReceiptType === "ใบกำกับภาษี" ? "bg-purple-100 text-purple-700" :
                                  (tx.ReceiptType === "online" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")
                              )}>
                                {tx.ReceiptType || "ใบเสร็จ"}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-gray-500">{tx.ReceiptNo || tx.OrderID}</td>
                            <td className="p-3 text-right font-medium">฿{parseFloat(tx.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-amber-600 font-bold">฿{parseFloat(tx.Tax || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}

                        {/* Void reversal rows */}
                        {voidTaxRows.map((tx, i) => {
                          const amt = parseFloat(tx.TotalAmount || 0);
                          const vat = parseFloat(tx.Tax || 0);
                          return (
                            <tr key={`void-${i}`} className="bg-red-50 text-sm border-l-4 border-red-400">
                              <td className="p-3 text-red-600">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                              <td className="p-3">
                                <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">
                                  ยกเลิก (VOID)
                                </span>
                              </td>
                              <td className="p-3 font-mono text-red-500 line-through">{tx.ReceiptNo || tx.OrderID}</td>
                              <td className="p-3 text-right font-bold text-red-600">-฿{amt.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-bold text-red-600">-฿{vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}

                        <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                          <td className="p-3 text-gray-700" colSpan="3">
                            Grand Total ({taxRows.length} รายการ{voidTaxRows.length > 0 ? `, หักลบ ${voidTaxRows.length} VOID` : ""})
                          </td>
                          <td className={clsx("p-3 text-right", grandTotal < 0 ? "text-red-700" : "text-gray-900")}>
                            ฿{grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className={clsx("p-3 text-right", grandTax < 0 ? "text-red-700" : "text-amber-700")}>
                            ฿{grandTax.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB: VOID BILLS --- */}
        {!isLoading && activeTab === "returns" && (
          <div className="flex-1 overflow-auto">
            <div className="p-4 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
              <h3 className="font-semibold text-red-800 flex items-center gap-2">
                <X size={18} /> ประวัติการยกเลิกบิล VOID
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-red-600 font-medium">
                  {filteredVoids.filter(searchVoid).length} รายการ
                  {lq ? ` / กรองจาก ${filteredVoids.length}` : ""}
                </span>
                {filteredVoids.length > 0 && (
                  <span className="text-sm font-bold text-red-700 bg-red-100 px-3 py-1 rounded-lg">
                    รวมยอด: ฿{filteredVoids.reduce((s, t) => s + (parseFloat(t.TotalAmount) || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-red-50 sticky top-0">
                <tr className="border-b border-red-100 text-sm font-medium text-red-700">
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">No.</th>
                  <th className="py-3 px-4">วันที่เวลา</th>
                  <th className="py-3 px-4">เลขที่ใบเสร็จ</th>
                  <th className="py-3 px-4 text-right">ยอดรวม</th>
                  <th className="py-3 px-4">ช่องทางชำระ</th>
                  <th className="py-3 px-4">สาเหตุการยกเลิก</th>
                  <th className="py-3 px-4">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {filteredVoids.filter(searchVoid).length === 0 ? (
                  <tr><td colSpan="8" className="py-8 text-center text-red-400/80">ไม่พบรายการยกเลิกบิลในช่วงวันที่นี้</td></tr>
                ) : (
                  filteredVoids.filter(searchVoid).map((tx, idx) => {
                    const isExpanded = expandedVoidId === (tx.OrderID || tx[0]);
                    let cartItems = [];
                    try { cartItems = typeof tx.CartDetails === 'string' ? JSON.parse(tx.CartDetails) : (tx.CartDetails || []); } catch (e) {}
                    return (
                      <>
                        <tr
                          key={tx.OrderID || idx}
                          onClick={() => setExpandedVoidId(isExpanded ? null : (tx.OrderID || tx[0]))}
                          className="hover:bg-red-50/50 text-sm cursor-pointer select-none"
                        >
                          <td className="py-3 px-4 text-red-400">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="py-3 px-4 text-gray-700">{new Date(tx.Date).toLocaleString("th-TH")}</td>
                          <td className="py-3 px-4 font-mono text-red-700 font-semibold">{tx.ReceiptNo || tx.OrderID}</td>
                          <td className="py-3 px-4 text-right font-bold text-red-600">฿{parseFloat(tx.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{tx.PaymentMethod || "-"}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px]">{tx.CancelNote || "-"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{tx.Username || "-"}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${tx.OrderID}-detail`} className="bg-red-50/40">
                            <td colSpan="8" className="px-10 py-3">
                              <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                                <Receipt size={13} /> รายการสินค้าในบิล
                              </div>
                              {cartItems.length === 0 ? (
                                <p className="text-xs text-gray-400">ไม่พบข้อมูลรายการสินค้า</p>
                              ) : (
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="text-red-600 border-b border-red-100">
                                      <th className="py-1 pr-4 text-left font-medium">สินค้า</th>
                                      <th className="py-1 pr-4 text-left font-medium">Barcode</th>
                                      <th className="py-1 pr-4 text-center font-medium">จำนวน</th>
                                      <th className="py-1 pr-4 text-right font-medium">ราคา/หน่วย</th>
                                      <th className="py-1 text-right font-medium">รวม</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cartItems.map((item, i) => {
                                      const qty = parseFloat(item.qty || 1);
                                      const price = parseFloat(item.price || item.Price || 0);
                                      return (
                                        <tr key={i} className="border-b border-red-50/60 text-gray-700">
                                          <td className="py-1.5 pr-4">{item.Name || item.name || "-"}</td>
                                          <td className="py-1.5 pr-4 font-mono text-gray-400">{item.Barcode || item.barcode || "-"}</td>
                                          <td className="py-1.5 pr-4 text-center font-semibold">{qty}</td>
                                          <td className="py-1.5 pr-4 text-right">฿{price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                          <td className="py-1.5 text-right font-bold text-red-600">฿{(qty * price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-red-200 font-bold text-red-700">
                                      <td colSpan="4" className="py-1.5 text-right pr-4">ยอดรวมบิล</td>
                                      <td className="py-1.5 text-right">฿{parseFloat(tx.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
              {filteredVoids.filter(searchVoid).length > 0 && (
                <tfoot>
                  <tr className="bg-red-100 font-bold text-sm border-t-2 border-red-200">
                    <td className="py-3 px-4 text-red-800" colSpan="4">Grand Total ({filteredVoids.filter(searchVoid).length} รายการ)</td>
                    <td className="py-3 px-4 text-right text-red-800">
                      ฿{filteredVoids.filter(searchVoid).reduce((s, t) => s + (parseFloat(t.TotalAmount) || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* --- TAB: STOCK MOVEMENTS --- */}
        {!isLoading && activeTab === "stock" && (
          <div className="flex-1 overflow-auto">
            <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
              <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                <ArrowRightLeft size={18} /> ประวัติการเคลื่อนไหวสต็อก
              </h3>
              <span className="text-sm text-emerald-600 font-medium">
                {filteredStockMoves.filter(searchStock).length} รายการ
                {lq ? ` / กรองจาก ${filteredStockMoves.length}` : ""}
              </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-50 sticky top-0">
                <tr className="border-b border-emerald-100 text-sm font-medium text-emerald-700">
                  <th className="py-3 px-6">วันที่เวลา</th>
                  <th className="py-3 px-6">Barcode / สินค้า</th>
                  <th className="py-3 px-6 text-right">จำนวน</th>
                  <th className="py-3 px-6">จาก → ถึง</th>
                  <th className="py-3 px-6">เลขที่อ้างอิง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredStockMoves.filter(searchStock).length === 0 ? (
                  <tr><td colSpan="5" className="py-8 text-center text-emerald-500/80">ไม่พบประวัติการเคลื่อนไหวสต็อกในช่วงวันที่นี้<br /><span className="text-sm opacity-80">(บันทึกเมื่อรับสินค้าจากซัพพลายเออร์, ย้ายสินค้าไปหน้าร้าน, หรือยกเลิกบิล)</span></td></tr>
                ) : (
                  filteredStockMoves.filter(searchStock).map((m, idx) => {
                    const isReceive = String(m.FromLocation || "").startsWith("ซัพพลายเออร์");
                    return (
                      <tr key={idx} className={`text-sm ${isReceive ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-emerald-50/30"}`}>
                        <td className="py-4 px-6 text-emerald-900">{new Date(m.Date).toLocaleString("th-TH")}</td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-800">{m.Name}</div>
                          <div className="text-xs text-gray-500 font-mono">BC: {m.Barcode}</div>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-700">+{m.Quantity} ชิ้น</td>
                        <td className="py-4 px-6 text-gray-600">
                          <span className={`px-2 py-1 rounded text-xs ${isReceive ? "bg-blue-100 text-blue-800 font-semibold" : "bg-gray-100"}`}>{m.FromLocation}</span>
                          <span className="mx-2 text-gray-300">→</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-semibold">{m.ToLocation}</span>
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-500 font-mono">{m.ReferenceNo || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- TAB: SHIFTS --- */}
        {!isLoading && activeTab === "shifts" && (
          <div className="flex-1 overflow-auto">
            <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                <FileText size={18} /> รายงานการปิดกะ
              </h3>
              <span className="text-sm text-blue-600 font-medium">
                {filteredShifts.filter(searchShift).length} กะ
                {lq ? ` / กรองจาก ${filteredShifts.length}` : ""}
              </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-50 sticky top-0">
                <tr className="border-b border-blue-100 text-sm font-medium text-blue-700">
                  <th className="py-3 px-6">เปิดกะ</th>
                  <th className="py-3 px-6">ปิดกะ</th>
                  <th className="py-3 px-6">พนักงาน</th>
                  <th className="py-3 px-6 text-right">ยอดขาย</th>
                  <th className="py-3 px-6 text-right">จำนวนบิล</th>
                  <th className="py-3 px-6 text-center">สลิป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {filteredShifts.filter(searchShift).length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-blue-400/80">ไม่พบรายงานการปิดกะในช่วงวันที่นี้</td></tr>
                ) : (
                  filteredShifts.filter(searchShift).map((s, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 text-sm">
                      <td className="py-4 px-6 text-gray-700">{s.OpenTime ? new Date(s.OpenTime).toLocaleString("th-TH") : "-"}</td>
                      <td className="py-4 px-6 text-gray-700">{s.CloseTime ? new Date(s.CloseTime).toLocaleString("th-TH") : <span className="text-amber-500 font-semibold">กำลังเปิดอยู่</span>}</td>
                      <td className="py-4 px-6 text-gray-800 font-medium">{s.OpenedBy || s.Username || "-"}</td>
                      <td className="py-4 px-6 text-right font-bold text-blue-700">฿{parseFloat(s.TotalSales || 0).toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-gray-600">{s.TotalBills || s.OrderCount || "-"}</td>
                      <td className="py-4 px-6 text-center">
                        {s.CloseTime && (
                          <button
                            onClick={() => { setShiftSlipData(s); setIsSlipModalOpen(true); }}
                            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            ดูสลิป
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== MENU DRILL-DOWN MODAL ===== */}
      {selectedMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-start bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <FileBox size={20} className="text-blue-500" />
                  {selectedMenuItem.name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5 font-mono">Barcode: {selectedMenuItem.barcode}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-600">รวม <span className="font-bold text-blue-700">{drilldownTotalBills} บิล</span></span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">จำนวนรวม <span className="font-bold text-emerald-700">{drilldownTotalQty} ชิ้น</span></span>
                </div>
              </div>
              <button onClick={() => setSelectedMenuItem(null)} className="p-1.5 hover:bg-white/80 rounded-lg text-gray-500 transition-colors mt-0.5">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {drilldownData.length === 0 ? (
                <div className="text-center py-12 text-gray-400">ไม่พบข้อมูลการขายในช่วงวันที่เลือก</div>
              ) : (
                drilldownData.map((dayGroup, di) => (
                  <div key={di} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Day Header */}
                    <div className="px-4 py-2.5 bg-indigo-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-indigo-500" />
                        <span className="font-semibold text-indigo-900 text-sm">{dayGroup.day}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{dayGroup.bills.length} บิล</span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">รวม {dayGroup.total} ชิ้น</span>
                      </div>
                    </div>

                    {/* Bills Table */}
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                          <th className="py-2 px-4 w-8">#</th>
                          <th className="py-2 px-4">วันที่ / เวลา</th>
                          <th className="py-2 px-4">เลขที่บิล</th>
                          <th className="py-2 px-4 text-right">จำนวน</th>
                          <th className="py-2 px-4 text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dayGroup.bills.map((bill, bi) => (
                          <tr key={bi} className="hover:bg-gray-50/80 text-sm">
                            <td className="py-2.5 px-4 text-gray-400 text-xs">{bi + 1}</td>
                            <td className="py-2.5 px-4">
                              <span className="text-gray-600">{dayGroup.day}</span>
                              <span className="ml-2 font-semibold text-gray-900">{bill.time} น.</span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold text-sm">{bill.receiptNo}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{bill.qty} ชิ้น</td>
                            <td className="py-2.5 px-4 text-center">
                              {bill.status === "CANCELLED"
                                ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">ยกเลิกแล้ว</span>
                                : <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">สมบูรณ์</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedMenuItem(null)} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">รายละเอียดบิล <span className="font-mono text-primary text-sm bg-blue-50 px-2 py-0.5 rounded">{selectedTx.ReceiptNo || selectedTx.OrderID}</span></h3>
              <button onClick={() => setSelectedTx(null)} className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-5 flex-1 overflow-auto">
              <div className="mb-5 grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div><strong>วันที่:</strong> <span className="text-gray-900">{new Date(selectedTx.Date).toLocaleString("th-TH")}</span></div>
                <div><strong>พนักงาน:</strong> <span className="text-gray-900">{selectedTx.Username || "-"}</span></div>
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
                  <div className="font-bold text-red-900 flex items-center gap-2"><ArrowRightLeft size={16} /> บิลนี้ถูกยกเลิกแล้ว</div>
                  <div className="text-red-700 font-medium">หมายเหตุ: {selectedTx.CancelNote || "-"}</div>
                </div>
              )}

              <h4 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex justify-between">
                <span>รายการสินค้า</span>
                {selectedTx.Status !== "CANCELLED" && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">* ปรับ +/- เพื่อระบุจำนวนที่ต้องการคืน</span>}
              </h4>
              <ul className="space-y-3 mb-5">
                {(() => {
                  try {
                    const cart = typeof selectedTx.CartDetails === 'string' ? JSON.parse(selectedTx.CartDetails) : selectedTx.CartDetails;
                    if (Array.isArray(cart)) {
                      return cart.map((item, idx) => {
                        const bCode = String(item.Barcode || item.barcode);
                        const alreadyReturned = filteredReturns.filter(r => r.OrderID === selectedTx.OrderID && String(r.Barcode) === bCode).reduce((sum, r) => sum + parseFloat(r.ReturnQty || 0), 0);
                        const maxReturn = (parseFloat(item.qty) || 0) - alreadyReturned;
                        const returnQty = returnQtys[idx] || 0;
                        const price = item.price || item.Price || 0;
                        return (
                          <li key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm border-b border-gray-50 pb-2">
                            <div className="flex-1 mb-2 sm:mb-0">
                              <span className="font-medium text-gray-800">{item.qty}x {item.name || item.Name}</span>
                              <div className="text-xs text-gray-500 mt-0.5">฿{price.toLocaleString()} ต่อชิ้น</div>
                              {alreadyReturned > 0 && <div className="text-xs text-rose-500 font-bold mt-0.5">ถูกคืนไปแล้ว {alreadyReturned} ชิ้น</div>}
                            </div>
                            <div className="flex items-center gap-3">
                              {selectedTx.Status !== "CANCELLED" && maxReturn > 0 ? (
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                  <button onClick={() => setReturnQtys(p => ({ ...p, [idx]: Math.max(0, (p[idx] || 0) - 1) }))} className="px-2 py-1 bg-gray-50 hover:bg-red-50 text-red-500 font-bold transition-colors">-</button>
                                  <span className="px-3 text-sm font-bold text-gray-700 w-8 text-center">{returnQty}</span>
                                  <button onClick={() => setReturnQtys(p => ({ ...p, [idx]: Math.min(maxReturn, (p[idx] || 0) + 1) }))} className="px-2 py-1 bg-gray-50 hover:bg-emerald-50 text-emerald-600 font-bold transition-colors">+</button>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 font-medium px-2 truncate w-24 text-right">
                                  {maxReturn === 0 && selectedTx.Status !== "CANCELLED" ? "(ไม่มีให้คืนเพิ่ม)" : ""}
                                </div>
                              )}
                              <span className="font-medium text-gray-900 text-right w-16">฿{(price * item.qty).toLocaleString()}</span>
                            </div>
                          </li>
                        );
                      });
                    }
                  } catch (e) {}
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
                  <span>฿{(() => {
                    let ref = 0;
                    const c = typeof selectedTx.CartDetails === 'string' ? JSON.parse(selectedTx.CartDetails) : selectedTx.CartDetails;
                    if (Array.isArray(c)) c.forEach((it, i) => ref += (it.price || it.Price || 0) * (returnQtys[i] || 0));
                    return ref.toLocaleString();
                  })()}</span>
                </div>
              )}
            </div>

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

      {/* Shift Slip Modal */}
      {isSlipModalOpen && shiftSlipData && (
        <ShiftSlipModal
          shiftData={shiftSlipData}
          onClose={() => { setIsSlipModalOpen(false); setShiftSlipData(null); }}
        />
      )}
    </div>
  );
}

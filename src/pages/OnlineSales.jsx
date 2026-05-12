import { useState, useEffect, useRef, useMemo } from "react";
import {
  ScanLine, Plus, Minus, Trash2, ShoppingCart, Loader2, Camera, X,
  Save, Globe, RefreshCw, FileDown, Upload, CheckCircle2,
  AlertTriangle, FileSpreadsheet, ChevronDown, ChevronUp,
  BarChart2, Clock, Download, Calendar
} from "lucide-react";
import * as XLSX from "xlsx";
import clsx from "clsx";
import BarcodeScanner from "../components/BarcodeScanner";
import { fetchApi, postApi } from "../api";
import { exportToExcel } from "../utils/excelExport";

const PLATFORMS = ["Shopee", "Lazada", "Lineman", "GrabFood", "อื่นๆ"];

const PLATFORM_COLORS = {
  Shopee:   { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-400" },
  Lazada:   { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-400"   },
  Lineman:  { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-400"  },
  GrabFood: { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-400"},
};
const defaultColor = { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400" };
const getPlatformColor = (p) => PLATFORM_COLORS[p] || defaultColor;

/* ──────────────────────────────────────────────
   Excel template
────────────────────────────────────────────── */
function downloadOnlineTemplate() {
  const wb = XLSX.utils.book_new();

  const instructions = [
    ["คำแนะนำการใช้งาน - แบบฟอร์มนำเข้าออเดอร์ขายออนไลน์"],
    [""],
    ["1.  กรอกข้อมูลในชีต 'ข้อมูลออเดอร์' แล้วบันทึก"],
    ["2.  เลขออเดอร์  — แถวที่เลขเดียวกัน = ออเดอร์เดียวกัน (หากว่าง = แต่ละแถวเป็นออเดอร์แยก)"],
    ["3.  แพลตฟอร์ม  — Shopee | Lazada | Lineman | GrabFood | อื่นๆ"],
    ["4.  บาร์โค้ด   — กรอกบาร์โค้ดสินค้า (แนะนำ) หรือชื่อสินค้า"],
    ["5.  จำนวน      — จำนวนชิ้นที่ขาย"],
    ["6.  ราคาต่อชิ้น — ถ้าว่างจะใช้ราคาแพลตฟอร์มที่ตั้งค่าในระบบ"],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst["!cols"] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "คำแนะนำ");

  const headers = ["เลขออเดอร์","แพลตฟอร์ม","บาร์โค้ดสินค้า","ชื่อสินค้า","จำนวน","ราคาต่อชิ้น (ถ้าว่างใช้ราคาแพลตฟอร์ม)"];
  const sample = [
    ["ORD-001","Shopee",  "8851234567890","อาหารสุนัข Royal Canin 1kg",2,""],
    ["ORD-001","Shopee",  "8859876543210","ขนมสุนัข Snack",            1,""],
    ["ORD-002","Lazada",  "8851112223334","แชมพูสุนัข Freshy",         3,89],
    ["ORD-003","Lineman", "",             "อาหารแมว Whiskas",          1,150],
    ["ORD-004","GrabFood","8850001112223","Cat Litter ทรายแมว 5L",     2,""],
  ];
  const wsData = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  wsData["!cols"] = [{wch:14},{wch:14},{wch:18},{wch:32},{wch:8},{wch:32}];
  XLSX.utils.book_append_sheet(wb, wsData, "ข้อมูลออเดอร์");
  XLSX.writeFile(wb, "OnlineSales_Template.xlsx");
}

/* ──────────────────────────────────────────────
   Import preview modal
────────────────────────────────────────────── */
function ImportPreviewModal({ preview, onClose, onConfirm, isSaving }) {
  const [expanded, setExpanded] = useState(null);
  if (!preview) return null;
  const { orders } = preview;
  const totalOrders = orders.length;
  const warnOrders  = orders.filter(o => o.items.some(i => !i.found)).length;
  const totalItems  = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-violet-600" />
              ตรวจสอบข้อมูลก่อนนำเข้า
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              พบ <strong>{totalOrders}</strong> ออเดอร์ • <strong>{totalItems}</strong> ชิ้น
              {warnOrders > 0 && <span className="ml-2 text-amber-600">⚠ {warnOrders} ออเดอร์มีสินค้าที่ไม่พบในระบบ</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orders.map((order, oi) => {
            const orderTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
            const hasWarn    = order.items.some(i => !i.found);
            const isExp      = expanded === oi;
            const pc         = getPlatformColor(order.platform);
            return (
              <div key={oi} className={clsx("border rounded-xl overflow-hidden", hasWarn ? "border-amber-200" : "border-gray-100")}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExp ? null : oi)}
                  className={clsx("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors", hasWarn ? "bg-amber-50 hover:bg-amber-100/60" : "bg-gray-50 hover:bg-gray-100/60")}
                >
                  {hasWarn ? <AlertTriangle size={16} className="text-amber-500 shrink-0" /> : <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800">ออเดอร์ {order.orderNo}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span className={clsx("px-1.5 py-0.5 rounded font-medium text-[11px]", pc.bg, pc.text)}>{order.platform}</span>
                      <span>{order.items.length} รายการ</span>
                    </div>
                  </div>
                  <div className="font-bold text-violet-700 shrink-0 mr-2">฿{orderTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                  {isExp ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                </button>
                {isExp && (
                  <div className="divide-y divide-gray-100">
                    {order.items.map((item, ii) => (
                      <div key={ii} className={clsx("flex items-center gap-3 px-4 py-2.5 text-sm", !item.found ? "bg-amber-50/60" : "bg-white")}>
                        <div className="flex-1 min-w-0">
                          <div className={clsx("font-medium truncate", !item.found ? "text-amber-700" : "text-gray-800")}>
                            {item.name}
                            {!item.found && <span className="ml-2 text-[10px] bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">ไม่พบในระบบ</span>}
                          </div>
                          {item.Barcode && <div className="text-[11px] text-gray-400 font-mono">{item.Barcode}</div>}
                        </div>
                        <div className="text-gray-500 shrink-0">x{item.qty}</div>
                        <div className="font-semibold text-gray-700 shrink-0 w-24 text-right">
                          ฿{item.price.toLocaleString()} / ชิ้น
                          {item.customPrice && <span className="text-[10px] text-violet-500 block">กำหนดเอง</span>}
                        </div>
                        <div className="font-bold text-gray-900 shrink-0 w-24 text-right">฿{(item.price * item.qty).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">ยกเลิก</button>
          <button onClick={onConfirm} disabled={isSaving} className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-200 flex items-center justify-center gap-2 disabled:opacity-60">
            {isSaving ? <><Loader2 size={18} className="animate-spin"/> กำลังนำเข้า...</> : <><Upload size={18}/> นำเข้า {totalOrders} ออเดอร์</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Online Sales Report (right-panel tab)
────────────────────────────────────────────── */
function OnlineReport({ allTransactions, isLoading, onRefresh }) {
  const [filterPlatform, setFilterPlatform] = useState("ทั้งหมด");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [expanded,  setExpanded]  = useState(null);

  // Completed online orders: method = platform name, no "รอชำระ", not VOID
  const completedOrders = useMemo(() => {
    return allTransactions.filter(tx => {
      if (tx.Status === "VOID") return false;
      const m = (tx.PaymentMethod || "").trim();
      return PLATFORMS.some(p => m === p) && !m.includes("รอชำระ");
    }).reverse();
  }, [allTransactions]);

  const filtered = useMemo(() => {
    return completedOrders.filter(tx => {
      if (filterPlatform !== "ทั้งหมด" && tx.PaymentMethod?.trim() !== filterPlatform) return false;
      if (startDate) {
        const d = new Date(tx.Date); d.setHours(0,0,0,0);
        if (d < new Date(startDate)) return false;
      }
      if (endDate) {
        const d = new Date(tx.Date); d.setHours(23,59,59,999);
        if (d > new Date(endDate + "T23:59:59")) return false;
      }
      return true;
    });
  }, [completedOrders, filterPlatform, startDate, endDate]);

  const totalAmt = filtered.reduce((s, tx) => s + parseFloat(tx.TotalAmount || 0), 0);

  // Platform counts for badge
  const platformCounts = useMemo(() => {
    const cnt = {};
    completedOrders.forEach(tx => {
      const p = tx.PaymentMethod?.trim() || "อื่นๆ";
      cnt[p] = (cnt[p] || 0) + 1;
    });
    return cnt;
  }, [completedOrders]);

  const handleExport = () => {
    if (filtered.length === 0) { alert("ไม่มีข้อมูล"); return; }
    const rows = filtered.map((tx, i) => {
      let items = "";
      try { items = JSON.parse(tx.CartDetails || "[]").map(c => `${c.Name} x${c.qty}`).join(", "); } catch {}
      return {
        "ลำดับ": i + 1,
        "วันที่": tx.Date ? new Date(tx.Date).toLocaleString("th-TH") : "-",
        "เลขออเดอร์": tx.OrderID || "-",
        "แพลตฟอร์ม": tx.PaymentMethod || "-",
        "รายการสินค้า": items,
        "ยอดรวม": parseFloat(tx.TotalAmount || 0),
      };
    });
    exportToExcel(rows, "OnlineReport", "OnlineSales_Report");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="p-3 border-b border-gray-100 space-y-2.5">
        {/* Platform pills */}
        <div className="flex flex-wrap gap-1.5">
          {["ทั้งหมด", ...PLATFORMS].map(p => {
            const pc  = getPlatformColor(p);
            const cnt = p === "ทั้งหมด" ? completedOrders.length : (platformCounts[p] || 0);
            return (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1",
                  filterPlatform === p
                    ? clsx(pc.bg, pc.text, pc.border, "shadow-sm")
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                )}
              >
                {p}
                <span className={clsx("text-[10px] font-bold px-1 py-0.5 rounded-full", filterPlatform === p ? "bg-white/60" : "bg-gray-100")}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-gray-400 shrink-0"/>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"/>
          <span className="text-gray-400 text-xs shrink-0">ถึง</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"/>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-violet-50/40 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">ออเดอร์ทั้งหมด</div>
          <div className="font-bold text-gray-900 text-lg">{filtered.length} รายการ</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">ยอดรวม</div>
          <div className="font-bold text-violet-700 text-lg">฿{totalAmt.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors" title="รีเฟรช">
            <RefreshCw size={15}/>
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
            <Download size={13}/> Export
          </button>
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="py-12 flex justify-center text-gray-400"><Loader2 size={24} className="animate-spin"/></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-3 text-gray-400">
            <BarChart2 size={40} className="opacity-20"/>
            <span className="text-sm">ไม่มีรายการขายออนไลน์</span>
          </div>
        ) : filtered.map((tx, i) => {
          let cartItems = [];
          try { cartItems = JSON.parse(tx.CartDetails || "[]"); } catch {}
          const platform  = tx.PaymentMethod?.trim() || "อื่นๆ";
          const pc        = getPlatformColor(platform);
          const isExp     = expanded === i;
          const txAmt     = parseFloat(tx.TotalAmount || 0);
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setExpanded(isExp ? null : i)}
                className="w-full p-4 hover:bg-gray-50/60 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full border", pc.bg, pc.text, pc.border)}>{platform}</span>
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0"/>
                      <span className="text-[11px] text-emerald-600 font-medium">ชำระแล้ว</span>
                    </div>
                    <div className="font-mono text-xs text-gray-500 mt-1 truncate">{tx.OrderID}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {tx.Date ? new Date(tx.Date).toLocaleString("th-TH") : "-"}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <div className="font-bold text-gray-900">฿{txAmt.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">{cartItems.length} รายการ</div>
                    {isExp ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                  </div>
                </div>
              </button>
              {isExp && (
                <div className="px-4 pb-4 bg-gray-50/40">
                  <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                    {cartItems.map((c, j) => (
                      <div key={j} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="text-gray-700 flex-1 truncate">{c.Name}</span>
                        <span className="text-gray-500 mx-3">x{c.qty}</span>
                        <span className="font-semibold text-gray-900">฿{((c.price || 0) * c.qty).toLocaleString()}</span>
                      </div>
                    ))}
                    {cartItems.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">ไม่มีข้อมูลรายการ</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main component
────────────────────────────────────────────── */
export default function OnlineSales() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isPaying, setIsPaying] = useState(null);  // orderId being confirmed
  const [orderPlatform, setOrderPlatform] = useState(PLATFORMS[0]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [rightTab, setRightTab] = useState("pending"); // "pending" | "report"
  const barcodeRef = useRef(null);

  // Excel import
  const importFileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const pendingOrders = useMemo(
    () => allTransactions.filter(tx => tx.PaymentMethod?.includes("รอชำระ")).reverse(),
    [allTransactions]
  );

  useEffect(() => {
    fetchApi("getProducts").then(data => {
      setProducts(Array.isArray(data) ? data : []);
      setIsLoadingProducts(false);
    });
    loadTransactions();
  }, []);

  useEffect(() => {
    if (!isScannerOpen && !isPaying && !isSaving && !isLoadingProducts && !importPreview)
      barcodeRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, isScannerOpen, isPaying, isSaving, isLoadingProducts, importPreview]);

  const getPlatformPrice = (product, platform) => {
    if (!product) return 0;
    if (platform === "Shopee"   && product.ShopeePrice   > 0) return Number(product.ShopeePrice);
    if (platform === "Lazada"   && product.LazadaPrice   > 0) return Number(product.LazadaPrice);
    if (platform === "Lineman"  && product.LinemanPrice  > 0) return Number(product.LinemanPrice);
    if (platform === "GrabFood" && product.GrabFoodPrice > 0) return Number(product.GrabFoodPrice);
    return Number(product.Price) || 0;
  };

  useEffect(() => {
    setCart(prev => prev.map(item => ({
      ...item,
      price: item.productObj ? getPlatformPrice(item.productObj, orderPlatform) : item.price
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPlatform]);

  const loadTransactions = () => {
    setIsLoadingOrders(true);
    fetchApi("getTransactions").then(data => {
      setAllTransactions(Array.isArray(data) ? data : []);
      setIsLoadingOrders(false);
    });
  };

  const addToCart = (product, qtyToAdd = 1) => {
    setCart(prev => {
      const key = product.Barcode || product.Name;
      const existing = prev.find(item => item.id === key);
      if (existing) return prev.map(item => item.id === key ? { ...item, qty: item.qty + qtyToAdd } : item);
      return [{
        id: key, Barcode: product.Barcode, Name: product.Name, name: product.Name,
        price: getPlatformPrice(product, orderPlatform),
        costPrice: Number(product.CostPrice) || 0,
        productObj: product, qty: qtyToAdd
      }, ...prev];
    });
    setBarcodeInput("");
  };

  const handleScanSuccess = (text) => {
    setIsScannerOpen(false);
    const clean = String(text).trim();
    const exact = products.find(p => String(p.Barcode).trim() === clean);
    if (exact) { addToCart(exact, 1); return; }
    const packMatch = products.find(p => String(p.PackBarcode || "").trim() === clean);
    if (packMatch) { addToCart(packMatch, parseFloat(packMatch.PackMultiplier) || 1); return; }
    setBarcodeInput(text);
  };

  const handleScan = (e) => {
    e.preventDefault();
    if (isLoadingProducts || !barcodeInput.trim()) return;
    const clean = barcodeInput.replace(/[​-‍﻿\r\n]/g, '').trim();
    const exact = products.find(p => String(p.Barcode).trim() === clean);
    if (exact) { addToCart(exact, 1); return; }
    const packMatch = products.find(p => String(p.PackBarcode || "").trim() === clean);
    if (packMatch) { addToCart(packMatch, parseFloat(packMatch.PackMultiplier) || 1); return; }
    const matches = products.filter(p => p.Name?.toLowerCase().includes(clean.toLowerCase()));
    if (matches.length === 1) addToCart(matches[0], 1);
    else if (matches.length === 0) { alert("ไม่พบสินค้า"); setBarcodeInput(""); }
  };

  const searchResults = barcodeInput.trim()
    ? products.filter(p => {
        const q = barcodeInput.toLowerCase().trim();
        return p.Name?.toLowerCase().includes(q) || String(p.Barcode||"").includes(q) || String(p.PackBarcode||"").includes(q);
      })
    : [];

  const updateQty = (id, delta) =>
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = subtotal * 0.07;
  const total    = subtotal + tax;

  const handleSaveOrder = async () => {
    if (cart.length === 0) return;
    setIsSaving(true);
    const res = await postApi({
      action: "checkout",
      payload: {
        totalAmount: total, tax,
        paymentMethod: `${orderPlatform} รอชำระ`,
        receiptType: "online",
        cart: cart.map(c => ({ Barcode: c.Barcode, Name: c.Name, qty: c.qty, price: c.price, costPrice: c.costPrice }))
      }
    });
    setIsSaving(false);
    if (res.success) {
      alert(`บันทึกรายการสำเร็จ! Order: ${res.orderId}`);
      setCart([]);
      loadTransactions();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  // Tick: mark order as paid
  const handleMarkPaid = async (orderId, platform) => {
    setIsPaying(orderId);
    const res = await postApi({
      action: "updateTransactionPayment",
      payload: { orderId, paymentMethod: platform }
    });
    setIsPaying(null);
    if (res.success) {
      loadTransactions();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  /* ── Excel import ── */
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: "array" });
        const sheetName = wb.SheetNames.find(n => n.includes("ออเดอร์")) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const dataRows = rows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ""));
        if (dataRows.length === 0) { alert("ไม่พบข้อมูลในไฟล์"); return; }

        const orderMap = new Map();
        let autoIdx = 0;
        dataRows.forEach((row) => {
          const rawOrderNo  = String(row[0] ?? "").trim();
          const platform    = String(row[1] ?? "").trim() || "อื่นๆ";
          const barcode     = String(row[2] ?? "").trim();
          const nameInput   = String(row[3] ?? "").trim();
          const qty         = Math.max(1, parseFloat(row[4]) || 1);
          const rawPrice    = parseFloat(row[5]);
          const customPrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : null;
          if (!barcode && !nameInput) return;
          const orderKey = rawOrderNo || `auto_${autoIdx++}`;
          let product = null;
          if (barcode) product = products.find(p => String(p.Barcode ?? "").trim() === barcode);
          if (!product && nameInput) {
            product = products.find(p => (p.Name ?? "").toLowerCase() === nameInput.toLowerCase())
                   || products.find(p => (p.Name ?? "").toLowerCase().includes(nameInput.toLowerCase()));
          }
          const price    = customPrice ?? (product ? getPlatformPrice(product, platform) : 0);
          const itemName = product?.Name || nameInput || barcode;
          if (!orderMap.has(orderKey)) orderMap.set(orderKey, { orderNo: orderKey, platform, items: [] });
          orderMap.get(orderKey).items.push({
            id: barcode || nameInput, Barcode: barcode || product?.Barcode || "",
            Name: itemName, name: itemName, qty, price,
            costPrice: Number(product?.CostPrice) || 0, productObj: product || null,
            found: !!product, customPrice: !!customPrice,
          });
        });
        const orders = Array.from(orderMap.values());
        if (orders.length === 0) { alert("ไม่พบออเดอร์ที่ถูกต้อง"); return; }
        setImportPreview({ orders });
      } catch (err) {
        alert("ไม่สามารถอ่านไฟล์ได้: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    let success = 0, failed = 0;
    for (const order of importPreview.orders) {
      const sub   = order.items.reduce((s, i) => s + i.price * i.qty, 0);
      const t     = sub * 0.07;
      const res   = await postApi({
        action: "checkout",
        payload: {
          totalAmount: sub + t, tax: t,
          paymentMethod: `${order.platform} รอชำระ`,
          receiptType: "online",
          cart: order.items.map(i => ({ Barcode: i.Barcode, Name: i.name, qty: i.qty, price: i.price, costPrice: i.costPrice })),
        }
      });
      if (res.success) success++; else failed++;
    }
    setIsImporting(false);
    setImportPreview(null);
    loadTransactions();
    alert(`นำเข้าสำเร็จ ${success} ออเดอร์${failed > 0 ? ` (ผิดพลาด ${failed})` : ""}`);
  };

  /* ────────────────── render ────────────────── */
  return (
    <div className="flex flex-col gap-6 h-full">
      <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile}/>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
            <Globe size={22}/>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">ระบบขายออนไลน์</h2>
            <p className="text-sm text-gray-500">บันทึกและติดตามออเดอร์จากแพลตฟอร์มออนไลน์</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadOnlineTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm">
            <FileDown size={16} className="text-emerald-600"/> ดาวน์โหลดแบบฟอร์ม
          </button>
          <button type="button" onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
            <Upload size={16}/> นำเข้า Excel
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

        {/* LEFT: Cart Builder */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Platform Selector */}
          <div className="p-3 border-b border-gray-100 bg-violet-50/50">
            <p className="text-xs font-medium text-gray-500 mb-2">แพลตฟอร์มออนไลน์:</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const pc = getPlatformColor(p);
                return (
                  <button key={p} type="button" onClick={() => setOrderPlatform(p)}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all",
                      orderPlatform === p ? clsx(pc.border, pc.bg, pc.text, "shadow-sm") : "border-gray-200 bg-white text-gray-600 hover:border-violet-300"
                    )}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 relative">
            <form onSubmit={handleScan} className="flex items-center gap-2 relative z-10">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  {isLoadingProducts ? <Loader2 size={20} className="animate-spin text-violet-400"/> : <ScanLine size={20}/>}
                </div>
                <input
                  ref={barcodeRef}
                  type="text"
                  className={clsx(
                    "w-full pl-12 pr-4 py-3 rounded-xl border transition-all text-lg shadow-sm",
                    isLoadingProducts ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  )}
                  placeholder={isLoadingProducts ? "กำลังโหลดข้อมูลสินค้า..." : "สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า..."}
                  value={barcodeInput}
                  onChange={e => { if (!isLoadingProducts) setBarcodeInput(e.target.value); }}
                  disabled={isLoadingProducts}
                />
              </div>
              <button type="button" onClick={() => setIsScannerOpen(!isScannerOpen)}
                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shrink-0">
                {isScannerOpen ? <X size={24}/> : <Camera size={24}/>}
              </button>
              <button type="submit" className="hidden">ok</button>
            </form>

            {isScannerOpen && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)}/>}

            {barcodeInput.trim() && searchResults.length > 0 && !products.find(p => String(p.Barcode) === barcodeInput.trim()) && (
              <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                {searchResults.map((p, i) => {
                  const stock = parseFloat(p.Quantity || 0);
                  const platformPrice = getPlatformPrice(p, orderPlatform);
                  return (
                    <button key={i} type="button" onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 hover:bg-violet-50 flex items-center justify-between group transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 group-hover:text-violet-700">{p.Name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>BC: {p.Barcode}</span>
                          {p.PackBarcode && <span className="text-violet-400">| Pack: {p.PackBarcode}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-bold text-gray-900">฿{platformPrice.toLocaleString()}</div>
                        <div className={clsx("text-xs font-semibold mt-0.5",
                          stock <= 0 ? "text-red-500" : stock <= 5 ? "text-amber-500" : "text-emerald-600")}>
                          คงเหลือ {stock} ชิ้น
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <ShoppingCart size={48} className="opacity-30"/>
                <p>ยังไม่มีสินค้าในออเดอร์</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => {
                  const stock = parseFloat(item.productObj?.Quantity || 0);
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">{item.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-violet-600 font-bold">฿{item.price.toLocaleString()}</span>
                          <span className={clsx("text-xs font-semibold px-1.5 py-0.5 rounded",
                            stock <= 0 ? "bg-red-100 text-red-600" : stock <= 5 ? "bg-amber-100 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                            คงเหลือ {stock} ชิ้น
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                        <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-white rounded-md transition-colors text-gray-500"><Minus size={16}/></button>
                        <span className="w-8 text-center font-medium">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-white rounded-md transition-colors text-gray-500"><Plus size={16}/></button>
                      </div>
                      <div className="w-24 text-right font-bold text-lg">฿{(item.price * item.qty).toLocaleString()}</div>
                      <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary + Save */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex justify-between text-sm text-gray-500"><span>ราคาสินค้า</span><span>฿{subtotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>ภาษี 7%</span><span>฿{tax.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-800">ยอดรวม</span>
              <span className="text-2xl font-bold text-violet-600">฿{total.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
            <button
              onClick={handleSaveOrder}
              disabled={cart.length === 0 || isSaving}
              className="w-full py-3.5 bg-violet-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200 disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>}
              {isSaving ? "กำลังบันทึก..." : `บันทึก (${orderPlatform}) • รอชำระ`}
            </button>
          </div>
        </div>

        {/* RIGHT: Tabs — รอชำระ / รายงาน */}
        <div className="w-full lg:w-[440px] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 shrink-0 overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setRightTab("pending")}
              className={clsx(
                "flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2",
                rightTab === "pending" ? "border-violet-600 text-violet-700 bg-violet-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <Clock size={15}/> รอชำระ
              {pendingOrders.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-1.5 py-0.5 rounded-full">{pendingOrders.length}</span>
              )}
            </button>
            <button
              onClick={() => setRightTab("report")}
              className={clsx(
                "flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2",
                rightTab === "report" ? "border-violet-600 text-violet-700 bg-violet-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <BarChart2 size={15}/> รายงานขาย
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* ── Pending orders ── */}
            {rightTab === "pending" && (
              <>
                <div className="p-3 border-b border-gray-50 flex justify-end shrink-0">
                  <button onClick={loadTransactions} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <RefreshCw size={15}/>
                  </button>
                </div>
                <div className="flex-1 overflow-auto divide-y divide-gray-100">
                  {isLoadingOrders ? (
                    <div className="py-12 flex justify-center text-gray-400"><Loader2 size={24} className="animate-spin"/></div>
                  ) : pendingOrders.length === 0 ? (
                    <div className="py-14 flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Clock size={40} className="opacity-20"/>
                      <span className="text-sm">ไม่มีรายการรอชำระ</span>
                    </div>
                  ) : pendingOrders.map((order, i) => {
                    let cartItems = [];
                    try { cartItems = JSON.parse(order.CartDetails || "[]"); } catch {}
                    const platform  = (order.PaymentMethod || "").replace("รอชำระ","").trim() || "ออนไลน์";
                    const pc        = getPlatformColor(platform);
                    const loading   = isPaying === order.OrderID;
                    return (
                      <div key={i} className="p-4 hover:bg-gray-50/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full border", pc.bg, pc.text, pc.border)}>{platform}</span>
                              <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">รอชำระ</span>
                            </div>
                            <div className="font-mono text-xs text-gray-500 truncate">{order.OrderID}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {order.Date ? new Date(order.Date).toLocaleString("th-TH") : "-"}
                            </div>
                            <div className="mt-2 space-y-0.5">
                              {cartItems.slice(0,3).map((c,j) => (
                                <div key={j} className="text-xs text-gray-600">• {c.Name} x{c.qty}</div>
                              ))}
                              {cartItems.length > 3 && <div className="text-xs text-gray-400">+{cartItems.length-3} รายการอื่น</div>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="font-bold text-gray-900 text-lg">฿{parseFloat(order.TotalAmount||0).toLocaleString()}</div>
                            {/* ✓ tick button */}
                            <button
                              onClick={() => handleMarkPaid(order.OrderID, platform)}
                              disabled={loading}
                              title="ยืนยันได้รับเงินแล้ว"
                              className={clsx(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all",
                                loading
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-200"
                              )}
                            >
                              {loading
                                ? <Loader2 size={16} className="animate-spin"/>
                                : <CheckCircle2 size={16}/>
                              }
                              ได้รับเงินแล้ว
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Report ── */}
            {rightTab === "report" && (
              <OnlineReport
                allTransactions={allTransactions}
                isLoading={isLoadingOrders}
                onRefresh={loadTransactions}
              />
            )}
          </div>
        </div>
      </div>

      <ImportPreviewModal
        preview={importPreview}
        onClose={() => setImportPreview(null)}
        onConfirm={handleConfirmImport}
        isSaving={isImporting}
      />
    </div>
  );
}

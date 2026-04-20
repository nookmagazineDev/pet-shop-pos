import { useState, useEffect, useRef } from "react";
import { Search, ScanLine, Plus, Minus, Trash2, ShoppingCart, Loader2, Camera, X, Save, CreditCard, Globe, RefreshCw } from "lucide-react";
import clsx from "clsx";
import BarcodeScanner from "../components/BarcodeScanner";
import { fetchApi, postApi } from "../api";

const PLATFORMS = ["Shopee", "Lazada", "Lineman", "GrabFood", "อื่นๆ"];

export default function OnlineSales() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [payModal, setPayModal] = useState(null); // { orderId, cartDetails }
  const [isPaying, setIsPaying] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0]);
  const [customPlatform, setCustomPlatform] = useState("");
  const [orderPlatform, setOrderPlatform] = useState(PLATFORMS[0]);
  const barcodeRef = useRef(null);

  useEffect(() => {
    fetchApi("getProducts").then(data => setProducts(Array.isArray(data) ? data : []));
    loadPendingOrders();
  }, []);

  useEffect(() => {
    if (!isScannerOpen) barcodeRef.current?.focus();
  }, [cart, isScannerOpen]);

  const loadPendingOrders = () => {
    setIsLoadingOrders(true);
    fetchApi("getTransactions").then(data => {
      const pending = Array.isArray(data)
        ? data.filter(tx => tx.PaymentMethod === "รอชำระ").reverse()
        : [];
      setPendingOrders(pending);
      setIsLoadingOrders(false);
    });
  };

  const addToCart = (product) => {
    setCart(prev => {
      const key = product.Barcode || product.Name;
      const existing = prev.find(item => item.id === key);
      if (existing) return prev.map(item => item.id === key ? { ...item, qty: item.qty + 1 } : item);
      return [{ id: key, Barcode: product.Barcode, Name: product.Name, name: product.Name, price: Number(product.Price) || 0, qty: 1 }, ...prev];
    });
    setBarcodeInput("");
  };

  const handleScanSuccess = (text) => {
    setIsScannerOpen(false);
    const match = products.find(p => String(p.Barcode) === String(text).trim());
    if (match) addToCart(match);
    else setBarcodeInput(text);
  };

  const handleScan = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const exact = products.find(p => String(p.Barcode) === barcodeInput.trim());
    if (exact) { addToCart(exact); return; }
    const matches = products.filter(p => p.Name?.toLowerCase().includes(barcodeInput.toLowerCase()));
    if (matches.length === 1) addToCart(matches[0]);
    else if (matches.length === 0) { alert("ไม่พบสินค้า"); setBarcodeInput(""); }
  };

  const searchResults = barcodeInput.trim()
    ? products.filter(p => p.Name?.toLowerCase().includes(barcodeInput.toLowerCase()) || String(p.Barcode).includes(barcodeInput))
    : [];

  const updateQty = (id, delta) => setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const handleSaveOrder = async () => {
    if (cart.length === 0) return;
    setIsSaving(true);
    const res = await postApi({
      action: "checkout",
      payload: {
        totalAmount: total,
        tax: tax,
        paymentMethod: "รอชำระ",
        cart: cart.map(c => ({ Barcode: c.Barcode, Name: c.Name, qty: c.qty, price: c.price }))
      }
    });
    setIsSaving(false);
    if (res.success) {
      alert(`บันทึกรายการสำเร็จ! Order: ${res.orderId}`);
      setCart([]);
      loadPendingOrders();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleConfirmPayment = async () => {
    if (!payModal) return;
    const platform = selectedPlatform === "อื่นๆ" ? customPlatform.trim() : selectedPlatform;
    if (!platform) { alert("กรุณาระบุชื่อแพลตฟอร์ม"); return; }
    setIsPaying(true);
    const res = await postApi({
      action: "updateTransactionPayment",
      payload: { orderId: payModal.orderId, paymentMethod: platform }
    });
    setIsPaying(false);
    if (res.success) {
      setPayModal(null);
      loadPendingOrders();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
            <Globe size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">ระบบขายออนไลน์</h2>
            <p className="text-sm text-gray-500">บันทึกและติดตามออเดอร์จากแพลตฟอร์มออนไลน์</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* LEFT: Cart Builder */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Platform Selector */}
          <div className="p-3 border-b border-gray-100 bg-violet-50/50">
            <p className="text-xs font-medium text-gray-500 mb-2">แพลตฟอร์มออนไลน์:</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOrderPlatform(p)}
                  className={clsx(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all",
                    orderPlatform === p
                      ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-violet-300"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 relative">
            <form onSubmit={handleScan} className="flex items-center gap-2 relative z-10">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <ScanLine size={20} />
                </div>
                <input
                  ref={barcodeRef}
                  type="text"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-lg shadow-sm bg-white"
                  placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                />
              </div>
              <button type="button" onClick={() => setIsScannerOpen(!isScannerOpen)}
                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shrink-0">
                {isScannerOpen ? <X size={24} /> : <Camera size={24} />}
              </button>
              <button type="submit" className="hidden">ok</button>
            </form>

            {isScannerOpen && (
              <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />
            )}

            {barcodeInput.trim() && searchResults.length > 0 && !products.find(p => String(p.Barcode) === barcodeInput.trim()) && (
              <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                {searchResults.map((p, i) => (
                  <button key={i} type="button" onClick={() => addToCart(p)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{p.Name}</div>
                      <div className="text-xs text-gray-500">Barcode: {p.Barcode}</div>
                    </div>
                    <div className="font-bold text-gray-900">฿{(Number(p.Price) || 0).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <ShoppingCart size={48} className="opacity-30" />
                <p>ยังไม่มีสินค้าในออเดอร์</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.name}</h4>
                      <div className="text-violet-600 font-bold mt-1">฿{item.price.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-white rounded-md transition-colors text-gray-500"><Minus size={16} /></button>
                      <span className="w-8 text-center font-medium">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-white rounded-md transition-colors text-gray-500"><Plus size={16} /></button>
                    </div>
                    <div className="w-24 text-right font-bold text-lg">฿{(item.price * item.qty).toLocaleString()}</div>
                    <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary + Save */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex justify-between text-sm text-gray-500"><span>ราคาสินค้า</span><span>฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>ภาษี 7%</span><span>฿{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-800">ยอดรวม</span>
              <span className="text-2xl font-bold text-violet-600">฿{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <button
              onClick={handleSaveOrder}
              disabled={cart.length === 0 || isSaving}
              className="w-full py-3.5 bg-violet-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200 disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {isSaving ? "กำลังบันทึก..." : `บันทึก (${orderPlatform}) • รอชำระ`}
            </button>
          </div>
        </div>

        {/* RIGHT: Pending Orders */}
        <div className="w-full lg:w-[440px] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">รายการรอชำระ</span>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
            </div>
            <button onClick={loadPendingOrders} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {isLoadingOrders ? (
              <div className="py-12 flex justify-center text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            ) : pendingOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">ไม่มีรายการรอชำระ</div>
            ) : pendingOrders.map((order, i) => {
              let cartItems = [];
              try { cartItems = JSON.parse(order.CartDetails || "[]"); } catch {}
              return (
                <div key={i} className="p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-gray-500 truncate">{order.OrderID}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {order.Date ? new Date(order.Date).toLocaleString("th-TH") : "-"}
                      </div>
                      <div className="mt-2 space-y-1">
                        {cartItems.slice(0, 3).map((c, j) => (
                          <div key={j} className="text-xs text-gray-600">• {c.Name} x{c.qty}</div>
                        ))}
                        {cartItems.length > 3 && <div className="text-xs text-gray-400">+{cartItems.length - 3} รายการอื่น</div>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-900">฿{parseFloat(order.TotalAmount || 0).toLocaleString()}</div>
                      <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">รอชำระ</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPayModal({ orderId: order.OrderID }); setSelectedPlatform(orderPlatform); setCustomPlatform(""); }}
                    className="mt-3 w-full py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                  >
                    <CreditCard size={15} /> ยืนยันชำระเงิน
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Payment Platform Modal */}
      {payModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border-t-4 border-emerald-500">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">เลือกช่องทางชำระเงิน</h3>
              <button onClick={() => setPayModal(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={clsx(
                      "py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all",
                      selectedPlatform === p ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-emerald-300"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {selectedPlatform === "อื่นๆ" && (
                <input
                  type="text"
                  placeholder="ระบุชื่อแพลตฟอร์ม..."
                  value={customPlatform}
                  onChange={e => setCustomPlatform(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm"
                />
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPayModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">ยกเลิก</button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isPaying}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isPaying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {isPaying ? "กำลังบันทึก..." : "ยืนยันชำระแล้ว"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

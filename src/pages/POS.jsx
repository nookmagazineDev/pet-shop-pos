import { useState, useRef, useEffect } from "react";
import { Search, ScanLine, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, ShoppingCart, Loader2 } from "lucide-react";
import clsx from "clsx";
import TaxInvoiceModal from "../components/TaxInvoiceModal";
import { fetchApi, postApi } from "../api";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("เงินสด");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const barcodeRef = useRef(null);

  // Fetch products on load
  useEffect(() => {
    fetchApi("getProducts").then(data => {
      // Fallback to empty if not array
      setProducts(Array.isArray(data) ? data : []);
    });
  }, []);

  // Keep focus on barcode input for quick scanning
  useEffect(() => {
    if (!isInvoiceModalOpen) {
      barcodeRef.current?.focus();
    }
  }, [cart, isInvoiceModalOpen]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.ID);
      if (existing) {
        return prev.map(item => item.id === product.ID ? { ...item, qty: item.qty + 1 } : item);
      }
      return [{ 
        id: product.ID, 
        barcode: product.Barcode,
        name: product.Name, 
        price: Number(product.Price) || 0,
        image: product.ImageURL || "https://placehold.co/300x300?text=No+Image",
        qty: 1 
      }, ...prev];
    });
    setBarcodeInput("");
  };

  const handleScan = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    
    // Find exact barcode match
    const exactMatch = products.find(p => String(p.Barcode) === barcodeInput.trim());
    
    if (exactMatch) {
      addToCart(exactMatch);
    } else {
      // Find name matches
      const stringMatches = products.filter(p => p.Name?.toLowerCase().includes(barcodeInput.toLowerCase().trim()));
      
      if (stringMatches.length === 1) {
        // Auto-add if only 1 match found
        addToCart(stringMatches[0]);
      } else if (stringMatches.length === 0) {
        alert("ไม่พบรหัสสินค้าหรือชื่อสินค้านี้ในระบบ! (ตรวจสอบใน Sheet Products ว่ามีข้อมูลหรือไม่)");
        setBarcodeInput("");
      }
      // If multiple matches, do nothing and let user pick from dropdown
    }
  };

  // Search results for dropdown
  const searchResults = barcodeInput.trim() 
    ? products.filter(p => 
        p.Name?.toLowerCase().includes(barcodeInput.toLowerCase().trim()) || 
        String(p.Barcode).includes(barcodeInput.trim())
      )
    : [];

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setIsCheckingOut(true);
    const payload = {
      action: "checkout",
      payload: {
        totalAmount: total,
        tax: tax,
        paymentMethod: paymentMethod,
        cart: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price }))
      }
    };
    
    const res = await postApi(payload);
    setIsCheckingOut(false);
    
    if (res.success) {
      setIsInvoiceModalOpen(true);
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (res.error || "Unknown"));
    }
  };

  const handleInvoiceClose = () => {
    setIsInvoiceModalOpen(false);
    setCart([]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full p-2">
      
      {/* Left side: Search & Cart Items */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 relative">
          <form onSubmit={handleScan} className="relative z-10">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <ScanLine size={20} />
            </div>
            <input 
              ref={barcodeRef}
              type="text" 
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-lg shadow-sm bg-white"
              placeholder="สแกนบาร์โค้ด หรือ พิมพ์ชื่อสินค้าที่นี่..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
            />
            <button type="submit" className="hidden">ตกลง</button>
          </form>

          {/* Autocomplete Dropdown */}
          {barcodeInput.trim() && searchResults.length > 0 && !products.find(p => String(p.Barcode) === barcodeInput.trim()) && (
            <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
              {searchResults.map(p => (
                <button 
                  key={p.ID} 
                  type="button"
                  onClick={() => addToCart(p)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                >
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{p.Name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 mt-0.5">บาร์โค้ด: {p.Barcode}</div>
                  </div>
                  <div className="font-bold text-gray-900">฿{(Number(p.Price) || 0).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Listing */}
        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                <ShoppingCart size={40} className="opacity-50" />
              </div>
              <p className="text-lg">ยังไม่มีสินค้าในตะกร้า ลองสแกนดูสิ!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors group bg-white shadow-sm hover:shadow-md">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                  
                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                    <p className="text-gray-500 text-sm">{item.barcode}</p>
                    <div className="text-primary font-bold mt-1">฿{item.price.toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-2 hover:bg-white hover:text-primary rounded-md transition-colors text-gray-500 shadow-sm">
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-medium">{item.qty}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-2 hover:bg-white hover:text-primary rounded-md transition-colors text-gray-500 shadow-sm">
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="text-right ml-4 font-bold text-lg w-24">
                    ฿{(item.price * item.qty).toLocaleString()}
                  </div>

                  <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ml-2">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Payment Panel */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 shrink-0">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <h3 className="font-semibold text-lg text-gray-800">สรุปยอดชำระเงิน</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-gray-500">
              <span>ราคาสินค้า</span>
              <span>฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>ภาษีมูลค่าเพิ่ม (7%)</span>
              <span>฿{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-gray-200 my-2 pt-2"></div>
            <div className="flex justify-between items-end">
              <span className="text-gray-900 font-medium pb-1">ยอดรวมทั้งหมด</span>
              <span className="text-4xl font-bold text-primary tracking-tight">฿{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <h4 className="font-medium text-sm text-gray-500 mb-3 tracking-wider">เลือกประเภทการจ่ายเงิน</h4>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <button 
              onClick={() => setPaymentMethod("เงินสด")}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                paymentMethod === "เงินสด" 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-gray-100 hover:border-primary/30 text-gray-500 bg-gray-50"
              )}
            >
              <Banknote size={24} />
              <span className="text-xs font-semibold">เงินสด</span>
            </button>
            <button 
              onClick={() => setPaymentMethod("เงินโอน")}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                paymentMethod === "เงินโอน" 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-gray-100 hover:border-primary/30 text-gray-500 bg-gray-50"
              )}
            >
              <QrCode size={24} />
              <span className="text-xs font-semibold">โอนเงิน</span>
            </button>
            <button 
              onClick={() => setPaymentMethod("บัตรเครดิต")}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                paymentMethod === "บัตรเครดิต" 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-gray-100 hover:border-primary/30 text-gray-500 bg-gray-50"
              )}
            >
              <CreditCard size={24} />
              <span className="text-xs font-semibold">บัตรเครดิต</span>
            </button>
          </div>

          <div className="mt-auto space-y-3">
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
            >
              {isCheckingOut ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
              {isCheckingOut ? "กำลังบันทึก..." : "รับชำระเงิน นัดพิมพ์ใบเสร็จ"}
            </button>
          </div>
        </div>
      </div>

      <TaxInvoiceModal 
        isOpen={isInvoiceModalOpen} 
        onClose={handleInvoiceClose} 
        cart={cart}
        paymentMethod={paymentMethod}
        subtotal={subtotal}
        tax={tax}
        total={total}
      />
    </div>
  );
}

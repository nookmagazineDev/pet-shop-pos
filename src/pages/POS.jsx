import { useState, useRef, useEffect } from "react";
import { Search, ScanLine, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, ShoppingCart, Loader2, Camera, X, Lock, Tag } from "lucide-react";
import clsx from "clsx";
import TaxInvoiceModal from "../components/TaxInvoiceModal";
import BarcodeScanner from "../components/BarcodeScanner";
import { fetchApi, postApi } from "../api";
import { useShift } from "../context/ShiftContext";
import { useNavigate } from "react-router-dom";

export default function POS() {
  const { isShiftOpen, isChecking } = useShift();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("เงินสด");
  const [cashReceived, setCashReceived] = useState("");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState("ใบเสร็จ");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const barcodeRef = useRef(null);

  // Fetch products on load
  useEffect(() => {
    // Fetch products and active promotions on load
    fetchApi("getProducts").then(data => {
      setProducts(Array.isArray(data) ? data : []);
    });
    fetchApi("getPromotions").then(data => {
      const allPromos = Array.isArray(data) ? data : [];
      setPromotions(allPromos.filter(p => p.Status === "ACTIVE"));
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
      // Use Barcode as unique key (new unified schema has no ID)
      const key = product.Barcode || product.Name;
      const existing = prev.find(item => item.id === key);
      if (existing) {
        return prev.map(item => item.id === key ? { ...item, qty: item.qty + 1 } : item);
      }
      return [{ 
        id: key,
        Barcode: product.Barcode,
        Name: product.Name,
        name: product.Name,  // keep lowercase alias for display
        price: Number(product.Price) || 0,
        image: product.ImageURL || "https://placehold.co/300x300?text=No+Image",
        vatStatus: product.VatStatus || "VAT",
        qty: 1 
      }, ...prev];
    });
    setBarcodeInput("");
  };

  const handleScanSuccess = (decodedText) => {
    setBarcodeInput(decodedText);
    setIsScannerOpen(false); // Close scanner on success
    
    // Auto add if exists
    const exactMatch = products.find(p => String(p.Barcode) === String(decodedText).trim());
    if (exactMatch) {
      addToCart(exactMatch);
    }
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
  
  // Promotion Calculation Engine
  const calculateDiscounts = () => {
    let totalDiscount = 0;
    
    promotions.forEach(promo => {
      if (promo.ConditionType === "MIN_AMOUNT") {
        if (subtotal >= parseFloat(promo.ConditionValue1 || 0)) {
          if (promo.DiscountType === "PERCENT") {
            totalDiscount += subtotal * (parseFloat(promo.DiscountValue) / 100);
          } else {
            totalDiscount += parseFloat(promo.DiscountValue);
          }
        }
      } else if (promo.ConditionType === "COMBO_ITEM") {
        const item1 = cart.find(c => String(c.Barcode) === String(promo.ConditionValue1));
        const item2 = cart.find(c => String(c.Barcode) === String(promo.ConditionValue2));
        
         if (item1 && item2) {
            const timesMet = Math.min(item1.qty, item2.qty);
            if (timesMet > 0) {
              if (promo.DiscountType === "PERCENT") {
                 // For percent combo discount, calculate based on the combined price of the pair
                 const comboPrice = (item1.price + item2.price) * timesMet;
                 totalDiscount += comboPrice * (parseFloat(promo.DiscountValue) / 100);
              } else {
                 totalDiscount += parseFloat(promo.DiscountValue) * timesMet;
              }
            }
         }
      }
    });

    return Math.min(totalDiscount, subtotal); // Discount cannot exceed subtotal
  };

  const discountAmount = calculateDiscounts();
  const vatableSubtotal = cart.reduce((sum, item) => sum + (item.vatStatus === "NON VAT" ? 0 : (item.price * item.qty)), 0);
  const vatableRatio = subtotal > 0 ? (vatableSubtotal / subtotal) : 0;
  const vatableSubtotalAfterDiscount = vatableSubtotal - (discountAmount * vatableRatio);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = vatableSubtotalAfterDiscount > 0 ? vatableSubtotalAfterDiscount * 0.07 : 0;
  const total = subtotalAfterDiscount + tax;

  const relatedPromotions = cart.length > 0 ? promotions.filter(promo => {
    if (promo.ConditionType === "COMBO_ITEM") {
      // Check if at least one item of the COMBO is in the cart
      const hasItem1 = cart.some(c => String(c.Barcode) === String(promo.ConditionValue1));
      const hasItem2 = cart.some(c => String(c.Barcode) === String(promo.ConditionValue2));
      return hasItem1 || hasItem2;
    }
    return false;
  }) : [];

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setIsCheckingOut(true);
    const payload = {
      action: "checkout",
      payload: {
        totalAmount: total,
        tax: tax,
        discount: discountAmount,
        paymentMethod: paymentMethod,
        cart: cart.map(c => ({ Barcode: c.Barcode, Name: c.Name || c.name, qty: c.qty, price: c.price })),
        receiptType,
        customerInfo: receiptType === "ใบกำกับภาษี" ? { name: customerName, address: customerAddress, taxId: customerTaxId } : null
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

  // === SHIFT GUARD ===
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isShiftOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <Lock size={36} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ยังไม่ได้เปิดกะ</h2>
          <p className="text-gray-500 mt-2">กรุณาเปิดกะก่อนเข้าใช้งานระบบ POS</p>
        </div>
        <button
          onClick={() => navigate("/shift")}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
        >
          ไปเปิดกะ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      
      {/* Left side: Search & Cart Items */}
      <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden order-1 lg:order-none">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 relative">
          <form onSubmit={handleScan} className="relative z-10 flex items-center gap-2">
            <div className="relative flex-1">
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
            </div>
            
            <button 
              type="button"
              onClick={() => setIsScannerOpen(!isScannerOpen)}
              className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shadow-sm shrink-0"
              title="เปิดกล้องสแกน"
            >
              {isScannerOpen ? <X size={24} /> : <Camera size={24} />}
            </button>
            <button type="submit" className="hidden">ตกลง</button>
          </form>

          {/* Camera Scanner View */}
          {isScannerOpen && (
            <BarcodeScanner 
              onScanSuccess={handleScanSuccess} 
              onClose={() => setIsScannerOpen(false)} 
            />
          )}

          {/* Autocomplete Dropdown */}
          {barcodeInput.trim() && searchResults.length > 0 && !products.find(p => String(p.Barcode) === barcodeInput.trim()) && (
            <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
              {searchResults.map((p, idx) => (
                <button 
                  key={p.Barcode || idx} 
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
        <div className="flex-1 overflow-auto p-4 flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4 min-h-[300px]">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                <ShoppingCart size={40} className="opacity-50" />
              </div>
              <p className="text-lg">ยังไม่มีสินค้าในตะกร้า ลองสแกนดูสิ!</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3">
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

          {/* Related Promotions section */}
          {relatedPromotions.length > 0 && (
            <div className="mt-6 p-4 bg-fuchsia-50 rounded-xl border border-fuchsia-100 shrink-0">
               <h4 className="font-semibold text-fuchsia-800 mb-2 flex items-center gap-2">
                 <Tag size={18} /> 
                 โปรโมชั่นที่แนะนำสำหรับสินค้าในตะกร้า
               </h4>
               <ul className="space-y-2">
                 {relatedPromotions.map((promo, idx) => (
                   <li key={idx} className="text-sm text-fuchsia-700 flex items-start gap-2">
                     <span className="mt-0.5 font-bold">•</span>
                     <span>{promo.Name}</span>
                   </li>
                 ))}
               </ul>
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
            
            {discountAmount > 0 && (
               <div className="flex justify-between text-fuchsia-600 font-bold bg-fuchsia-50 px-2 py-1 -mx-2 rounded-lg">
                 <span>ส่วนลดโปรโมชั่น</span>
                 <span>-฿{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
            )}
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
          <div className="mb-6 space-y-3">
             <h4 className="font-medium text-sm text-gray-500 tracking-wider">ประเภทเอกสาร</h4>
             <div className="flex gap-4 mb-2 border-b pb-4">
                <button 
                  onClick={() => setReceiptType("ใบเสร็จ")}
                  className={clsx("flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border", receiptType === "ใบเสร็จ" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100")}
                >
                  ใบเสร็จอย่างย่อ
                </button>
                <button 
                  onClick={() => setReceiptType("ใบกำกับภาษี")}
                  className={clsx("flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border", receiptType === "ใบกำกับภาษี" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100")}
                >
                  ใบกำกับภาษีเต็มรูป
                </button>
             </div>
             {receiptType === "ใบกำกับภาษี" && (
                <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
                   <input type="text" placeholder="ชื่อ-นามสกุล / บริษัท" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                   <input type="text" placeholder="ที่อยู่" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                   <input type="text" placeholder="เลขประจำตัวผู้เสียภาษี" value={customerTaxId} onChange={e => setCustomerTaxId(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                </div>
             )}
          </div>

          <h4 className="font-medium text-sm text-gray-500 mb-3 tracking-wider">เลือกประเภทการจ่ายเงิน</h4>
          {/* Payment options */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <button 
              onClick={() => { setPaymentMethod("เงินสด"); setCashReceived(""); }}
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
              onClick={() => setPaymentMethod("โอนเข้าบัญชี")}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                paymentMethod === "โอนเข้าบัญชี" 
                  ? "border-blue-500 bg-blue-50 text-blue-600" 
                  : "border-gray-100 hover:border-blue-300 text-gray-500 bg-gray-50"
              )}
            >
              <QrCode size={24} />
              <span className="text-xs font-semibold">โอนบัญชี</span>
            </button>
            <button 
              onClick={() => setPaymentMethod("สแกน QR")}
              className={clsx(
                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2",
                paymentMethod === "สแกน QR" 
                  ? "border-blue-500 bg-blue-50 text-blue-600" 
                  : "border-gray-100 hover:border-blue-300 text-gray-500 bg-gray-50"
              )}
            >
              <QrCode size={24} />
              <span className="text-xs font-semibold">สแกน QR</span>
            </button>
          </div>
          {/* Second row: Credit Card */}
          <div className="mb-6">
            <button 
              onClick={() => setPaymentMethod("บัตรเครดิต")}
              className={clsx(
                "w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                paymentMethod === "บัตรเครดิต" 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-gray-100 hover:border-primary/30 text-gray-500 bg-gray-50"
              )}
            >
              <CreditCard size={20} />
              <span className="text-sm font-semibold">บัตรเครดิต</span>
            </button>
          </div>

          {/* Cash: received & change */}
          {paymentMethod === "เงินสด" && (
            <div className="mb-5 space-y-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รับเงินมา (บาท)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[20, 50, 100, 500, 1000].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCashReceived(prev => String(parseFloat(prev || 0) + d))}
                      className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold border border-amber-200 transition-colors"
                    >
                      +{d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashReceived("")}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-bold border border-gray-200 transition-colors"
                  >
                    ล้าง
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={`อย่างน้อย ฿${total.toFixed(2)}`}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all text-lg font-bold bg-white"
                />
              </div>
              {cashReceived !== "" && (
                <div className={clsx(
                  "flex items-center justify-between rounded-xl px-4 py-3 font-bold text-lg",
                  parseFloat(cashReceived) >= total ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                )}>
                  <span>{parseFloat(cashReceived) >= total ? "เงินทอน" : "เงินไม่ครบ"}:</span>
                  <span>฿{Math.abs(parseFloat(cashReceived || 0) - total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          )}

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
        receiptType={receiptType}
        customerInfo={{ customerName, customerAddress, customerTaxId }}
      />
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Search, ScanLine, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, ShoppingCart, Loader2, Camera, X, Lock, Tag, CheckCircle, UserPlus, Users, Star, Gift, Ticket } from "lucide-react";
import clsx from "clsx";
import TaxInvoiceModal from "../components/TaxInvoiceModal";
import BarcodeScanner from "../components/BarcodeScanner";
import CustomerModal from "../components/CustomerModal";
import PurchasePackageModal from "../components/PurchasePackageModal";
import BuyCouponModal from "../components/BuyCouponModal";
import { fetchApi, postApi } from "../api";
import { useShift } from "../context/ShiftContext";
import { useNavigate } from "react-router-dom";

export default function POS() {
  const { isShiftOpen, isChecking } = useShift();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [splitPayments, setSplitPayments] = useState([{ method: "เงินสด", amount: "" }]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState("ใบเสร็จ");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptData, setReceiptData] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualDiscountValue, setManualDiscountValue] = useState("");
  const [manualDiscountType, setManualDiscountType] = useState("baht");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPurchasePkgOpen, setIsPurchasePkgOpen] = useState(false);
  const [isBuyCouponOpen, setIsBuyCouponOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);   // coupon applied to this bill
  const [customerCoupons, setCustomerCoupons] = useState([]);   // all coupons loaded for app
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [pendingPackage, setPendingPackage] = useState(null);   // { customer, pkg } package pending checkout
  const barcodeRef = useRef(null);

  // Fetch products on load — wait for ALL data before enabling search
  useEffect(() => {
    Promise.all([
      fetchApi("getProducts"),
      fetchApi("getPromotions"),
      fetchApi("getCustomers"),
      fetchApi("getCustomerCoupons"),
    ]).then(([prodsData, promosData, custsData, ccData]) => {
      setProducts(Array.isArray(prodsData) ? prodsData : []);
      const allPromos = Array.isArray(promosData) ? promosData : [];
      setPromotions(allPromos.filter(p => p.Status === "ACTIVE"));
      setCustomers(Array.isArray(custsData) ? custsData : []);
      setCustomerCoupons(Array.isArray(ccData) ? ccData : []);
      setIsLoadingProducts(false);
    });
  }, []);

  const selectCustomer = (c) => {
    setCustomerName(c.Name || "");
    setCustomerAddress(c.TaxAddress || c.Address || "");
    setCustomerTaxId(c.TaxID || "");
    setCustomerPhone(c.Phone || "");
    setCustomerSearch(c.Name || "");
    setShowCustomerDropdown(false);
    // Switch to tax invoice when a customer is selected
    if (c.TaxID || c.TaxAddress) setReceiptType("ใบกำกับภาษี");
  };

  const clearCustomer = () => {
    setCustomerName("");
    setCustomerAddress("");
    setCustomerTaxId("");
    setCustomerPhone("");
    setCustomerSearch("");
  };

  // Keep focus on barcode input for quick scanning (only after products are loaded)
  useEffect(() => {
    if (!isInvoiceModalOpen && !isLoadingProducts) {
      barcodeRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, isInvoiceModalOpen, isLoadingProducts]);

  const addToCart = (product, qtyToAdd = 1) => {
    setCart(prev => {
      // Use Barcode as unique key (new unified schema has no ID)
      const key = product.Barcode || product.Name;
      const existing = prev.find(item => item.id === key);
      if (existing) {
        return prev.map(item => item.id === key ? { ...item, qty: item.qty + qtyToAdd } : item);
      }
      return [{ 
        id: key,
        Barcode: product.Barcode,
        Name: product.Name,
        name: product.Name,  // keep lowercase alias for display
        price: Number(product.Price) || 0,
        costPrice: Number(product.CostPrice) || 0,
        image: product.ImageURL || "https://placehold.co/300x300?text=No+Image",
        vatStatus: product.VatStatus || "VAT",
        qty: qtyToAdd 
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
      addToCart(exactMatch, 1);
      return;
    }
    const packMatch = products.find(p => String(p.PackBarcode || "").trim() === String(decodedText).trim());
    if (packMatch) {
      const packQty = parseFloat(packMatch.PackMultiplier) || 1;
      addToCart(packMatch, packQty);
    }
  };

  const handleScan = (e) => {
    e.preventDefault();
    if (isLoadingProducts) return; // ยังโหลดไม่เสร็จ
    const currentInput = barcodeRef.current?.value || barcodeInput;
    if (!currentInput) return;
    
    // Robust cleanup: remove zero-width spaces and control characters
    let cleanInput = currentInput.replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').trim();
    
    // If input looks like a pure barcode (only digits and possibly spaces/dashes), strip everything but digits
    if (/^[\d\s\-]+$/.test(cleanInput)) {
      cleanInput = cleanInput.replace(/[^\d]/g, '');
    }

    if (!cleanInput) return;
    if (cleanInput !== barcodeInput) setBarcodeInput(cleanInput);

    // Find exact barcode match (also trim the DB barcode to be safe)
    const exactMatch = products.find(p => String(p.Barcode).trim() === cleanInput);
    if (exactMatch) {
      addToCart(exactMatch, 1);
      return;
    }
    
    // Find pack barcode match
    const packMatch = products.find(p => String(p.PackBarcode || "").trim() === cleanInput);
    if (packMatch) {
      const packQty = parseFloat(packMatch.PackMultiplier) || 1;
      addToCart(packMatch, packQty);
      return;
    }

    // Find name matches
    const stringMatches = products.filter(p => p.Name?.toLowerCase().includes(cleanInput.toLowerCase()));
    if (stringMatches.length === 1) {
      addToCart(stringMatches[0], 1);
    } else if (stringMatches.length === 0) {
      alert("ไม่พบรหัสสินค้าหรือชื่อสินค้านี้ในระบบ!");
      setBarcodeInput("");
    }
  };

  // Search results for dropdown
  const searchResults = barcodeInput.trim() 
    ? products.filter(p => {
        const query = barcodeInput.replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').trim().toLowerCase();
        const numQuery = query.replace(/[^\d]/g, ''); // numeric only version for barcode matching
        const pName = (p.Name || "").toLowerCase();
        const pBarcode = String(p.Barcode || "").trim();
        const pPackBarcode = String(p.PackBarcode || "").trim();
        return pName.includes(query) || (numQuery && pBarcode.includes(numQuery)) || pBarcode.includes(query) || (numQuery && pPackBarcode.includes(numQuery)) || pPackBarcode.includes(query);
      })
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
  const packagePrice = pendingPackage ? (parseFloat(pendingPackage.pkg.Price) || 0) : 0;
  
  // Promotion Calculation Engine
  const calculateDiscounts = () => {
    let totalDiscount = 0;
    promotions.forEach(promo => {
      if (promo.ConditionType === "MIN_AMOUNT") {
        let qualifyingSubtotal = subtotal;
        if (promo.DiscountType === "FREE_ITEM") {
           const freeBc = String(promo.DiscountValue).trim();
           const freeItem = cart.find(c => String(c.Barcode) === freeBc);
           if (freeItem && freeItem.qty > 0) qualifyingSubtotal -= freeItem.price;
        }

        if (qualifyingSubtotal >= parseFloat(promo.ConditionValue1 || 0)) {
          if (promo.DiscountType === "PERCENT") {
            totalDiscount += subtotal * (parseFloat(promo.DiscountValue) / 100);
          } else if (promo.DiscountType === "FREE_ITEM") {
             const freeBc = String(promo.DiscountValue).trim();
             const freeItem = cart.find(c => String(c.Barcode) === freeBc);
             if (freeItem && freeItem.qty > 0) totalDiscount += freeItem.price;
          } else {
            totalDiscount += parseFloat(promo.DiscountValue);
          }
        }
      } else if (promo.ConditionType === "COMBO_ITEM") {
         const comboBarcodes = String(promo.ConditionValue1 || "").includes(",") 
           ? String(promo.ConditionValue1).split(",").map(b => b.trim()).filter(Boolean)
           : [promo.ConditionValue1, promo.ConditionValue2].map(b => String(b).trim()).filter(Boolean);
         let minQty = Infinity, comboPrice = 0, allFound = true;
         for (const bc of comboBarcodes) {
            const item = cart.find(c => String(c.Barcode) === bc);
            if (!item) { allFound = false; break; }
            minQty = Math.min(minQty, item.qty);
            comboPrice += item.price;
         }
         if (allFound && minQty > 0 && minQty !== Infinity) {
            if (promo.DiscountType === "PERCENT") {
               totalDiscount += (comboPrice * minQty) * (parseFloat(promo.DiscountValue) / 100);
            } else if (promo.DiscountType === "FREE_ITEM") {
               const freeBc = String(promo.DiscountValue).trim();
               const freeItem = cart.find(c => String(c.Barcode) === freeBc);
               if (freeItem && freeItem.qty > 0) {
                  const freeDisQty = Math.min(freeItem.qty, minQty);
                  totalDiscount += freeItem.price * freeDisQty;
               }
            } else {
               totalDiscount += parseFloat(promo.DiscountValue) * minQty;
            }
         }
      }
    });

    // Add manual discount
    const mdVal = parseFloat(manualDiscountValue) || 0;
    if (mdVal > 0) {
      if (manualDiscountType === "percent") {
        totalDiscount += subtotal * (mdVal / 100);
      } else {
        totalDiscount += mdVal;
      }
    }

    return Math.min(totalDiscount, subtotal);
  };

  // Build list of FREE_ITEM lines to show in cart
  const freeItemLines = [];
  promotions.forEach(promo => {
    if (promo.DiscountType !== "FREE_ITEM") return;
    let isApplicable = false;
    let freeQty = 1;
    if (promo.ConditionType === "MIN_AMOUNT") {
      let qualifyingSubtotal = subtotal;
      const freeBc = String(promo.DiscountValue).trim();
      const freeItem = cart.find(c => String(c.Barcode) === freeBc);
      if (freeItem && freeItem.qty > 0) qualifyingSubtotal -= freeItem.price;
      
      if (qualifyingSubtotal >= parseFloat(promo.ConditionValue1 || 0)) {
        isApplicable = true;
      }
    } else if (promo.ConditionType === "COMBO_ITEM") {
      const comboBarcodes = String(promo.ConditionValue1 || "").includes(",")
        ? String(promo.ConditionValue1).split(",").map(b => b.trim()).filter(Boolean)
        : [promo.ConditionValue1, promo.ConditionValue2].map(b => String(b).trim()).filter(Boolean);
      let minQty = Infinity, allFound = true;
      for (const bc of comboBarcodes) {
        const item = cart.find(c => String(c.Barcode) === bc);
        if (!item) { allFound = false; break; }
        minQty = Math.min(minQty, item.qty);
      }
      if (allFound && minQty > 0 && minQty !== Infinity) { isApplicable = true; freeQty = minQty; }
    }
    if (isApplicable) {
      const freeBc = String(promo.DiscountValue).trim();
      const freeItem = cart.find(c => String(c.Barcode) === freeBc);
      if (freeItem) {
        const qty = Math.min(freeItem.qty, freeQty);
        freeItemLines.push({ name: freeItem.name, price: freeItem.price, qty, promoName: promo.Name, vatStatus: freeItem.vatStatus || "" });
      }
    }
  });

  const discountAmount = calculateDiscounts();

  // Coupon discount (applied on top of promo/manual discounts)
  const couponDiscount = (() => {
    if (!selectedCoupon) return 0;
    const base = Math.max(0, subtotal - discountAmount);
    if (selectedCoupon.Type === "PERCENT") return Math.min(base * (parseFloat(selectedCoupon.Value) / 100), base);
    if (selectedCoupon.Type === "FREE_ITEM") {
      const freeBarcode = String(selectedCoupon.FreeItemBarcode || "").trim();
      if (!freeBarcode) return 0;
      const prod = products.find(p => String(p.Barcode || "").trim() === freeBarcode);
      const freePrice = parseFloat(prod?.Price || prod?.price) || 0;
      return Math.min(freePrice, base);
    }
    return Math.min(parseFloat(selectedCoupon.Value) || 0, base);
  })();

  const vatableSubtotal = cart.reduce((sum, item) => sum + (item.vatStatus === "NON VAT" ? 0 : (item.price * item.qty)), 0);

  // ── Precise VAT calculation ──
  // 1. FREE_ITEM promo discounts: attributed to the specific item's VAT bucket
  const freeItemVatableDiscount = freeItemLines.reduce((sum, fi) => sum + (fi.vatStatus !== "NON VAT" ? fi.price * fi.qty : 0), 0);
  const freeItemNonVatableDiscount = freeItemLines.reduce((sum, fi) => sum + (fi.vatStatus === "NON VAT" ? fi.price * fi.qty : 0), 0);

  // 2. Remaining discounts (manual/percent promo + coupon) distributed proportionally
  const remainingDiscount = (discountAmount - freeItemVatableDiscount - freeItemNonVatableDiscount) + couponDiscount;
  const vatableRatio = subtotal > 0 ? vatableSubtotal / subtotal : 0;
  const remainingVatableDiscount = remainingDiscount * vatableRatio;

  // 3. Vatable amount after all discounts (VAT-inclusive)
  const vatableSubtotalAfterDiscount = Math.max(0, vatableSubtotal - freeItemVatableDiscount - remainingVatableDiscount);

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount - couponDiscount);
  // ราคาที่ตั้งไว้รวม VAT อยู่แล้ว → ถอด VAT ออก: preVat = price × 100/107, tax = price - preVat
  const vatablePreVat = vatableSubtotalAfterDiscount > 0 ? vatableSubtotalAfterDiscount * (100 / 107) : 0;
  const tax = vatableSubtotalAfterDiscount - vatablePreVat;
  const total = subtotalAfterDiscount + packagePrice; // รวมราคาแพคเกจ (ถ้ามี)
  // สำหรับเงินสด: ปัดขึ้นเป็นจำนวนเต็ม (Math.ceil)
  const totalForCash = Math.ceil(total);
  // ราคาสินค้าก่อน VAT (สำหรับแสดงผล)
  const preVatDisplay = subtotalAfterDiscount - tax;

  // ── Split payment derived values ──
  const hasCashSplit   = splitPayments.some(p => p.method === "เงินสด");
  const hasCreditSplit = splitPayments.some(p => p.method === "เครดิต");
  const totalPaid  = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const cashPaid   = splitPayments.filter(p => p.method === "เงินสด").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const creditPaid = splitPayments.filter(p => p.method === "เครดิต").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining  = Math.max(0, total - totalPaid);
  const cashChange = (hasCashSplit && totalPaid >= total) ? Math.max(0, totalPaid - total) : 0;
  // Payment method string for receipt/backend (skip entries with no amount unless it's the only entry)
  const paymentMethodStr = (() => {
    const active = splitPayments.filter(p => parseFloat(p.amount) > 0);
    if (active.length === 0) return splitPayments[0]?.method || "เงินสด";
    return active.map(p => p.method).join(" + ");
  })();
  // Credits: if single เครดิต with blank amount, treat as full total
  const effectiveCreditPaid = (hasCreditSplit && splitPayments.length === 1 && !splitPayments[0].amount)
    ? total : creditPaid;
  // Checkout is complete when: non-cash single method (no amount needed), or totalPaid >= total
  const isPaymentComplete = (() => {
    if (splitPayments.length === 1 && !splitPayments[0].amount) {
      return splitPayments[0].method !== "เงินสด";
    }
    return totalPaid >= total - 0.005;
  })();

  const getPromoHints = () => {
    const hints = [];
    promotions.forEach(promo => {
      if (promo.ConditionType === "MIN_AMOUNT") {
        const target = parseFloat(promo.ConditionValue1 || 0);
        let qualifyingSubtotal = subtotal;
        if (promo.DiscountType === "FREE_ITEM") {
           const freeBc = String(promo.DiscountValue).trim();
           const freeItem = cart.find(c => String(c.Barcode) === freeBc);
           if (freeItem && freeItem.qty > 0) qualifyingSubtotal -= freeItem.price;
        }

        if (qualifyingSubtotal >= target) {
           hints.push({ text: `เงื่อนไขครบแล้ว: ${promo.Name}`, achieved: true });
        } else {
           const diff = target - qualifyingSubtotal;
           hints.push({ text: `ขาดอีก ฿${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} จะได้รับ: ${promo.Name}`, achieved: false });
        }
      } else if (promo.ConditionType === "COMBO_ITEM" && cart.length > 0) {
        const comboBarcodes = String(promo.ConditionValue1 || "").includes(",") 
           ? String(promo.ConditionValue1).split(",").map(b => b.trim()).filter(Boolean)
           : [promo.ConditionValue1, promo.ConditionValue2].map(b => String(b).trim()).filter(Boolean);
        const hasSome = comboBarcodes.some(bc => cart.some(c => String(c.Barcode) === bc));
        
        let minQty = Infinity;
        let allFound = true;
        for (const bc of comboBarcodes) {
            const item = cart.find(c => String(c.Barcode) === bc);
            if (!item) { allFound = false; break; }
            minQty = Math.min(minQty, item.qty);
        }
        
        if (allFound && minQty > 0) {
           hints.push({ text: `เข้าเงื่อนไขโปร: ${promo.Name}`, achieved: true });
        } else if (hasSome) {
           hints.push({ text: `แนะนำซื้อคู่/ชุดเพิ่ม: ${promo.Name}`, achieved: false });
        }
      }
    });
    return hints;
  };
  const promoHints = getPromoHints();

  const resetAll = () => {
    setCart([]);
    setBarcodeInput("");
    setSplitPayments([{ method: "เงินสด", amount: "" }]);
    setReceiptType("ใบเสร็จ");
    setCustomerName("");
    setCustomerAddress("");
    setCustomerTaxId("");
    setCustomerPhone("");
    setCustomerSearch("");
    setManualDiscountValue("");
    setManualDiscountType("baht");
    setSelectedCoupon(null);
    setShowCouponPicker(false);
    setPendingPackage(null);
  };

  // Called from PurchasePackageModal when user confirms package selection
  const handlePackageAdd = (customer, pkg) => {
    setPendingPackage({ customer, pkg });
    // Auto-select the customer
    setCustomerName(customer.Name || "");
    setCustomerPhone(customer.Phone || "");
    setCustomerAddress(customer.TaxAddress || customer.Address || "");
    setCustomerTaxId(customer.TaxID || "");
    setCustomerSearch(customer.Name || "");
    setIsPurchasePkgOpen(false);
  };

  // Build package as a NON-VAT line item for the receipt
  const buildPkgCartItem = () => pendingPackage ? {
    id: `pkg-${pendingPackage.pkg.PackageID}`,
    Barcode: "",
    Name: `🎁 ${pendingPackage.pkg.Name}`,
    name: `🎁 ${pendingPackage.pkg.Name}`,
    price: packagePrice,
    qty: 1,
    vatStatus: "NON VAT",
    image: "https://placehold.co/300x300?text=Package",
  } : null;

  const openPreview = () => {
    const pkgItem = buildPkgCartItem();
    const previewCart = pkgItem ? [pkgItem, ...cart.map(c => ({ ...c }))] : cart.map(c => ({ ...c }));
    setReceiptData({
      cart: previewCart,
      paymentMethod: paymentMethodStr,
      subtotal: subtotal + packagePrice,
      discountAmount,
      freeItemLines: freeItemLines.map(f => ({ ...f })),
      couponDiscount,
      couponName: selectedCoupon?.CouponName || selectedCoupon?.Name || "",
      tax,
      total,
      receiptType,
      customerInfo: { customerName, customerAddress, customerTaxId },
      taxInvoiceNo: "",
    });
    setIsInvoiceModalOpen(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 && !pendingPackage) return;
    setIsCheckingOut(true);

    let pkgResult = null;

    // ── Package purchase (if pending) ──
    if (pendingPackage) {
      const pkgRes = await postApi({
        action: "purchasePackage",
        payload: {
          customerName: pendingPackage.customer.Name,
          packageId: pendingPackage.pkg.PackageID,
        }
      });
      if (!pkgRes.success) {
        setIsCheckingOut(false);
        alert("เกิดข้อผิดพลาดในการซื้อแพคเกจ: " + (pkgRes.error || "Unknown"));
        return;
      }
      pkgResult = pkgRes;
      setCustomers(prev => prev.map(c =>
        String(c.Name || "").toLowerCase() === pendingPackage.customer.Name.toLowerCase()
          ? { ...c, Points: pkgRes.newBalance }
          : c
      ));
    }

    const pkgItem = buildPkgCartItem();

    // ── Normal cart checkout (if cart has items) ──
    if (cart.length > 0) {
      // Save customer if tax invoice
      if (receiptType === "ใบกำกับภาษี" && customerName.trim() !== "") {
        const isExisting = customers.some(c => c.Name === customerName.trim());
        if (!isExisting) {
          try {
            await postApi({ action: "saveCustomer", payload: { name: customerName.trim(), phone: customerPhone.trim(), taxAddress: customerAddress.trim(), taxId: customerTaxId.trim() } });
            setCustomers(prev => [...prev, { Name: customerName.trim(), Phone: customerPhone.trim(), TaxAddress: customerAddress.trim(), TaxID: customerTaxId.trim() }]);
          } catch (error) { console.error("Error saving new customer:", error); }
        }
      }

      const cartTotal = subtotalAfterDiscount; // cart-only total (excl. package)
      const res = await postApi({
        action: "checkout",
        payload: {
          totalAmount: cartTotal,
          tax,
          discount: discountAmount,
          paymentMethod: paymentMethodStr,
          cart: cart.map(c => ({ Barcode: c.Barcode, Name: c.Name || c.name, qty: c.qty, price: c.price })),
          receiptType,
          customerInfo: (receiptType === "ใบกำกับภาษี" || hasCreditSplit) ? { name: customerName, phone: customerPhone, address: customerAddress, taxId: customerTaxId } : null,
          pointsUsed: Math.ceil(effectiveCreditPaid) > 0 ? Math.ceil(effectiveCreditPaid) : 0,
          couponInstanceId: selectedCoupon?.ID || ""
        }
      });

      setIsCheckingOut(false);

      if (res.success) {
        if (selectedCoupon?.ID) {
          postApi({ action: "useCoupon", payload: { couponInstanceId: selectedCoupon.ID, orderId: res.orderId || "" } });
          setCustomerCoupons(prev => prev.map(c => c.ID === selectedCoupon.ID ? { ...c, Status: "USED" } : c));
        }
        if (hasCreditSplit && customerName && effectiveCreditPaid > 0) {
          const usedPts = Math.ceil(effectiveCreditPaid);
          setCustomers(prev => prev.map(c =>
            String(c.Name || "").toLowerCase() === customerName.toLowerCase()
              ? { ...c, Points: Math.max(0, (parseFloat(c.Points) || 0) - usedPts) }
              : c
          ));
        }
        // Combined receipt: package item (if any) + regular cart
        const receiptCart = pkgItem ? [pkgItem, ...cart.map(c => ({ ...c }))] : cart.map(c => ({ ...c }));
        setReceiptData({
          cart: receiptCart,
          paymentMethod: paymentMethodStr,
          subtotal: subtotal + packagePrice,
          discountAmount,
          freeItemLines: freeItemLines.map(f => ({ ...f })),
          couponDiscount,
          couponName: selectedCoupon?.CouponName || selectedCoupon?.Name || "",
          tax,
          total: cartTotal + packagePrice,
          receiptType,
          customerInfo: { customerName, customerAddress, customerTaxId },
          taxInvoiceNo: res.taxInvoiceNo || "",
        });
        resetAll();
        setIsInvoiceModalOpen(true);
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (res.error || "Unknown"));
      }
    } else {
      // Package only — open TaxInvoiceModal directly (no checkout API call)
      setIsCheckingOut(false);
      setReceiptData({
        cart: [pkgItem],
        paymentMethod: paymentMethodStr,
        subtotal: packagePrice,
        discountAmount: 0,
        freeItemLines: [],
        couponDiscount: 0,
        couponName: "",
        tax: 0,
        total: packagePrice,
        receiptType,
        customerInfo: { customerName, customerAddress, customerTaxId },
        taxInvoiceNo: pkgResult?.taxInvoiceNo || "",
      });
      resetAll();
      setIsInvoiceModalOpen(true);
    }
  };

  const handleInvoiceClose = () => {
    setIsInvoiceModalOpen(false);
    setReceiptData(null);
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
                {isLoadingProducts
                  ? <Loader2 size={20} className="animate-spin text-primary/60" />
                  : <ScanLine size={20} />
                }
              </div>
              <input
                ref={barcodeRef}
                type="text"
                className={clsx(
                  "w-full pl-12 pr-4 py-3 rounded-xl border transition-all text-lg shadow-sm",
                  isLoadingProducts
                    ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                )}
                placeholder={isLoadingProducts ? "กำลังโหลดข้อมูลสินค้า..." : "สแกนบาร์โค้ด หรือ พิมพ์ชื่อสินค้าที่นี่..."}
                value={barcodeInput}
                onChange={(e) => { if (!isLoadingProducts) setBarcodeInput(e.target.value); }}
                disabled={isLoadingProducts}
                autoFocus={!isLoadingProducts}
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
          {cart.length === 0 && !pendingPackage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4 min-h-[300px]">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                <ShoppingCart size={40} className="opacity-50" />
              </div>
              <p className="text-lg">ยังไม่มีสินค้าในตะกร้า ลองสแกนดูสิ!</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3">
              {/* Pending package row */}
              {pendingPackage && (() => {
                const { customer, pkg } = pendingPackage;
                const totalPts = (parseFloat(pkg.Points) || 0) + (parseFloat(pkg.BonusPoints) || 0);
                return (
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-yellow-300 bg-yellow-50">
                    <div className="w-16 h-16 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600 text-2xl shrink-0">🎁</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-yellow-900">{pkg.Name}</h4>
                        <span className="text-xs font-bold text-yellow-700 bg-yellow-200 rounded-full px-2 py-0.5">เครดิต</span>
                      </div>
                      <p className="text-xs text-yellow-700 mt-0.5">ลูกค้า: <span className="font-semibold">{customer.Name}</span></p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-yellow-600 font-semibold">
                        <Star size={11} /> ได้รับ {totalPts.toLocaleString()} เครดิต
                        {parseFloat(pkg.BonusPoints) > 0 && <span className="text-green-600">(รวมโบนัส)</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-yellow-900 text-lg">฿{Number(pkg.Price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <button onClick={() => setPendingPackage(null)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })()}
              {cart.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors group bg-white shadow-sm hover:shadow-md">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                  
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{item.name}</h4>
                      {item.vatStatus === "NON VAT" && (
                        <span className="text-xs font-bold text-gray-400 border border-gray-300 rounded px-1 py-0.5 leading-none">(N)</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{item.Barcode}</p>
                    <div className="text-primary font-bold mt-1">฿{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
                    ฿{(item.price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ml-2">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}

              {/* Free item lines from promotions */}
              {freeItemLines.map((fi, idx) => (
                <div key={`free-${idx}`} className="flex items-center gap-4 p-4 rounded-xl border border-green-200 bg-green-50">
                  <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-2xl shrink-0">🎁</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-green-800">{fi.name}</h4>
                      <span className="text-xs font-bold text-green-700 bg-green-200 rounded-full px-2 py-0.5">ของแถม</span>
                    </div>
                    <p className="text-xs text-green-600 mt-0.5">จากโปร: {fi.promoName}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-700 line-through">฿{(fi.price * fi.qty).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                    <div className="font-bold text-green-800 text-lg">-฿{(fi.price * fi.qty).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Related Promotions section */}
          {promoHints.length > 0 && (
            <div className="mt-6 p-4 bg-fuchsia-50 rounded-xl border border-fuchsia-100 shrink-0">
               <h4 className="font-semibold text-fuchsia-800 mb-2 flex items-center gap-2">
                 <Tag size={18} /> 
                 รายการส่งเสริมการขาย (Promotions)
               </h4>
               <ul className="space-y-2">
                 {promoHints.map((hint, idx) => (
                   <li key={idx} className={`text-sm flex items-start gap-2 ${hint.achieved ? "text-green-700 font-bold" : "text-fuchsia-700"}`}>
                     <span className="mt-0.5">{hint.achieved ? "🎉" : "•"}</span>
                     <span>{hint.text}</span>
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
            <div className="flex justify-between text-gray-500 items-center">
              <span>ส่วนลดเพิ่มเติม</span>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  min="0" 
                  placeholder="0"
                  value={manualDiscountValue}
                  onChange={(e) => setManualDiscountValue(e.target.value)}
                  className="w-16 px-2 py-1 text-right border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select 
                  value={manualDiscountType} 
                  onChange={(e) => setManualDiscountType(e.target.value)}
                  className="px-1 py-1 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="baht">฿</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between text-gray-500">
              <span>ราคาสินค้า (ก่อน VAT)</span>
              <span>฿{preVatDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            
            {discountAmount > 0 && (
               <div className="flex justify-between text-fuchsia-600 font-bold bg-fuchsia-50 px-2 py-1 -mx-2 rounded-lg">
                 <span>ส่วนลดรวมทั้งหมด</span>
                 <span>-฿{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
            )}
            {(couponDiscount > 0 || selectedCoupon) && (
               <div className="flex justify-between text-amber-700 font-bold bg-amber-50 px-2 py-1 -mx-2 rounded-lg">
                 <span className="flex items-center gap-1.5">
                   <Ticket size={14} />
                   {selectedCoupon?.Type === "FREE_ITEM"
                     ? `🎁 ${selectedCoupon?.FreeItemName || selectedCoupon?.CouponName}`
                     : `คูปอง: ${selectedCoupon?.CouponName}`}
                 </span>
                 <span>-฿{couponDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>ภาษีมูลค่าเพิ่ม 7% (รวมในราคาแล้ว)</span>
              <span>฿{tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {pendingPackage && (
              <div className="flex justify-between text-yellow-700 font-bold bg-yellow-50 px-2 py-1 -mx-2 rounded-lg">
                <span className="flex items-center gap-1.5"><Gift size={14} /> เครดิต: {pendingPackage.pkg.Name}</span>
                <span>฿{Number(pendingPackage.pkg.Price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="border-t border-gray-200 my-2 pt-2"></div>
            <div className="flex justify-between items-end">
              <span className="text-gray-900 font-medium pb-1">ยอดรวมทั้งหมด</span>
              <span className="text-4xl font-bold text-primary tracking-tight">
                ฿{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {hasCashSplit && total !== totalForCash && (
              <div className="flex justify-end">
                <span className="text-xs text-amber-600 font-medium">* ปัดขึ้นเป็น ฿{totalForCash.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          {/* Customer quick-select bar */}
          <div className="mb-4 flex items-center gap-2">
            {customerName ? (
              <div className="flex-1 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                <Users size={15} className="text-primary shrink-0" />
                <span className="text-sm font-semibold text-primary truncate">{customerName}</span>
                {customerPhone && <span className="text-xs text-gray-400 truncate hidden sm:block">{customerPhone}</span>}
                <button onClick={clearCustomer} className="ml-auto text-gray-400 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex-1 text-sm text-gray-400 flex items-center gap-1.5 px-1">
                <Users size={14} /> ยังไม่ได้เลือกลูกค้า
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <UserPlus size={14} /> {customerName ? "เปลี่ยน" : "เพิ่ม/เลือก"}
            </button>
            <button
              type="button"
              onClick={() => setIsPurchasePkgOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-500 text-white text-xs font-semibold hover:bg-yellow-600 transition-colors shadow-sm"
              title="ซื้อเครดิต"
            >
              <Gift size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsBuyCouponOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              title="ซื้อคูปองส่วนลด"
            >
              <Ticket size={14} />
            </button>
          </div>

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
                  {/* Search existing customers */}
                  <div className="relative">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Search size={13} className="text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">ค้นหาลูกค้าเดิม</span>
                    </div>
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อ / เบอร์โทร หรือ เลขภาษี..."
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white"
                    />
                    {showCustomerDropdown && customerSearch.trim() && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                        {customers
                          .filter(c => {
                            const q = customerSearch.toLowerCase();
                            return (
                              String(c.Name || "").toLowerCase().includes(q) ||
                              String(c.Phone || "").includes(q) ||
                              String(c.TaxID || "").includes(q)
                            );
                          })
                          .map((c, i) => (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={() => selectCustomer(c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-primary/5 flex flex-col border-b border-gray-50 last:border-0 transition-colors"
                            >
                              <span className="font-semibold text-gray-900 text-sm">{c.Name}</span>
                              <span className="text-xs text-gray-400">{c.Phone && `โทร: ${c.Phone}`} {c.TaxID && `| TAX: ${c.TaxID}`}</span>
                            </button>
                          ))}
                        {customers.filter(c => {
                          const q = customerSearch.toLowerCase();
                          return String(c.Name||"").toLowerCase().includes(q)||String(c.Phone||"").includes(q)||String(c.TaxID||"").includes(q);
                        }).length === 0 && (
                          <div className="px-3 py-3 text-sm text-gray-400 text-center">ไม่พบลูกค้า — กรอกข้อมูลด้านล่างได้เลย</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2 my-1">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="text-xs text-gray-400">หรือกรอกเอง</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>

                  {/* Manual fields */}
                  <input type="text" placeholder="ชื่อ-นามสกุล / บริษัท *" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                  <input type="text" placeholder="เบอร์โทรศัพท์" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                  <input type="text" placeholder="ที่อยู่" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                  <input type="text" placeholder="เลขประจำตัวผู้เสียภาษี" value={customerTaxId} onChange={e => setCustomerTaxId(e.target.value)} className="w-full text-sm px-3 py-2 border rounded focus:outline-none focus:border-primary" />
                  {(customerName || customerPhone || customerAddress || customerTaxId) && (
                    <button type="button" onClick={clearCustomer} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                      <X size={12} /> ล้างข้อมูลลูกค้า
                    </button>
                  )}
                </div>
             )}
          </div>

          {/* Coupon selector — show when customer selected */}
          {customerName && (() => {
            const now = new Date();
            const activeCoupons = customerCoupons.filter(c =>
              String(c.CustomerName || "").toLowerCase() === customerName.toLowerCase() &&
              c.Status === "ACTIVE" &&
              (!c.ExpiryDate || new Date(c.ExpiryDate) >= now)
            );
            return (
              <div className="mb-4">
                {activeCoupons.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowCouponPicker(p => !p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Ticket size={16} />
                        {selectedCoupon ? `ใช้คูปอง: ${selectedCoupon.CouponName}` : `คูปองที่ใช้ได้ (${activeCoupons.length} ใบ)`}
                      </span>
                      <span className="text-xs">{showCouponPicker ? "▲" : "▼"}</span>
                    </button>
                    {showCouponPicker && (
                      <div className="mt-2 space-y-1.5 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        {selectedCoupon && (
                          <button type="button" onClick={() => setSelectedCoupon(null)}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 flex items-center gap-1.5 transition-colors">
                            <X size={12} /> ยกเลิกการใช้คูปอง
                          </button>
                        )}
                        {activeCoupons.map((c, i) => {
                          const isApplied = selectedCoupon?.ID === c.ID;
                          const minOk = !parseFloat(c.MinOrderAmount) || subtotal >= parseFloat(c.MinOrderAmount);
                          let discLabel;
                          if (c.Type === "PERCENT") {
                            discLabel = `ลด ${c.Value}%`;
                          } else if (c.Type === "FREE_ITEM") {
                            const freeBarcode = String(c.FreeItemBarcode || "").trim();
                            const freeProd = freeBarcode ? products.find(p => String(p.Barcode || "").trim() === freeBarcode) : null;
                            const freePrice = parseFloat(freeProd?.Price || freeProd?.price) || 0;
                            discLabel = `🎁 ${c.FreeItemName || "ของแถม"}${freePrice > 0 ? ` (฿${freePrice.toLocaleString()})` : ""}`;
                          } else {
                            discLabel = `ลด ฿${Number(c.Value).toLocaleString()}`;
                          }
                          return (
                            <button key={i} type="button"
                              disabled={!minOk}
                              onClick={() => { setSelectedCoupon(isApplied ? null : c); setShowCouponPicker(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm flex items-center justify-between ${isApplied ? "border-primary bg-primary/5 text-primary" : minOk ? "border-gray-100 hover:border-primary/30 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"}`}>
                              <div>
                                <div className="font-semibold">{c.CouponName}</div>
                                {!minOk && <div className="text-xs text-gray-400">ขั้นต่ำ ฿{Number(c.MinOrderAmount).toLocaleString()}</div>}
                              </div>
                              <span className={`text-xs font-bold ml-2 shrink-0 ${c.Type === "FREE_ITEM" ? "text-green-600" : "text-primary"}`}>{discLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedCoupon && (
                  <div className="mt-2 flex items-center justify-between px-4 py-2 bg-green-50 border border-green-100 rounded-xl text-sm">
                    <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                      <Ticket size={14} />
                      {selectedCoupon.Type === "FREE_ITEM"
                        ? `🎁 ${selectedCoupon.FreeItemName || selectedCoupon.CouponName}`
                        : selectedCoupon.CouponName}
                    </span>
                    <span className="text-green-700 font-bold">
                      {selectedCoupon.Type === "PERCENT"
                        ? `-${selectedCoupon.Value}%`
                        : `-฿${couponDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Split Payment Section ── */}
          <h4 className="font-medium text-sm text-gray-500 mb-3 tracking-wider">เลือกวิธีชำระเงิน (แบ่งชำระได้)</h4>

          {/* Payment rows */}
          <div className="space-y-2 mb-3">
            {splitPayments.map((entry, idx) => {
              const isCashRow   = entry.method === "เงินสด";
              const isCreditRow = entry.method === "เครดิต";
              const rowColor = isCashRow
                ? "border-amber-300 bg-amber-50"
                : isCreditRow
                  ? "border-yellow-400 bg-yellow-50"
                  : entry.method === "บัตรเครดิต"
                    ? "border-purple-300 bg-purple-50"
                    : "border-blue-300 bg-blue-50";
              const methodIcon = {
                "เงินสด": <Banknote size={16} className="text-amber-600 shrink-0" />,
                "โอนเข้าบัญชี": <QrCode size={16} className="text-blue-600 shrink-0" />,
                "สแกน QR": <QrCode size={16} className="text-blue-600 shrink-0" />,
                "บัตรเครดิต": <CreditCard size={16} className="text-purple-600 shrink-0" />,
                "เครดิต": <Star size={16} className="text-yellow-600 shrink-0" />,
              }[entry.method] || <Banknote size={16} className="shrink-0" />;

              const amountFilledBefore = splitPayments.slice(0, idx).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
              const suggestedAmount = Math.max(0, total - amountFilledBefore);

              return (
                <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${rowColor}`}>
                  {methodIcon}
                  <select
                    value={entry.method}
                    onChange={e => {
                      const newMethod = e.target.value;
                      if (newMethod === "เครดิต" && !customerName) {
                        alert("กรุณาเลือกลูกค้าก่อนใช้เครดิต"); return;
                      }
                      setSplitPayments(prev => prev.map((p, i) => i === idx ? { ...p, method: newMethod } : p));
                    }}
                    className="flex-1 bg-transparent border-0 font-semibold text-sm outline-none cursor-pointer min-w-0"
                  >
                    {["เงินสด","โอนเข้าบัญชี","สแกน QR","บัตรเครดิต","เครดิต"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={entry.amount}
                    onChange={e => setSplitPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: e.target.value } : p))}
                    placeholder={suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "0.00"}
                    className="w-28 px-2 py-1.5 border border-white/70 rounded-lg text-right font-bold bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {splitPayments.length > 1 && (
                    <button
                      onClick={() => setSplitPayments(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-white/60 rounded-lg transition-colors shrink-0"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add payment split */}
          <button
            onClick={() => setSplitPayments(prev => {
              const usedMethods = prev.map(p => p.method);
              const next = ["โอนเข้าบัญชี","สแกน QR","เงินสด","บัตรเครดิต","เครดิต"].find(m => !usedMethods.includes(m)) || "โอนเข้าบัญชี";
              return [...prev, { method: next, amount: "" }];
            })}
            className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1.5 mb-3"
          >
            <Plus size={14} /> เพิ่มวิธีชำระ (แบ่งจ่าย)
          </button>

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-1.5 mb-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>ยอดที่ต้องชำระ</span>
              <span className="font-bold text-gray-900">฿{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {totalPaid > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>ชำระแล้ว</span>
                <span className={clsx("font-bold", totalPaid >= total ? "text-emerald-600" : "text-gray-700")}>
                  ฿{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {remaining > 0.005 && totalPaid > 0 && (
              <div className="flex justify-between text-red-600 bg-red-50 px-2 py-1 rounded-lg font-semibold">
                <span>คงค้าง</span>
                <span>฿{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {cashChange > 0.005 && (
              <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg font-bold">
                <span>เงินทอน (เงินสด)</span>
                <span>฿{cashChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Quick cash denomination buttons — only for เงินสด rows */}
          {hasCashSplit && (() => {
            const cashIdx = splitPayments.findIndex(p => p.method === "เงินสด");
            return (
              <div className="flex flex-wrap gap-2 mb-3">
                {[20, 50, 100, 500, 1000].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSplitPayments(prev => prev.map((p, i) =>
                      i === cashIdx ? { ...p, amount: String((parseFloat(p.amount) || 0) + d) } : p
                    ))}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold border border-amber-200 transition-colors"
                  >
                    +{d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSplitPayments(prev => {
                    const nonCashPaid = prev.filter(p => p.method !== "เงินสด").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                    const cashNeeded = Math.ceil(Math.max(0, total - nonCashPaid));
                    return prev.map((p, i) => i === cashIdx ? { ...p, amount: String(cashNeeded) } : p);
                  })}
                  className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-sm font-bold border border-amber-300 transition-colors"
                >
                  พอดี
                </button>
                <button
                  type="button"
                  onClick={() => setSplitPayments(prev => prev.map((p, i) => i === cashIdx ? { ...p, amount: "" } : p))}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-bold border border-gray-200 transition-colors"
                >
                  ล้าง
                </button>
              </div>
            );
          })()}

          {/* เครดิต balance info */}
          {hasCreditSplit && customerName && (() => {
            const custObj = customers.find(c => String(c.Name || "").toLowerCase() === customerName.toLowerCase());
            const available = parseFloat(custObj?.Points) || 0;
            const needed = Math.ceil(effectiveCreditPaid);
            const enough = available >= needed;
            return (
              <div className="mb-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-yellow-800 font-medium">เครดิตคงเหลือ ({customerName})</span>
                  <span className="font-bold text-yellow-700 flex items-center gap-1"><Star size={13} /> {available.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-700">ใช้เครดิต (1 เครดิต = ฿1)</span>
                  <span className="font-bold">{needed.toLocaleString()} pts</span>
                </div>
                {!enough && (
                  <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded-lg font-medium">
                    เครดิตไม่พอ — ขาดอีก {(needed - available).toLocaleString()} เครดิต
                  </div>
                )}
                {enough && needed > 0 && (
                  <div className="text-xs text-green-600 bg-green-50 px-2 py-1.5 rounded-lg flex items-center gap-1">
                    <CheckCircle size={12} /> เครดิตเพียงพอ — คงเหลือหลังชำระ {(available - needed).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="mt-auto space-y-3">
            {!isPaymentComplete && totalPaid > 0 && remaining > 0.005 && (
              <div className="text-center text-sm text-red-500 font-medium bg-red-50 border border-red-100 rounded-xl py-2">
                ยังค้างชำระอีก ฿{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openPreview}
                disabled={cart.length === 0}
                title="ดูตัวอย่างใบเสร็จ"
                className="shrink-0 px-4 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer size={20} />
              </button>
              <button
                onClick={handleCheckout}
                disabled={
                  (cart.length === 0 && !pendingPackage) ||
                  isCheckingOut ||
                  !isPaymentComplete ||
                  (hasCreditSplit && (parseFloat(customers.find(c => String(c.Name || "").toLowerCase() === customerName.toLowerCase())?.Points) || 0) < Math.ceil(effectiveCreditPaid))
                }
                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isCheckingOut ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                {isCheckingOut ? "กำลังบันทึก..." : "รับชำระเงินสำเร็จ"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <TaxInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={handleInvoiceClose}
        cart={receiptData?.cart || []}
        paymentMethod={receiptData?.paymentMethod || ""}
        subtotal={receiptData?.subtotal || 0}
        discountAmount={receiptData?.discountAmount || 0}
        freeItemLines={receiptData?.freeItemLines || []}
        couponDiscount={receiptData?.couponDiscount || 0}
        couponName={receiptData?.couponName || ""}
        tax={receiptData?.tax || 0}
        total={receiptData?.total || 0}
        receiptType={receiptData?.receiptType || "ใบเสร็จ"}
        customerInfo={receiptData?.customerInfo || {}}
        taxInvoiceNo={receiptData?.taxInvoiceNo || ""}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        onSelectCustomer={selectCustomer}
        onCustomerAdded={(newCust) => setCustomers(prev => [...prev, newCust])}
      />

      <BuyCouponModal
        isOpen={isBuyCouponOpen}
        onClose={() => setIsBuyCouponOpen(false)}
        customers={customers}
        onCouponIssued={(name) => {
          // Refresh customer coupons after issuing
          fetchApi("getCustomerCoupons").then(data => {
            setCustomerCoupons(Array.isArray(data) ? data : []);
          });
        }}
      />

      <PurchasePackageModal
        isOpen={isPurchasePkgOpen}
        onClose={() => setIsPurchasePkgOpen(false)}
        customers={customers}
        onAddToCart={handlePackageAdd}
      />
    </div>
  );
}

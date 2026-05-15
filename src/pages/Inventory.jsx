import { useState, useEffect, useMemo } from "react";
import { Search, Plus, MapPin, PackagePlus, Calendar, Loader2, Camera, X, Pencil, Save, MoveRight, Store, ArrowRightLeft, Eye, Download, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, ClipboardList, ChevronDown, ChevronUp, ExternalLink, FileImage, RefreshCw } from "lucide-react";
import clsx from "clsx";
import BarcodeScanner from "../components/BarcodeScanner";
import { fetchApi, postApi } from "../api";
import { exportToExcel } from "../utils/excelExport";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";

export default function Inventory() {
  const { currentUser } = useAuth();
  const canEdit = currentUser?.role !== "staff"; // staff = view only
  const [activeTab, setActiveTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [productNameInput, setProductNameInput] = useState("");
  
  // New Receive Goods multi-item states
  const [receiveCart, setReceiveCart] = useState([]);
  const [companyNameStr, setCompanyNameStr] = useState("");
  const [orderNumberStr, setOrderNumberStr] = useState("");
  const [receiveQtyStr, setReceiveQtyStr] = useState("");
  const [receiveLocationStr, setReceiveLocationStr] = useState("");
  const [receiveExpiryStr, setReceiveExpiryStr] = useState("");
  const [receiveUnitCostStr, setReceiveUnitCostStr] = useState("");
  const [receiveRequiresExpiry, setReceiveRequiresExpiry] = useState(true);
  const [poFile, setPoFile] = useState(null); // PO Document file
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreviewItems, setImportPreviewItems] = useState([]);
  const [receiveHistory, setReceiveHistory] = useState([]);
  const [expandedHistoryPO, setExpandedHistoryPO] = useState(null);
  const [viewDocPO, setViewDocPO] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [packMultiplierDetected, setPackMultiplierDetected] = useState(1);
  const [packLabelDetected, setPackLabelDetected] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [products, setProducts] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [storeStock, setStoreStock] = useState([]);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveSource, setMoveSource] = useState(null); // product to move
  const [moveQty, setMoveQty] = useState("");
  const [moveLocation, setMoveLocation] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [editStoreItem, setEditStoreItem] = useState(null);
  const [isEditStoreSaving, setIsEditStoreSaving] = useState(false);

  // Supplier states
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: "", contactPerson: "", phone: "", email: "", address: "", taxId: ""
  });

  // New Product Modal states
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const PAYMENT_METHODS = ["เงินสด", "โอนเข้าบัญชี", "สแกน QR", "บัตรเครดิต", "เครดิต", "พ้อย"];
  const PAYMENT_METHOD_GROUPS = [
    { label: "ทั่วไป", methods: ["เงินสด", "โอนเข้าบัญชี", "สแกน QR", "บัตรเครดิต"] },
    { label: "เครดิต/พ้อย", methods: ["เครดิต", "พ้อย"] },
  ];
  const PAYMENT_METHOD_STYLE = {
    "เงินสด":        "bg-amber-100 text-amber-800 border-amber-300",
    "โอนเข้าบัญชี": "bg-blue-100 text-blue-800 border-blue-300",
    "สแกน QR":       "bg-sky-100 text-sky-800 border-sky-300",
    "บัตรเครดิต":   "bg-purple-100 text-purple-800 border-purple-300",
    "เครดิต":        "bg-yellow-100 text-yellow-800 border-yellow-300",
    "พ้อย":          "bg-orange-100 text-orange-800 border-orange-300",
  };
  const PAYMENT_METHOD_STYLE_OFF = "bg-gray-50 text-gray-400 border-gray-200";

  const [newProductData, setNewProductData] = useState({
    barcode: "",
    name: "",
    vatStatus: "VAT",
    costPrice: "",
    price: "",
    wholesalePrice: "",
    shopeePrice: "",
    lazadaPrice: "",
    linemanPrice: "",
    category: "ทั่วไป",
    lowStockThreshold: 5,
    packBarcode: "",
    packMultiplier: "",
    packBarcode2: "",
    packMultiplier2: "",
    packBarcode3: "",
    packMultiplier3: "",
    hasExpiry: "YES",
    acceptedPayments: ["เงินสด", "โอนเข้าบัญชี", "สแกน QR", "บัตรเครดิต", "เครดิต", "พ้อย"]
  });

  const fetchProducts = () => {
    setIsLoading(true);
    fetchApi("getProducts").then(data => {
      setProducts(Array.isArray(data) ? data : []);
      setIsLoading(false);
    });
  };

  const fetchStoreStock = () => {
    setIsStoreLoading(true);
    fetchApi("getStoreStock").then(data => {
      setStoreStock(Array.isArray(data) ? data : []);
      setIsStoreLoading(false);
    });
  };

  const fetchSuppliers = () => {
    fetchApi("getSuppliers").then(data => {
      setSuppliers(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (activeTab === "stock") fetchProducts();
    if (activeTab === "store") fetchStoreStock();
    if (activeTab === "receive") { fetchProducts(); fetchSuppliers(); }
    if (activeTab === "history") fetchReceiveHistory();
  }, [activeTab]);

  // Unique locations from products for dropdown (always strings)
  const uniqueLocations = useMemo(() =>
    [...new Set(products.map(p => p.Location).filter(Boolean).map(String))].sort()
  , [products]);

  const selectSupplier = (s) => {
    setCompanyNameStr(s.Name || "");
    setSupplierSearch(s.Name || "");
    setSupplierPhone(s.Phone || "");
    setSupplierEmail(s.Email || "");
    setSupplierTaxId(s.TaxID || "");
    setSelectedSupplier(s);
    setShowSupplierDropdown(false);
  };

  const clearSupplier = () => {
    setCompanyNameStr("");
    setSupplierSearch("");
    setSupplierPhone("");
    setSupplierEmail("");
    setSupplierTaxId("");
    setSelectedSupplier(null);
  };

  const handleSaveNewSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) {
      alert("กรุณาระบุชื่อบริษัท/ผู้จำหน่าย");
      return;
    }
    setIsSavingSupplier(true);
    const res = await postApi({
      action: "saveSupplier",
      payload: { ...newSupplierData }
    });
    setIsSavingSupplier(false);
    if (res.success) {
      // Auto-select the newly created supplier
      const created = {
        Name: newSupplierData.name,
        Phone: newSupplierData.phone,
        Email: newSupplierData.email,
        TaxID: newSupplierData.taxId,
        Address: newSupplierData.address,
        ContactPerson: newSupplierData.contactPerson
      };
      selectSupplier(created);
      fetchSuppliers();
      setNewSupplierData({ name: "", contactPerson: "", phone: "", email: "", address: "", taxId: "" });
      setIsAddSupplierModalOpen(false);
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const filteredStock = products.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      String(item.Name || "").toLowerCase().includes(q) ||
      String(item.Barcode || "").includes(searchQuery) ||
      String(item.Location || "").toLowerCase().includes(q)
    );
  });

  const fetchReceiveHistory = async () => {
    setIsLoadingHistory(true);
    const data = await fetchApi("getReceiveGoods");
    setReceiveHistory(Array.isArray(data) ? [...data].reverse() : []);
    setIsLoadingHistory(false);
  };

  const getPOItems = (po) => {
    const raw = po.Items || po.items || po.CartDetails || [];
    if (Array.isArray(raw)) return raw;
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const openDocument = (po) => {
    if (!po.FileData) return;
    const ext = (po.FileName || "").split(".").pop().toLowerCase();
    const mimeMap = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext] || "application/octet-stream";
    try {
      const byteChars = atob(po.FileData);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch { alert("ไม่สามารถเปิดเอกสารได้"); }
  };

  const handleAddReceiveItem = (e) => {
    e.preventDefault();
    if (!productNameInput || !receiveQtyStr || !receiveLocationStr || !orderNumberStr) {
      alert("กรุณากรอกข้อมูลบังคับให้ครบ (เลขที่ออเดอร์, ชื่อสินค้า, จำนวน, โลเคชั่น)");
      return;
    }
    if (receiveRequiresExpiry && !receiveExpiryStr) {
      alert("กรุณากรอกวันหมดอายุสำหรับสินค้านี้");
      return;
    }
    
    // VALIDATION: Check if product exists (direct barcode or pack barcode)
    const barcodeVal = String(barcodeInput).trim();
    const productExists = products.find(p =>
      String(p.Barcode) === barcodeVal ||
      (p.PackBarcode && String(p.PackBarcode) === barcodeVal) ||
      (p.PackBarcode2 && String(p.PackBarcode2) === barcodeVal) ||
      (p.PackBarcode3 && String(p.PackBarcode3) === barcodeVal)
    );
    if (!productExists) {
      alert(`ไม่พบสินค้าบาร์โค้ด "${barcodeInput}" ในระบบ กรุณาไปที่แท็บ "รายการสต็อกสินค้า" เพื่อเพิ่มสินค้าใหม่ก่อนนำเข้าคลัง`);
      return;
    }
    const actualQty = Number(receiveQtyStr) * packMultiplierDetected;
    const newItem = {
      id: Date.now().toString(),
      barcode: String(productExists.Barcode), // always store actual product barcode
      productName: productNameInput,
      quantity: String(actualQty),
      packLabel: packLabelDetected ? `${packLabelDetected} ×${packMultiplierDetected}` : "",
      unitCost: receiveUnitCostStr,
      vatStatus: "VAT",
      category: "ทั่วไป",
      location: receiveLocationStr,
      lotNumber: orderNumberStr,
      expiryDate: receiveExpiryStr,
      receivingDate: new Date().toISOString().split('T')[0]
    };
    setReceiveCart([...receiveCart, newItem]);

    // Reset specific fields for next item
    setBarcodeInput("");
    setProductNameInput("");
    setReceiveQtyStr("");
    setReceiveExpiryStr("");
    setReceiveLocationStr("");
    setReceiveUnitCostStr("");
    setPackMultiplierDetected(1);
    setPackLabelDetected("");
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductData.barcode || !newProductData.name) {
      alert("กรุณากรอกบาร์โค้ดและชื่อสินค้า");
      return;
    }
    setIsAddingProduct(true);
    const res = await postApi({
      action: "addProduct",
      payload: {
        ...newProductData,
        acceptedPayments: (newProductData.acceptedPayments || []).join(","),
        packBarcode2: newProductData.packBarcode2 || "",
        packMultiplier2: newProductData.packMultiplier2 || "",
        packBarcode3: newProductData.packBarcode3 || "",
        packMultiplier3: newProductData.packMultiplier3 || "",
        _actor: currentUser
      }
    });
    setIsAddingProduct(false);

    if (res.success) {
      alert(res.message);
      setIsAddProductModalOpen(false);
      setNewProductData({
        barcode: "", name: "", vatStatus: "VAT", costPrice: "", price: "",
        wholesalePrice: "", shopeePrice: "", lazadaPrice: "", linemanPrice: "",
        category: "ทั่วไป", lowStockThreshold: 5,
        packBarcode: "", packMultiplier: "", packBarcode2: "", packMultiplier2: "", packBarcode3: "", packMultiplier3: "",
        hasExpiry: "YES", acceptedPayments: ["เงินสด", "โอนเข้าบัญชี", "สแกน QR", "บัตรเครดิต", "เครดิต"]
      });
      fetchProducts();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleRemoveReceiveItem = (id) => {
    setReceiveCart(receiveCart.filter(item => item.id !== id));
  };

  const downloadReceiveTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instructions = [
      ["แบบฟอร์มนำเข้ารายการสินค้าเข้าคลัง (Receive Goods Template)"],
      [""],
      ["คำแนะนำการกรอกข้อมูล:"],
      ["- บาร์โค้ด *: กรอกบาร์โค้ดสินค้าที่มีในระบบ (บังคับ)"],
      ["- จำนวน *: ตัวเลขจำนวนชิ้นที่รับเข้า (บังคับ)"],
      ["- โลเคชั่นคลัง *: ตำแหน่งจัดเก็บ เช่น คลังหลัง A1 (บังคับ)"],
      ["- ต้นทุน/ชิ้น: ราคาต้นทุนต่อชิ้น (ถ้าไม่กรอกจะใช้ค่าเดิมในระบบ)"],
      ["- วันหมดอายุ: รูปแบบ YYYY-MM-DD เช่น 2026-12-31 (สำหรับสินค้าที่มี EXP)"],
      [""],
      ["⚠️  กรอกข้อมูลในชีต 'ข้อมูลสินค้า' เท่านั้น อย่าลบแถวหัวตาราง"],
    ];
    const wsInst = XLSX.utils.aoa_to_sheet(instructions);
    wsInst["!cols"] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInst, "คำแนะนำ");
    const headers = ["บาร์โค้ด *", "ชื่อสินค้า (อ้างอิงเท่านั้น)", "จำนวน *", "ต้นทุน/ชิ้น (บาท)", "โลเคชั่นคลัง *", "วันหมดอายุ (YYYY-MM-DD)"];
    const sample = [["8850999999999", "ตัวอย่าง: Royal Canin Mini Adult 1kg", 10, 250, "คลังหลัง A1", "2027-06-30"]];
    const wsData = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    wsData["!cols"] = [{ wch: 22 }, { wch: 38 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, wsData, "ข้อมูลสินค้า");
    XLSX.writeFile(wb, "receive_goods_template.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "array" });
      const ws = wb.Sheets["ข้อมูลสินค้า"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const packDefs = [
        { bKey: "PackBarcode",  mKey: "PackMultiplier",  label: "แพ็ค 1" },
        { bKey: "PackBarcode2", mKey: "PackMultiplier2", label: "แพ็ค 2" },
        { bKey: "PackBarcode3", mKey: "PackMultiplier3", label: "แพ็ค 3" },
      ];
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const barcode = String(row[0] || "").trim();
        if (!barcode) continue;
        // Try direct match first, then pack barcodes
        let product = products.find(p => String(p.Barcode) === barcode);
        let multiplier = 1;
        let packLabel = "";
        if (!product) {
          for (const { bKey, mKey, label } of packDefs) {
            const pm = products.find(p => p[bKey] && String(p[bKey]) === barcode);
            if (pm) { product = pm; multiplier = Number(pm[mKey]) || 1; packLabel = label; break; }
          }
        }
        const inputQty = Number(row[2] || 0);
        const actualQty = inputQty * multiplier;
        items.push({
          id: `imp_${Date.now()}_${i}`,
          barcode: product ? String(product.Barcode) : barcode,
          productName: product ? product.Name : (String(row[1] || "").trim() || "ไม่พบในระบบ"),
          quantity: actualQty > 0 ? String(actualQty) : String(inputQty),
          packLabel: packLabel ? `${packLabel} ×${multiplier}` : "",
          unitCost: String(row[3] || (product?.CostPrice || "")),
          location: String(row[4] || (product?.Location || "")),
          expiryDate: String(row[5] || ""),
          lotNumber: orderNumberStr,
          receivingDate: new Date().toISOString().split("T")[0],
          found: !!product,
          requiresExpiry: product ? product.HasExpiry !== "NO" : true,
        });
      }
      setImportPreviewItems(items);
      setShowImportModal(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    const valid = importPreviewItems.filter(item => item.found && item.quantity);
    setReceiveCart(prev => [...prev, ...valid]);
    setShowImportModal(false);
    setImportPreviewItems([]);
  };

  const handlePoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPoFile({
          fileName: file.name,
          base64: reader.result
        });
      };
      reader.readAsDataURL(file);
    } else {
      setPoFile(null);
    }
  };

  const handleReceiveGoods = async (e) => {
    e.preventDefault();
    if (receiveCart.length === 0) {
      alert("กรุณาเพิ่มสินค้าลงในรายการก่อน");
      return;
    }
    setIsSubmitting(true);
    
    const payload = {
      action: "receiveGoods",
      payload: {
        companyName: companyNameStr,
        orderNumber: orderNumberStr,
        supplierPhone,
        supplierEmail,
        supplierTaxId,
        items: receiveCart,
        fileName: poFile ? poFile.fileName : "",
        fileData: poFile ? poFile.base64 : ""
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert("บันทึกสินค้านำเข้าลงคลังเรียบร้อยแล้ว!");
      setReceiveCart([]);
      setCompanyNameStr("");
      setOrderNumberStr("");
      setSupplierSearch("");
      setSupplierPhone("");
      setSupplierEmail("");
      setSupplierTaxId("");
      setSelectedSupplier(null);
      setPoFile(null);
      fetchProducts();
      setActiveTab("stock");
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (res.error || "Unknown"));
    }
  };

  const handleScanSuccess = (text) => {
    setIsScannerOpen(false);
    if (activeTab === "stock") {
      setSearchQuery(text);
    } else {
      setBarcodeInput(text);
      // Auto-fill product name, cost, and warehouse location if barcode matches
      const match = products.find(p => String(p.Barcode) === String(text).trim());
      if (match) {
        setProductNameInput(match.Name);
        setReceiveUnitCostStr(String(match.CostPrice || ""));
        setReceiveLocationStr(String(match.Location || ""));
      }
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setIsEditSaving(true);
    const res = await postApi({
      action: "updateProduct",
      payload: {
        barcode: editItem.Barcode,
        name: editItem.Name,
        vatStatus: editItem.VatStatus,
        costPrice: editItem.CostPrice,
        price: editItem.Price,
        wholesalePrice: editItem.WholesalePrice,
        shopeePrice: editItem.ShopeePrice,
        lazadaPrice: editItem.LazadaPrice,
        linemanPrice: editItem.LinemanPrice,
        category: editItem.Category,
        location: editItem.Location,
        expiryDate: editItem.ExpiryDate || "",
        lowStockThreshold: editItem.LowStockThreshold || 5,
        packBarcode: editItem.PackBarcode || "",
        packMultiplier: editItem.PackMultiplier || "",
        packBarcode2: editItem.PackBarcode2 || "",
        packMultiplier2: editItem.PackMultiplier2 || "",
        packBarcode3: editItem.PackBarcode3 || "",
        packMultiplier3: editItem.PackMultiplier3 || "",
        hasExpiry: editItem.HasExpiry || "YES",
        acceptedPayments: Array.isArray(editItem.AcceptedPayments)
          ? editItem.AcceptedPayments.join(",")
          : String(editItem.AcceptedPayments || "")
      }
    });
    setIsEditSaving(false);
    if (res.success) {
      alert("อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว!");
      setEditItem(null);
      fetchProducts();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleUpdateStoreStock = async (e) => {
    e.preventDefault();
    setIsEditStoreSaving(true);
    const res = await postApi({
      action: "updateStoreStockDetail",
      payload: {
        barcode: editStoreItem.Barcode,
        storeLocation: editStoreItem.StoreLocation,
        lowStockThreshold: editStoreItem.LowStockThreshold || 3
      }
    });
    setIsEditStoreSaving(false);
    if (res.success) {
      alert("อัปเดตข้อมูลหน่วยหน้าร้านเรียบร้อยแล้ว!");
      setEditStoreItem(null);
      fetchStoreStock();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleMoveToStore = async (e) => {
    e.preventDefault();
    if (!moveSource) return;
    setIsMoving(true);
    const res = await postApi({
      action: "moveToStore",
      payload: {
        barcode: moveSource.Barcode,
        name: moveSource.Name,
        quantity: moveQty,
        storeLocation: moveLocation
      }
    });
    setIsMoving(false);
    if (res.success) {
      alert("ย้ายสินค้าเข้าหน้าร้านเรียบร้อยแล้ว!");
      setIsMoveModalOpen(false);
      setMoveSource(null); setMoveQty(""); setMoveLocation("");
      fetchProducts();
      if (activeTab === "store") fetchStoreStock();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleExportExcel = () => {
    if (activeTab === "stock") {
      const exportData = filteredStock.map(p => ({
        "หมวดหมู่": p.Category || "ทั่วไป",
        "บาร์โค้ด": p.Barcode,
        "ชื่อสินค้า": p.Name,
        "สถานะภาษี": p.VatStatus || "VAT",
        "ต้นทุน (ทุน)": p.CostPrice || 0,
        "ราคาขายปลีก": p.Price || 0,
        "ราคาขายส่ง": p.WholesalePrice || 0,
        "Shopee": p.ShopeePrice || 0,
        "Lazada": p.LazadaPrice || 0,
        "LineMan/Grab": p.LinemanPrice || p.GrabFoodPrice || 0,
        "จำนวนคงเหลือ": p.Quantity || 0,
        "ตำแหน่งจัดเก็บ": p.Location || "-",
        "วันหมดอายุ": p.ExpiryDate || "-",
        "วิธีชำระที่รับได้": p.AcceptedPayments || "ทั้งหมด"
      }));
      exportToExcel(exportData, "MasterStock", "Master_Stock_Inventory");
    } else if (activeTab === "store") {
      const exportData = storeStock.filter(item => {
        const q = searchQuery.toLowerCase();
        return (
          String(item.Name || "").toLowerCase().includes(q) ||
          String(item.Barcode || "").includes(searchQuery) ||
          String(item.StoreLocation || "").toLowerCase().includes(q)
        );
      }).map(m => ({
        "บาร์โค้ด": m.Barcode,
        "ชื่อสินค้า": m.Name,
        "จำนวนหน้าร้าน": m.Quantity || 0,
        "ที่อยู่เวที": m.StoreLocation || "หน้าร้านทั่วไป",
        "อัปเดตล่าสุด": m.UpdatedAt ? new Date(m.UpdatedAt).toLocaleString("th-TH") : "-"
      }));
      exportToExcel(exportData, "StoreStock", "Store_Stock_Inventory");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">

      {/* Full-screen Camera Scanner (same as POS) */}
      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">การจัดการคลังสินค้า</h2>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("stock")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "stock" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            รายการสต็อกสินค้า (Real-time)
          </button>
          <button 
            onClick={() => setActiveTab("receive")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "receive" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
            disabled={!canEdit}
            title={!canEdit ? "ไม่มีสิทธิ์เข้าถึง" : undefined}
            style={!canEdit ? { display: "none" } : {}}
          >
            ใบรับของเข้าคลัง (Receive Goods)
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5",
              activeTab === "history" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
            disabled={!canEdit}
            style={!canEdit ? { display: "none" } : {}}
          >
            <ClipboardList size={15} />
            รายงานรับเข้า
          </button>
        </div>
        
        {activeTab === "stock" && (
          <button 
            onClick={handleExportExcel} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 font-medium text-sm w-full sm:w-auto"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>
        )}
      </div>

      {activeTab === "stock" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                  placeholder="ค้นหาสินค้า, โลเคชั่น หรือสแกนบาร์โค้ด..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                type="button"
                onClick={() => setIsScannerOpen(!isScannerOpen)}
                className="p-2.5 bg-white hover:bg-gray-100 text-gray-700 rounded-xl transition-colors shadow-sm border border-gray-200 shrink-0"
                title="เปิดกล้องสแกนเพื่อค้นหา"
              >
                {isScannerOpen ? <X size={20} /> : <Camera size={20} />}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 font-medium text-sm shrink-0"
                >
                  <Plus size={18} />
                  <span>เพิ่มสินค้าใหม่</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">ข้อมูลสินค้า</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap">ราคาทั้งหมด</th>
                  <th className="py-3 px-6">เลข Lot</th>
                  <th className="py-3 px-6">ตำแหน่งจัดเก็บ</th>
                  <th className="py-3 px-6">วันหมดอายุ</th>
                  <th className="py-3 px-6 text-right">จำนวนคลัง</th>
                  <th className="py-3 px-6 text-center">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan="7" className="py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td></tr>
                ) : filteredStock.length === 0 ? (
                  <tr><td colSpan="7" className="py-8 text-center text-gray-500">ไม่พบรายการสินค้า</td></tr>
                ) : filteredStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors bg-white">
                    <td className="py-4 px-6 text-sm">
                      <div className="font-semibold text-gray-900">{item.Name}</div>
                      {item.Barcode && <div className="text-xs text-gray-500 mt-1 font-mono">BC: {item.Barcode}</div>}
                      <div className="text-[10px] text-gray-400 mt-1 uppercase">
                         {item.Category || "ทั่วไป"} • {item.VatStatus || "VAT"}
                      </div>
                      {item.AcceptedPayments && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {String(item.AcceptedPayments).split(",").filter(Boolean).map(pm => (
                            <span key={pm} className={clsx("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold", PAYMENT_METHOD_STYLE[pm.trim()] || "bg-gray-100 text-gray-600 border-gray-200")}>{pm.trim()}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-right whitespace-nowrap">
                      <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs items-center justify-end">
                         <span className="text-gray-500">ต้นทุน:</span> <span className="font-semibold text-gray-700">{(parseFloat(item.CostPrice) || 0) > 0 ? `฿${parseFloat(item.CostPrice).toLocaleString()}` : "-"}</span>
                         <span className="text-gray-500">ราคาปลีก:</span> <span className="font-bold text-amber-600">{(parseFloat(item.Price) || 0) > 0 ? `฿${parseFloat(item.Price).toLocaleString()}` : "-"}</span>
                         <span className="text-gray-500">ราคาส่ง:</span> <span className="font-medium text-blue-600">{(parseFloat(item.WholesalePrice) || 0) > 0 ? `฿${parseFloat(item.WholesalePrice).toLocaleString()}` : "-"}</span>
                         <span className="text-gray-500">Shopee:</span> <span className="font-medium text-orange-500">{(parseFloat(item.ShopeePrice) || 0) > 0 ? `฿${parseFloat(item.ShopeePrice).toLocaleString()}` : "-"}</span>
                         <span className="text-gray-500">Lazada:</span> <span className="font-medium text-blue-500">{(parseFloat(item.LazadaPrice) || 0) > 0 ? `฿${parseFloat(item.LazadaPrice).toLocaleString()}` : "-"}</span>
                         <span className="text-gray-500">Lineman:</span> <span className="font-medium text-green-500">{(parseFloat(item.LinemanPrice) || 0) > 0 ? `฿${parseFloat(item.LinemanPrice).toLocaleString()}` : "-"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{item.LotNumber || "-"}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 align-middle">
                        <MapPin size={14} className="text-primary" />
                        <span className="font-medium">{item.Location || "-"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 align-middle">
                        <Calendar size={14} className="text-amber-500" />
                        <span className={clsx(
                          item.ExpiryDate && new Date(item.ExpiryDate) < new Date() ? "text-red-600 font-bold" : ""
                        )}>{item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString("th-TH", { year: 'numeric', month: '2-digit', day: '2-digit' }) : "-"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={clsx(
                        "font-bold text-lg",
                        parseFloat(item.Quantity) <= (parseFloat(item.LowStockThreshold) || 5) ? "text-red-600" : "text-primary"
                      )}>
                        {item.Quantity || 0}
                      </span>
                      {parseFloat(item.Quantity) <= (parseFloat(item.LowStockThreshold) || 5) && (
                        <div className="text-xs text-red-500 font-medium">ใกล้หมด!</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => setEditItem({ ...item })}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="แก้ไขสินค้า"
                            >
                              <Pencil size={16} />
                            </button>
                          </>
                        )}
                        {!canEdit && (
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Eye size={14} /> ดูเท่านั้น</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== STORE STOCK TAB ===== */}
      {activeTab === "store" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700">
              <Store size={18} />
              <span className="font-semibold">สินค้าหน้าร้าน (StoreStock)</span>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{storeStock.length} รายการ</span>
            </div>
            {canEdit && (
              <button
                onClick={() => { setMoveSource(null); setMoveQty("1"); setMoveLocation(""); setIsMoveModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <ArrowRightLeft size={16} /> ย้ายสินค้าเข้าหน้าร้าน
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-emerald-50 sticky top-0 z-10">
                <tr className="border-b border-emerald-100 text-sm font-medium text-emerald-700">
                  <th className="py-3 px-6">ข้อมูลสินค้า</th>
                  <th className="py-3 px-6">ตำแหน่งหน้าร้าน</th>
                  <th className="py-3 px-6">อัปเดตล่าสุด</th>
                  <th className="py-3 px-6 text-right">จำนวนหน้าร้าน</th>
                  <th className="py-3 px-6 text-center">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isStoreLoading ? (
                  <tr><td colSpan="4" className="py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td></tr>
                ) : storeStock.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-gray-500">ยังไม่มีสินค้าในหน้าร้าน ลองย้ายสินค้าจากคลังก่อน</td></tr>
                ) : storeStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-4 px-6 text-sm">
                      <div className="font-semibold text-gray-900">{item.Name}</div>
                      {item.Barcode && <div className="text-xs text-gray-500 mt-1">Barcode: {item.Barcode}</div>}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-emerald-500" />
                        <span className="font-medium">{item.StoreLocation || "-"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {item.UpdatedAt ? new Date(item.UpdatedAt).toLocaleString("th-TH") : "-"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={clsx(
                        "font-bold text-lg",
                        parseFloat(item.Quantity) <= (parseFloat(item.LowStockThreshold) || 3) ? "text-red-600" : "text-emerald-600"
                      )}>
                        {item.Quantity || 0}
                      </span>
                      {parseFloat(item.Quantity) <= (parseFloat(item.LowStockThreshold) || 3) && (
                        <div className="text-xs text-red-500 font-medium">ใกล้หมด!</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => setEditStoreItem({ ...item })}
                        className="p-2 text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                        title="แก้ไขการตั้งค่าหน้าร้าน"
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "receive" && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Side: Inputs */}
          <div className="w-full lg:w-1/2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <PackagePlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">รับสินค้าเข้าคลัง (หลายรายการ)</h3>
                <p className="text-sm text-gray-500">บันทึกข้อมูลบริษัทและรายการสินค้า</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                {/* Supplier Search */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      บริษัทที่นำเข้า *
                      {selectedSupplier && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">บันทึกในระบบ</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setNewSupplierData({ name: supplierSearch, contactPerson: "", phone: "", email: "", address: "", taxId: "" }); setIsAddSupplierModalOpen(true); }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> เพิ่มผู้จำหน่ายใหม่
                    </button>
                  </label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={e => { setSupplierSearch(e.target.value); setCompanyNameStr(e.target.value); setShowSupplierDropdown(true); setSelectedSupplier(null); }}
                        onFocus={() => setShowSupplierDropdown(true)}
                        onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                        placeholder="ค้นหาหรือพิมพ์ชื่อบริษัท..."
                      />
                      {(companyNameStr || selectedSupplier) && (
                        <button type="button" onClick={clearSupplier} className="px-3 py-2 text-gray-400 hover:text-red-500 border border-gray-200 rounded-xl transition-colors">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {showSupplierDropdown && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {suppliers
                          .filter(s => String(s.Name || "").toLowerCase().includes(supplierSearch.toLowerCase()))
                          .map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={() => selectSupplier(s)}
                              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 flex flex-col border-b border-gray-50 last:border-0 transition-colors"
                            >
                              <span className="font-semibold text-gray-900 text-sm">{s.Name}</span>
                              <span className="text-xs text-gray-400">
                                {s.Phone && `โทร: ${s.Phone}`}{s.Phone && s.TaxID && " | "}{s.TaxID && `TAX: ${s.TaxID}`}
                              </span>
                            </button>
                          ))}
                        {suppliers.filter(s => String(s.Name || "").toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-400 text-center">ไม่พบ — จะบันทึกเป็นรายการใหม่อัตโนมัติ</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extra supplier info */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">เบอร์โทร Supplier</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                    placeholder="เช่น 02-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">เลขภาษี Supplier</label>
                  <input
                    type="text"
                    value={supplierTaxId}
                    onChange={e => setSupplierTaxId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                    placeholder="เลขผู้เสียภาษี"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่ออเดอร์ *</label>
                  <input
                    type="text"
                    value={orderNumberStr}
                    onChange={(e) => setOrderNumberStr(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                    placeholder="เช่น PO-2023001"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">แนบเอกสารใบสั่งซื้อ (PO) *</label>
                  <input 
                    type="file" 
                    accept="image/*,.pdf"
                    onChange={handlePoFileChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Import / Download bar */}
            <div className={clsx(
              "flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl border",
              (!companyNameStr || !orderNumberStr) ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"
            )}>
              <button type="button" onClick={downloadReceiveTemplate}
                className="flex items-center gap-1.5 text-xs bg-white text-emerald-700 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 font-semibold transition-colors shadow-sm shrink-0">
                <FileSpreadsheet size={14} /> ดาวน์โหลดแบบฟอร์ม Excel
              </button>
              <label className={clsx(
                "flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-semibold transition-colors shrink-0",
                (!companyNameStr || !orderNumberStr)
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-blue-700 hover:bg-blue-100 border-blue-200 cursor-pointer shadow-sm"
              )}>
                <Upload size={14} /> นำเข้าจาก Excel
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  disabled={!companyNameStr || !orderNumberStr}
                  onChange={handleImportExcel} />
              </label>
              {(!companyNameStr || !orderNumberStr) && (
                <span className="text-xs text-amber-700 flex items-center gap-1 font-medium">
                  <AlertTriangle size={12} />
                  กรอกบริษัทและเลขออเดอร์ก่อนจึงจะนำเข้าได้
                </span>
              )}
            </div>

            <form className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100" onSubmit={handleAddReceiveItem}>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-2">ฟอร์มเพิ่มรายการสินค้า (ทีละรายการ)</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">สแกนบาร์โค้ด</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                      placeholder="สแกน หรือพิมพ์บาร์โค้ด..."
                      value={barcodeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBarcodeInput(val);
                        const b = val.trim();
                        // 1. Try direct barcode match
                        const directMatch = products.find(p => String(p.Barcode) === b);
                        if (directMatch) {
                          setProductNameInput(directMatch.Name);
                          setReceiveUnitCostStr(String(directMatch.CostPrice || ""));
                          setReceiveLocationStr(String(directMatch.Location || ""));
                          setReceiveRequiresExpiry(directMatch.HasExpiry !== "NO");
                          setPackMultiplierDetected(1);
                          setPackLabelDetected("");
                          return;
                        }
                        // 2. Try pack barcodes (1, 2, 3)
                        const packDefs = [
                          { bKey: "PackBarcode",  mKey: "PackMultiplier",  label: "แพ็ค 1" },
                          { bKey: "PackBarcode2", mKey: "PackMultiplier2", label: "แพ็ค 2" },
                          { bKey: "PackBarcode3", mKey: "PackMultiplier3", label: "แพ็ค 3" },
                        ];
                        for (const { bKey, mKey, label } of packDefs) {
                          const packMatch = products.find(p => p[bKey] && String(p[bKey]) === b);
                          if (packMatch) {
                            setProductNameInput(packMatch.Name);
                            setReceiveUnitCostStr(String(packMatch.CostPrice || ""));
                            setReceiveLocationStr(String(packMatch.Location || ""));
                            setReceiveRequiresExpiry(packMatch.HasExpiry !== "NO");
                            setPackMultiplierDetected(Number(packMatch[mKey]) || 1);
                            setPackLabelDetected(label);
                            return;
                          }
                        }
                        // 3. No match
                        setProductNameInput("");
                        setReceiveUnitCostStr("");
                        setReceiveLocationStr("");
                        setReceiveRequiresExpiry(true);
                        setPackMultiplierDetected(1);
                        setPackLabelDetected("");
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(!isScannerOpen)}
                      className="p-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl transition-colors shadow-sm shrink-0"
                    >
                      {isScannerOpen ? <X size={20} /> : <Camera size={20} />}
                    </button>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า (อ้างอิงจากบาร์โค้ด) *</label>
                  <input
                    type="text"
                    required
                    readOnly
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none text-sm"
                    placeholder="สแกนบาร์โค้ดเพื่อดึงชื่อสินค้าอัตโนมัติ..."
                    value={productNameInput}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    {packLabelDetected ? `จำนวนแพ็ค (${packLabelDetected}) *` : "จำนวน *"}
                    {packLabelDetected && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                        ×{packMultiplierDetected} ชิ้น/แพ็ค
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    required min="1"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder={packLabelDetected ? "จำนวนแพ็ค" : "0"}
                    value={receiveQtyStr}
                    onChange={(e) => setReceiveQtyStr(e.target.value)}
                  />
                  {packLabelDetected && receiveQtyStr && Number(receiveQtyStr) > 0 && (
                    <p className="text-xs text-purple-700 mt-1 font-semibold flex items-center gap-1">
                      = {Number(receiveQtyStr) * packMultiplierDetected} ชิ้น (รับเข้าระบบ)
                    </p>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    โลเคชั่นคลัง *
                    {receiveLocationStr && productNameInput && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold">ดึงอัตโนมัติ</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder="เช่น คลังหลัง A1 หรือเลือกจากรายการ"
                    value={receiveLocationStr}
                    onChange={(e) => { setReceiveLocationStr(e.target.value); setShowLocationDropdown(true); }}
                    onFocus={() => setShowLocationDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                  />
                  {showLocationDropdown && uniqueLocations.filter(l =>
                    !receiveLocationStr || String(l).toLowerCase().includes(String(receiveLocationStr).toLowerCase())
                  ).length > 0 && (
                    <div
                      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {uniqueLocations
                        .filter(l => !receiveLocationStr || String(l).toLowerCase().includes(String(receiveLocationStr).toLowerCase()))
                        .map((loc, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setReceiveLocationStr(String(loc)); setShowLocationDropdown(false); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-primary/5 text-sm text-gray-800 border-b border-gray-50 last:border-0 transition-colors flex items-center gap-2"
                          >
                            <MapPin size={13} className="text-gray-400 shrink-0" />
                            {loc}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {receiveRequiresExpiry && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ *</label>
                    <input
                      type="date"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                      value={receiveExpiryStr}
                      onChange={(e) => setReceiveExpiryStr(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุน/ชิ้น (บาท)</label>
                  <input
                    type="number"
                    min="0" step="0.01"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder="0.00"
                    value={receiveUnitCostStr}
                    onChange={(e) => setReceiveUnitCostStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!companyNameStr || !orderNumberStr}
                  className={clsx(
                    "w-full py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border",
                    (!companyNameStr || !orderNumberStr)
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-200"
                  )}
                >
                  <Plus size={18} /> เพิ่มลงรายการนำเข้า
                </button>
                {(!companyNameStr || !orderNumberStr) && (
                  <p className="text-xs text-center text-amber-600 mt-1.5 flex items-center justify-center gap-1">
                    <AlertTriangle size={11} /> กรอกชื่อบริษัทและเลขที่ออเดอร์ก่อน
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Right Side: Cart */}
          <div className="w-full lg:w-1/2 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-800">รายการรอรับเข้า</h3>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                {receiveCart.length} รายการ
              </span>
            </div>

            <div className="flex-1 overflow-auto p-4 max-h-[500px]">
              {receiveCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-12">
                  <PackagePlus size={48} className="opacity-20" />
                  <p>ยังไม่มีสินค้าที่จะนำเข้า</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receiveCart.map((item, idx) => (
                    <div key={item.id} className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-gray-900 text-sm">{idx+1}. {item.productName}</h4>
                          <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border shadow-sm">
                            {item.quantity} ชิ้น
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <div><span className="text-gray-400">Barcode:</span> {item.barcode || "-"}</div>
                          <div><span className="text-gray-400">ตู้/คลัง:</span> {item.location}</div>
                          <div><span className="text-gray-400">Lot:</span> {item.lotNumber || "-"}</div>
                          <div><span className="text-gray-400">EXP:</span> {item.expiryDate || "-"}</div>
                          <div><span className="text-gray-400">ต้นทุน/ชิ้น:</span> <span className="text-amber-600 font-semibold">฿{parseFloat(item.unitCost || 0).toLocaleString("th-TH", {minimumFractionDigits: 2})}</span></div>
                          <div><span className="text-gray-400">รวม:</span> <span className="text-amber-700 font-bold">฿{(parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0)).toLocaleString("th-TH", {minimumFractionDigits: 2})}</span></div>
                          {item.packLabel && (
                            <div className="col-span-2">
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                📦 นำเข้าผ่าน {item.packLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveReceiveItem(item.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shrink-0"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-amber-100 bg-amber-50/60">
              <div className="flex justify-between text-sm font-semibold text-amber-800 mb-3">
                <span>รวมต้นทุนทั้งสิ้น (Order Total)</span>
                <span className="text-lg">฿{receiveCart.reduce((s, i) => s + (parseFloat(i.unitCost || 0) * parseFloat(i.quantity || 0)), 0).toLocaleString("th-TH", {minimumFractionDigits: 2})}</span>
              </div>
              <button
                onClick={handleReceiveGoods}
                disabled={isSubmitting || receiveCart.length === 0}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการนำเข้าระบบ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Tab ─────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          {/* Header bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={20} className="text-primary" />
              <h3 className="font-bold text-gray-900 text-lg">รายงานรับสินค้าเข้าคลัง</h3>
              <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {receiveHistory.length} รายการ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="ค้นหาบริษัท, เลขออเดอร์..."
                  className="pl-8 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white w-56"
                />
              </div>
              <button
                onClick={fetchReceiveHistory}
                disabled={isLoadingHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={14} className={isLoadingHistory ? "animate-spin" : ""} />
                รีเฟรช
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoadingHistory ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
                <Loader2 size={36} className="animate-spin opacity-40" />
                <span className="text-sm">กำลังโหลดข้อมูล...</span>
              </div>
            ) : receiveHistory.filter(po => {
                const q = historySearch.toLowerCase();
                if (!q) return true;
                return (po.CompanyName || "").toLowerCase().includes(q) ||
                       (po.OrderNumber || po.LotNumber || "").toLowerCase().includes(q);
              }).length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
                <ClipboardList size={40} className="opacity-20" />
                <span className="text-sm">ยังไม่มีข้อมูลการรับสินค้าเข้าคลัง</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {receiveHistory
                  .filter(po => {
                    const q = historySearch.toLowerCase();
                    if (!q) return true;
                    return (po.CompanyName || "").toLowerCase().includes(q) ||
                           (po.OrderNumber || po.LotNumber || "").toLowerCase().includes(q);
                  })
                  .map((po, pi) => {
                    const items    = getPOItems(po);
                    const isExp    = expandedHistoryPO === pi;
                    const date     = po.Date || po.ReceivedAt || po.CreatedAt;
                    const orderNo  = po.OrderNumber || po.LotNumber || po.ReceiveID || `RG-${pi + 1}`;
                    const totalCost= items.reduce((s, it) =>
                      s + (parseFloat(it.unitCost || it.UnitCost || 0) * parseFloat(it.quantity || it.Quantity || 1)), 0);
                    const hasDoc   = !!(po.FileName && po.FileData);
                    const ext      = (po.FileName || "").split(".").pop().toLowerCase();
                    const isImgDoc = ["jpg","jpeg","png","gif","webp"].includes(ext);

                    return (
                      <div key={pi}>
                        {/* Row header */}
                        <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                          {/* Expand toggle */}
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryPO(isExp ? null : pi)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 shrink-0"
                            title={isExp ? "ซ่อนรายการ" : "ดูรายการสินค้า"}
                          >
                            {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-sm text-gray-900">{orderNo}</span>
                              <span className="text-gray-500 text-sm">{po.CompanyName || "-"}</span>
                              {hasDoc && (
                                <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Eye size={10} /> มีเอกสาร
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Calendar size={11} />
                                {date ? new Date(date).toLocaleDateString("th-TH", { dateStyle: "medium" }) : "-"}
                              </span>
                              <span>{items.length} รายการสินค้า</span>
                              {totalCost > 0 && (
                                <span className="text-amber-700 font-bold">
                                  ฿{totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedHistoryPO(isExp ? null : pi)}
                              className="flex items-center gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            >
                              <ClipboardList size={13} /> ดูรายการ ({items.length})
                            </button>
                            {hasDoc && (
                              <button
                                type="button"
                                onClick={() => setViewDocPO(po)}
                                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-semibold transition-colors border border-blue-100"
                              >
                                {isImgDoc ? <FileImage size={13} /> : <FileSpreadsheet size={13} />}
                                ดูเอกสาร
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded items */}
                        {isExp && (
                          <div className="px-4 pb-4 pt-1">
                            {/* PO meta */}
                            <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 text-xs border-b border-gray-100">
                                <div>
                                  <div className="text-gray-400 mb-0.5">เลขที่ออเดอร์</div>
                                  <div className="font-mono font-semibold text-gray-800">{orderNo}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 mb-0.5">บริษัท/ซัพพลายเออร์</div>
                                  <div className="font-semibold text-gray-800">{po.CompanyName || "-"}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 mb-0.5">วันที่รับเข้า</div>
                                  <div className="font-semibold text-gray-800">
                                    {date ? new Date(date).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                                  </div>
                                </div>
                                {po.FileName && (
                                  <div>
                                    <div className="text-gray-400 mb-0.5">เอกสารแนบ</div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-blue-600 font-medium truncate max-w-[120px]">{po.FileName}</span>
                                      {hasDoc && (
                                        <button onClick={() => openDocument(po)} className="text-blue-500 hover:text-blue-700 shrink-0" title="เปิดเอกสาร">
                                          <ExternalLink size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Items table */}
                              {items.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-primary/5 text-primary font-semibold">
                                        <th className="py-2 px-4 text-left">#</th>
                                        <th className="py-2 px-3 text-left">สินค้า</th>
                                        <th className="py-2 px-3 text-left">บาร์โค้ด</th>
                                        <th className="py-2 px-3 text-center">จำนวน</th>
                                        <th className="py-2 px-3 text-right">ต้นทุน/ชิ้น</th>
                                        <th className="py-2 px-3 text-right">รวม</th>
                                        <th className="py-2 px-3 text-center">EXP</th>
                                        <th className="py-2 px-3 text-left">โลเคชั่น</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {items.map((item, ii) => {
                                        const qty   = parseFloat(item.quantity || item.Quantity || 1);
                                        const cost  = parseFloat(item.unitCost || item.UnitCost || 0);
                                        return (
                                          <tr key={ii} className="hover:bg-white/80 transition-colors">
                                            <td className="py-2 px-4 text-gray-400">{ii + 1}</td>
                                            <td className="py-2 px-3 font-medium text-gray-800">{item.productName || item.ProductName || "-"}</td>
                                            <td className="py-2 px-3 font-mono text-gray-500">{item.barcode || item.Barcode || "-"}</td>
                                            <td className="py-2 px-3 text-center font-bold text-gray-900">{qty}</td>
                                            <td className="py-2 px-3 text-right text-amber-600">
                                              {cost > 0 ? `฿${cost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "-"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-amber-700">
                                              {cost > 0 ? `฿${(qty * cost).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "-"}
                                            </td>
                                            <td className="py-2 px-3 text-center text-gray-500">
                                              {item.expiryDate || item.ExpiryDate || "-"}
                                            </td>
                                            <td className="py-2 px-3 text-gray-500">
                                              {item.location || item.Location || "-"}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-amber-50 font-bold text-amber-800 text-xs">
                                        <td colSpan={5} className="py-2 px-4 text-right">รวมต้นทุนทั้งสิ้น</td>
                                        <td className="py-2 px-3 text-right">฿{totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                        <td colSpan={2} />
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-6 text-center text-xs text-gray-400">ไม่มีข้อมูลรายการสินค้า</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewDocPO && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">เอกสารอ้างอิง</h3>
                  <p className="text-xs text-gray-400">
                    {viewDocPO.OrderNumber || viewDocPO.LotNumber} · {viewDocPO.CompanyName} · {viewDocPO.FileName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDocument(viewDocPO)}
                  className="flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 font-semibold transition-colors"
                >
                  <ExternalLink size={14} /> เปิดในแท็บใหม่
                </button>
                <button onClick={() => setViewDocPO(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Document preview */}
            <div className="flex-1 overflow-hidden bg-gray-100 rounded-b-2xl">
              {(() => {
                const ext = (viewDocPO.FileName || "").split(".").pop().toLowerCase();
                const isImg = ["jpg","jpeg","png","gif","webp"].includes(ext);
                if (isImg) {
                  return (
                    <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                      <img
                        src={`data:image/${ext === "jpg" ? "jpeg" : ext};base64,${viewDocPO.FileData}`}
                        alt={viewDocPO.FileName}
                        className="max-w-full rounded-xl shadow-md"
                      />
                    </div>
                  );
                }
                // PDF or other
                return (
                  <iframe
                    src={`data:application/pdf;base64,${viewDocPO.FileData}`}
                    title={viewDocPO.FileName}
                    className="w-full h-full rounded-b-2xl"
                    style={{ minHeight: "500px" }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">เพิ่มผู้จำหน่าย/บริษัทคู่ค้าใหม่</h3>
                  <p className="text-xs text-gray-400">กรอกข้อมูลผู้จำหน่ายให้ครบถ้วนเพื่อบันทึกลงระบบ</p>
                </div>
              </div>
              <button onClick={() => setIsAddSupplierModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveNewSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อบริษัท/ผู้จำหน่าย <span className="text-red-500">*</span></label>
                  <input
                    type="text" required
                    value={newSupplierData.name}
                    onChange={e => setNewSupplierData(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="เช่น CP Foods, Betagro Group..."
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ผู้ติดต่อ (ContactPerson)</label>
                  <input
                    type="text"
                    value={newSupplierData.contactPerson}
                    onChange={e => setNewSupplierData(p => ({ ...p, contactPerson: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="ชื่อผู้ติดต่อ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทร</label>
                  <input
                    type="text"
                    value={newSupplierData.phone}
                    onChange={e => setNewSupplierData(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="เช่น 02-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี (TaxID)</label>
                  <input
                    type="text"
                    value={newSupplierData.taxId}
                    onChange={e => setNewSupplierData(p => ({ ...p, taxId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="13 หลัก"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">อีเมล</label>
                  <input
                    type="email"
                    value={newSupplierData.email}
                    onChange={e => setNewSupplierData(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="email@company.com"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ที่อยู่</label>
                  <textarea
                    rows={2}
                    value={newSupplierData.address}
                    onChange={e => setNewSupplierData(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                    placeholder="ที่อยู่สำนักงาน..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSavingSupplier ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSavingSupplier ? "กำลังบันทึก..." : "บันทึกผู้จำหน่าย"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">ตรวจสอบข้อมูลนำเข้าจาก Excel</h3>
                  <p className="text-xs text-gray-400">ตรวจสอบรายการก่อนเพิ่มลงใบรับสินค้า</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-2">
              {importPreviewItems.length === 0 ? (
                <p className="text-center text-gray-400 py-10">ไม่พบข้อมูลในไฟล์</p>
              ) : (
                importPreviewItems.map((item, idx) => (
                  <div key={item.id} className={clsx(
                    "p-3 rounded-xl border text-sm",
                    item.found ? "bg-green-50/60 border-green-100" : "bg-red-50 border-red-200"
                  )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={clsx("font-semibold", item.found ? "text-gray-900" : "text-red-700")}>
                        {idx + 1}. {item.productName}
                      </span>
                      {item.found
                        ? <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> พบในระบบ</span>
                        : <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><AlertTriangle size={11} /> ไม่พบบาร์โค้ด</span>
                      }
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span><span className="text-gray-400">Barcode:</span> {item.barcode}</span>
                      <span><span className="text-gray-400">จำนวน:</span> {item.quantity || "-"} ชิ้น</span>
                      <span><span className="text-gray-400">ต้นทุน/ชิ้น:</span> {item.unitCost ? `฿${item.unitCost}` : "-"}</span>
                      <span><span className="text-gray-400">โลเคชั่น:</span> {item.location || "-"}</span>
                      <span><span className="text-gray-400">EXP:</span> {item.expiryDate || "-"}</span>
                    </div>
                    {!item.found && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={11} /> บาร์โค้ดนี้ไม่มีในระบบ — จะถูกข้าม กรุณาเพิ่มสินค้าก่อนนำเข้า
                      </p>
                    )}
                    {item.found && item.requiresExpiry && !item.expiryDate && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={11} /> สินค้านี้ต้องการวันหมดอายุ — สามารถแก้ไขได้ในรายการหลังจากนำเข้า
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-b-2xl">
              <div className="text-sm text-gray-600">
                พบ <span className="font-bold text-green-700">{importPreviewItems.filter(i => i.found).length}</span> รายการ
                {importPreviewItems.filter(i => !i.found).length > 0 && (
                  <span className="ml-2 text-red-600">
                    / ข้าม <span className="font-bold">{importPreviewItems.filter(i => !i.found).length}</span> รายการ (ไม่พบในระบบ)
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors">
                  ยกเลิก
                </button>
                <button type="button" onClick={handleConfirmImport}
                  disabled={importPreviewItems.filter(i => i.found && i.quantity).length === 0}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  เพิ่มลงใบรับสินค้า ({importPreviewItems.filter(i => i.found && i.quantity).length} รายการ)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move to Store Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">ย้ายสินค้าเข้าหน้าร้าน</h3>
                  <p className="text-xs text-gray-400">ย้ายจากคลังสินค้า → หน้าร้าน</p>
                </div>
              </div>
              <button onClick={() => setIsMoveModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMoveToStore} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลือกสินค้า *</label>
                <select
                  required
                  value={moveSource?.Barcode || ""}
                  onChange={e => {
                    const found = products.find(p => String(p.Barcode) === e.target.value);
                    setMoveSource(found || null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm bg-gray-50 focus:bg-white"
                >
                  <option value="">-- เลือกสินค้าจากคลัง --</option>
                  {products.map((p, i) => (
                    <option key={i} value={p.Barcode}>
                      {p.Name} (คลัง: {p.Quantity || 0} ชิ้น)
                    </option>
                  ))}
                </select>
                {moveSource && (
                  <p className="text-xs text-emerald-600 mt-1 font-mono">Barcode: {moveSource.Barcode} | สต็อกคลัง: {moveSource.Quantity}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนที่ต้องการย้าย *</label>
                <input
                  type="number" required min="1"
                  max={moveSource?.Quantity || 9999}
                  value={moveQty}
                  onChange={e => setMoveQty(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm bg-gray-50 focus:bg-white"
                  placeholder="ระบุจำนวน..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={13} /> ตำแหน่งหน้าร้าน</label>
                <input
                  type="text"
                  value={moveLocation}
                  onChange={e => setMoveLocation(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm bg-gray-50 focus:bg-white"
                  placeholder="เช่น ชั้นวางหน้า A, ตู้แช่ 1..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsMoveModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isMoving || !moveSource} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  {isMoving ? <Loader2 size={16} className="animate-spin" /> : <MoveRight size={16} />}
                  {isMoving ? "กำลังย้าย..." : "ยืนยันย้ายสินค้า"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editItem && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">แก้ไขข้อมูลสินค้า</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">Barcode: {editItem.Barcode}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า *</label>
                <input
                  type="text" required
                  value={editItem.Name}
                  onChange={e => setEditItem(prev => ({ ...prev, Name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vat Status</label>
                  <select
                    value={editItem.VatStatus}
                    onChange={e => setEditItem(prev => ({ ...prev, VatStatus: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  >
                    <option value="VAT">VAT</option>
                    <option value="NON VAT">NON VAT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                  <input
                    type="text"
                    value={editItem.Category || ""}
                    onChange={e => setEditItem(prev => ({ ...prev, Category: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">มีวันหมดอายุหรือไม่?</label>
                  <select
                    value={editItem.HasExpiry || "YES"}
                    onChange={e => setEditItem(prev => ({ ...prev, HasExpiry: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  >
                    <option value="YES">มีวันหมดอายุ</option>
                    <option value="NO">ไม่มีวันหมดอายุ</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">วิธีชำระเงินที่รับได้</label>
                <div className="space-y-2">
                  {PAYMENT_METHOD_GROUPS.map(group => {
                    const current = String(editItem.AcceptedPayments || "").split(",").map(s => s.trim()).filter(Boolean);
                    return (
                      <div key={group.label}>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.methods.map(pm => {
                            const checked = current.length === 0 ? true : current.includes(pm);
                            return (
                              <label key={pm} className="cursor-pointer select-none">
                                <input type="checkbox" checked={checked} className="sr-only"
                                  onChange={e => {
                                    const prev = String(editItem.AcceptedPayments || "").split(",").map(s => s.trim()).filter(Boolean);
                                    const base = prev.length === 0 ? [...PAYMENT_METHODS] : prev;
                                    const next = e.target.checked ? [...new Set([...base, pm])] : base.filter(p => p !== pm);
                                    setEditItem(p => ({ ...p, AcceptedPayments: next.join(",") }));
                                  }}
                                />
                                <span className={clsx(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                                  checked ? PAYMENT_METHOD_STYLE[pm] : PAYMENT_METHOD_STYLE_OFF
                                )}>
                                  {checked && <span className="text-[10px]">✓</span>}
                                  {pm}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุน (Cost)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editItem.CostPrice || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, CostPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคาปลีก (Retail) *</label>
                  <input
                    type="number" required min="0" step="0.01"
                    value={editItem.Price || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, Price: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคาส่ง (Wholesale)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editItem.WholesalePrice || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, WholesalePrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา Shopee</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editItem.ShopeePrice || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, ShopeePrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา Lazada</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editItem.LazadaPrice || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, LazadaPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา Lineman</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editItem.LinemanPrice || 0}
                    onChange={e => setEditItem(prev => ({ ...prev, LinemanPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={13} /> โลเคชั่นจัดเก็บ</label>
                <input
                  type="text"
                  value={editItem.Location || ""}
                  onChange={e => setEditItem(prev => ({ ...prev, Location: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              {(!editItem.HasExpiry || editItem.HasExpiry === "YES") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Calendar size={13} /> วันหมดอายุ</label>
                  <input
                    type="date"
                    value={editItem.ExpiryDate || ""}
                    onChange={e => setEditItem(prev => ({ ...prev, ExpiryDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จุดแจ้งเตือนของหมด (ชิ้น)</label>
                <input
                  type="number" min="0" required
                  value={editItem.LowStockThreshold ?? ""}
                  onChange={e => setEditItem(prev => ({ ...prev, LowStockThreshold: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">บาร์โค้ดแพ็ค</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 1 — บาร์โค้ด</label>
                    <input type="text"
                      value={editItem.PackBarcode || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackBarcode: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="บาร์โค้ดยกแพ็ค"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 1 — จำนวนชิ้น</label>
                    <input type="number" min="0"
                      value={editItem.PackMultiplier || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackMultiplier: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="เช่น 6, 12"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 2 — บาร์โค้ด</label>
                    <input type="text"
                      value={editItem.PackBarcode2 || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackBarcode2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="บาร์โค้ดแพ็คที่ 2"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 2 — จำนวนชิ้น</label>
                    <input type="number" min="0"
                      value={editItem.PackMultiplier2 || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackMultiplier2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="เช่น 3, 24"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 3 — บาร์โค้ด</label>
                    <input type="text"
                      value={editItem.PackBarcode3 || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackBarcode3: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="บาร์โค้ดแพ็คที่ 3"/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">แพ็ค 3 — จำนวนชิ้น</label>
                    <input type="number" min="0"
                      value={editItem.PackMultiplier3 || ""}
                      onChange={e => setEditItem(prev => ({ ...prev, PackMultiplier3: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                      placeholder="เช่น 2, 48"/>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditItem(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isEditSaving} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {isEditSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isEditSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Stock Modal */}
      {editStoreItem && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-emerald-500">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">การตั้งค่าหน้าร้าน</h3>
                <p className="text-sm font-medium text-emerald-600 mt-1">{editStoreItem.Name}</p>
              </div>
              <button onClick={() => setEditStoreItem(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateStoreStock} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={13} /> โลเคชั่นจัดเก็บ (หน้าร้าน)</label>
                <input
                  type="text"
                  value={editStoreItem.StoreLocation || ""}
                  onChange={e => setEditStoreItem(prev => ({ ...prev, StoreLocation: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จุดแจ้งเตือนของใกล้หมด (ชิ้น)</label>
                <input
                  type="number" min="0" required
                  value={editStoreItem.LowStockThreshold ?? ""}
                  onChange={e => setEditStoreItem(prev => ({ ...prev, LowStockThreshold: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditStoreItem(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isEditStoreSaving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  {isEditStoreSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isEditStoreSaving ? "กำลังบันทึก..." : "อัปเดตหน้าร้าน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ADD PRODUCT MODAL */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <PackagePlus size={24} className="text-primary" /> เพิ่มสินค้าใหม่เข้าระบบ
              </h3>
              <button onClick={() => setIsAddProductModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="flex flex-col min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">บาร์โค้ด *</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      value={newProductData.barcode}
                      onChange={(e) => setNewProductData({...newProductData, barcode: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                      value={newProductData.category}
                      onChange={(e) => setNewProductData({...newProductData, category: e.target.value})}
                    >
                      <option value="ทั่วไป">ทั่วไป</option>
                      <option value="อาหาร">อาหาร</option>
                      <option value="ของเล่น">ของเล่น</option>
                      <option value="ยารักษา">ยารักษา</option>
                      <option value="อุปกรณ์">อุปกรณ์</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า *</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      value={newProductData.name}
                      onChange={(e) => setNewProductData({...newProductData, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ VAT</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                      value={newProductData.vatStatus}
                      onChange={(e) => setNewProductData({...newProductData, vatStatus: e.target.value})}
                    >
                      <option value="VAT">VAT</option>
                      <option value="NON VAT">NON VAT</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">มีวันหมดอายุหรือไม่?</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                      value={newProductData.hasExpiry}
                      onChange={(e) => setNewProductData({...newProductData, hasExpiry: e.target.value})}
                    >
                      <option value="YES">มีวันหมดอายุ</option>
                      <option value="NO">ไม่มีวันหมดอายุ</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">จุดสั่งซื้อ (Low Stock) *</label>
                    <input
                      type="number" min="0" required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      value={newProductData.lowStockThreshold}
                      onChange={(e) => setNewProductData({...newProductData, lowStockThreshold: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">วิธีชำระเงินที่รับได้</label>
                    <div className="space-y-2">
                      {PAYMENT_METHOD_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.methods.map(pm => {
                              const checked = (newProductData.acceptedPayments || []).includes(pm);
                              return (
                                <label key={pm} className="cursor-pointer select-none">
                                  <input type="checkbox" checked={checked} className="sr-only"
                                    onChange={e => {
                                      const prev = newProductData.acceptedPayments || [];
                                      const next = e.target.checked ? [...new Set([...prev, pm])] : prev.filter(p => p !== pm);
                                      setNewProductData({...newProductData, acceptedPayments: next});
                                    }}
                                  />
                                  <span className={clsx(
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                                    checked ? PAYMENT_METHOD_STYLE[pm] : PAYMENT_METHOD_STYLE_OFF
                                  )}>
                                    {checked && <span className="text-[10px]">✓</span>}
                                    {pm}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 border-t pt-4 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">บาร์โค้ดแพ็ค</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 1 — บาร์โค้ด</label>
                        <input type="text"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packBarcode}
                          onChange={(e) => setNewProductData({...newProductData, packBarcode: e.target.value})}
                          placeholder="บาร์โค้ดยกแพ็ค"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 1 — จำนวนชิ้น</label>
                        <input type="number" min="0"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packMultiplier}
                          onChange={(e) => setNewProductData({...newProductData, packMultiplier: e.target.value})}
                          placeholder="เช่น 6, 12"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 2 — บาร์โค้ด</label>
                        <input type="text"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packBarcode2}
                          onChange={(e) => setNewProductData({...newProductData, packBarcode2: e.target.value})}
                          placeholder="บาร์โค้ดแพ็คที่ 2"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 2 — จำนวนชิ้น</label>
                        <input type="number" min="0"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packMultiplier2}
                          onChange={(e) => setNewProductData({...newProductData, packMultiplier2: e.target.value})}
                          placeholder="เช่น 3, 24"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 3 — บาร์โค้ด</label>
                        <input type="text"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packBarcode3}
                          onChange={(e) => setNewProductData({...newProductData, packBarcode3: e.target.value})}
                          placeholder="บาร์โค้ดแพ็คที่ 3"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">แพ็ค 3 — จำนวนชิ้น</label>
                        <input type="number" min="0"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          value={newProductData.packMultiplier3}
                          onChange={(e) => setNewProductData({...newProductData, packMultiplier3: e.target.value})}
                          placeholder="เช่น 2, 48"/>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 border-t pt-4 mt-2">
                    <h4 className="font-medium text-gray-800 mb-3">ข้อมูลราคา</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ต้นทุน (Cost)</label>
                        <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.costPrice} onChange={(e) => setNewProductData({...newProductData, costPrice: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-emerald-600 mb-1">ราคาหน้าร้าน *</label>
                        <input type="number" step="0.01" required className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.price} onChange={(e) => setNewProductData({...newProductData, price: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ราคาส่ง</label>
                        <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.wholesalePrice} onChange={(e) => setNewProductData({...newProductData, wholesalePrice: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs text-orange-500 mb-1">ราคา Shopee</label>
                        <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.shopeePrice} onChange={(e) => setNewProductData({...newProductData, shopeePrice: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-500 mb-1">ราคา Lazada</label>
                        <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.lazadaPrice} onChange={(e) => setNewProductData({...newProductData, lazadaPrice: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs text-green-500 mb-1">ราคา Lineman</label>
                        <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border text-sm"
                          value={newProductData.linemanPrice} onChange={(e) => setNewProductData({...newProductData, linemanPrice: e.target.value})} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-100">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isAddingProduct} className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium flex items-center gap-2">
                  {isAddingProduct ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  <span>{isAddingProduct ? "กำลังบันทึก..." : "บันทึกสินค้าใหม่"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

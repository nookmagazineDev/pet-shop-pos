import { useState, useEffect } from "react";
import { Search, Plus, MapPin, PackagePlus, Calendar, Loader2, Camera, X, Pencil, Save, MoveRight, Store, ArrowRightLeft } from "lucide-react";
import clsx from "clsx";
import BarcodeScanner from "../components/BarcodeScanner";
import { fetchApi, postApi } from "../api";

export default function Inventory() {
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

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === "stock") fetchProducts();
    if (activeTab === "store") fetchStoreStock();
    if (activeTab === "receive") fetchProducts();
  }, [activeTab]);

  const filteredStock = products.filter(item => 
    item.Name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.Barcode?.toString().includes(searchQuery) ||
    item.Location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddReceiveItem = (e) => {
    e.preventDefault();
    if (!productNameInput || !receiveQtyStr || !receiveLocationStr || !receiveExpiryStr || !orderNumberStr) {
      alert("กรุณากรอกข้อมูลบังคับให้ครบ (เลขที่ออเดอร์, ชื่อสินค้า, จำนวน, โลเคชั่น, วันหมดอายุ)");
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      barcode: barcodeInput,
      productName: productNameInput,
      quantity: receiveQtyStr,
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
  };

  const handleRemoveReceiveItem = (id) => {
    setReceiveCart(receiveCart.filter(item => item.id !== id));
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
        items: receiveCart
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert("บันทึกสินค้านำเข้าลงคลังเรียบร้อยแล้ว!");
      setReceiveCart([]);
      setCompanyNameStr("");
      setOrderNumberStr("");
      fetchProducts(); // Refresh stock immediately
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
      // Auto-fill product name if barcode matches
      const match = products.find(p => String(p.Barcode) === String(text).trim());
      if (match) {
        setProductNameInput(match.Name);
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
        lowStockThreshold: editItem.LowStockThreshold || 5
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
          >
            ใบรับของเข้าคลัง (Receive Goods)
          </button>
          <button 
            onClick={() => setActiveTab("store")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5",
              activeTab === "store" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Store size={14} /> สต็อคหน้าร้าน
          </button>
        </div>
      </div>

      {activeTab === "stock" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex gap-2 max-w-md">
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
                    </td>
                    <td className="py-4 px-6 text-sm text-right whitespace-nowrap">
                      <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs items-center justify-end">
                         <span className="text-gray-500">ต้นทุน:</span> <span className="font-semibold text-gray-700">฿{parseFloat(item.CostPrice || 0).toLocaleString()}</span>
                         <span className="text-gray-500">ราคาปลีก:</span> <span className="font-bold text-amber-600">฿{parseFloat(item.Price || 0).toLocaleString()}</span>
                         <span className="text-gray-500">ราคาส่ง:</span> <span className="font-medium text-blue-600">฿{parseFloat(item.WholesalePrice || 0).toLocaleString()}</span>
                         <span className="text-gray-500">Shopee:</span> <span className="font-medium text-orange-500">฿{parseFloat(item.ShopeePrice || 0).toLocaleString()}</span>
                         <span className="text-gray-500">Lazada:</span> <span className="font-medium text-blue-500">฿{parseFloat(item.LazadaPrice || 0).toLocaleString()}</span>
                         <span className="text-gray-500">Lineman:</span> <span className="font-medium text-green-500">฿{parseFloat(item.LinemanPrice || 0).toLocaleString()}</span>
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
                        )}>{item.ExpiryDate || "-"}</span>
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
                        <button
                          onClick={() => setEditItem({ ...item })}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="แก้ไขสินค้า"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => { setMoveSource(item); setMoveQty("1"); setMoveLocation(""); setIsMoveModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="ย้ายสินค้าเข้าหน้าร้าน"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
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
            <button
              onClick={() => { setMoveSource(null); setMoveQty("1"); setMoveLocation(""); setIsMoveModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <ArrowRightLeft size={16} /> ย้ายสินค้าเข้าหน้าร้าน
            </button>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">บริษัทที่นำเข้า *</label>
                  <input
                    type="text"
                    value={companyNameStr}
                    onChange={(e) => setCompanyNameStr(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                    placeholder="เช่น CP, Betagro..."
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
              </div>
            </div>

            <form className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100" onSubmit={handleAddReceiveItem}>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-2">ฟอร์มเพิ่มรายการสินค้า</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">สแกนบาร์โค้ด</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                      placeholder="สแกน หรือพิมพ์บาร์โค้ด..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder="พิมพ์ชื่อสินค้าอ้างอิง..."
                    value={productNameInput}
                    onChange={(e) => setProductNameInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน *</label>
                  <input
                    type="number"
                    required min="1"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder="0"
                    value={receiveQtyStr}
                    onChange={(e) => setReceiveQtyStr(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โลเคชั่นคลัง *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-white"
                    placeholder="เช่น คลังหลัง A1"
                    value={receiveLocationStr}
                    onChange={(e) => setReceiveLocationStr(e.target.value)}
                  />
                </div>

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
                  className="w-full py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border border-blue-200"
                >
                  <Plus size={18} /> เพิ่มลงรายการนำเข้า
                </button>
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
                          <div><span className="text-gray-400">EXP:</span> {item.expiryDate}</div>
                          <div><span className="text-gray-400">ต้นทุน/ชิ้น:</span> <span className="text-amber-600 font-semibold">฿{parseFloat(item.unitCost || 0).toLocaleString("th-TH", {minimumFractionDigits: 2})}</span></div>
                          <div><span className="text-gray-400">รวม:</span> <span className="text-amber-700 font-bold">฿{(parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0)).toLocaleString("th-TH", {minimumFractionDigits: 2})}</span></div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Calendar size={13} /> วันหมดอายุ</label>
                <input
                  type="date"
                  value={editItem.ExpiryDate || ""}
                  onChange={e => setEditItem(prev => ({ ...prev, ExpiryDate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จุดแจ้งเตือนของหมด (ชิ้น)</label>
                <input
                  type="number" min="0" required
                  value={editItem.LowStockThreshold ?? ""}
                  onChange={e => setEditItem(prev => ({ ...prev, LowStockThreshold: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
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
    </div>
  );
}

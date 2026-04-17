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

  const handleReceiveGoods = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.target);
    const payload = {
      action: "receiveGoods",
      payload: {
        barcode: barcodeInput || formData.get("barcode") || "",
        productName: productNameInput || formData.get("productName"),
        quantity: formData.get("quantity"),
        location: formData.get("location"),
        lotNumber: formData.get("lotNumber"),
        expiryDate: formData.get("expiryDate") || "N/A",
        receivingDate: formData.get("receivingDate")
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert("บันทึกสินค้านำเข้าลงคลังเรียบร้อยแล้ว!");
      e.target.reset();
      setBarcodeInput("");
      setProductNameInput("");
      fetchProducts(); // Refresh stock immediately
      setActiveTab("stock");
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (res.error || "Unknown"));
    }
  };

  const handleScanSuccess = (text) => {
    setBarcodeInput(text);
    setIsScannerOpen(false);
    // Auto-fill product name if barcode matches
    const match = products.find(p => String(p.Barcode) === String(text).trim());
    if (match) setProductNameInput(match.Name);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setIsEditSaving(true);
    const res = await postApi({
      action: "updateProduct",
      payload: {
        barcode: editItem.Barcode,
        name: editItem.Name,
        price: editItem.Price,
        location: editItem.Location,
        expiryDate: editItem.ExpiryDate || ""
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
            <div className="relative max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="ค้นหาสินค้าหรือตำแหน่งจัดเก็บ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">ข้อมูลสินค้า</th>
                  <th className="py-3 px-6 text-right">ราคา</th>
                  <th className="py-3 px-6">เลข Lot Number</th>
                  <th className="py-3 px-6">ตำแหน่งจัดเก็บ (Location)</th>
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
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm">
                      <div className="font-semibold text-gray-900">{item.Name}</div>
                      {item.Barcode && <div className="text-xs text-gray-500 mt-1">Barcode: {item.Barcode}</div>}
                    </td>
                    <td className="py-4 px-6 text-sm text-right font-medium text-amber-600">
                      ฿{parseFloat(item.Price || 0).toLocaleString()}
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
                    <td className="py-4 px-6 text-right font-bold text-lg text-primary">
                      {item.Quantity || 0}
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
                        parseFloat(item.Quantity) <= 3 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {item.Quantity || 0}
                      </span>
                      {parseFloat(item.Quantity) <= 3 && (
                        <div className="text-xs text-red-500 font-medium">ใกล้หมด!</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "receive" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex p-6 lg:p-8 shrink-0 max-w-3xl">
          <div className="w-full">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <PackagePlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">บันทึกใบรับของ (นำเข้าสินค้า)</h3>
                <p className="text-sm text-gray-500">กรอกรายละเอียดเพื่อบันทึกของเข้าสู่ระบบรายการสต็อกเรียลไทม์</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleReceiveGoods}>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สแกนบาร์โค้ด</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        name="barcode" 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" 
                        placeholder="สแกน หรือพิมพ์บาร์โค้ด..." 
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setIsScannerOpen(!isScannerOpen)}
                        className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shadow-sm shrink-0"
                        title="เปิดกล้องสแกน"
                      >
                        {isScannerOpen ? <X size={20} /> : <Camera size={20} />}
                      </button>
                    </div>

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า *</label>
                    <input 
                      type="text" 
                      name="productName" 
                      required 
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" 
                      placeholder="พิมพ์ชื่อสินค้าอ้างอิง..." 
                      value={productNameInput}
                      onChange={(e) => setProductNameInput(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนรับเข้า</label>
                  <input type="number" name="quantity" required min="1" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="0" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โลเคชั่นจัดเก็บ</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <MapPin size={16} />
                    </div>
                    <input type="text" name="location" required className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="เช่น ชั้นวาง A1" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลข Lot (Lot Number)</label>
                  <input type="text" name="lotNumber" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="เช่น L-202310-01" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุของไอเทม</label>
                  <input type="date" name="expiryDate" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเข้า</label>
                  <input type="date" name="receivingDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" />
                </div>

              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none">
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                  {isSubmitting ? "กำลังส่งข้อมูล..." : "ยืนยันนำเข้าระบบสต็อก"}
                </button>
              </div>

            </form>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท) *</label>
                <input
                  type="number" required min="0" step="0.01"
                  value={editItem.Price}
                  onChange={e => setEditItem(prev => ({ ...prev, Price: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white"
                />
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
    </div>
  );
}

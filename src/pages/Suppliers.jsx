import { useState, useEffect, useMemo } from "react";
import {
  Building2, Search, Plus, Pencil, Save, X, Loader2,
  Phone, Mail, Hash, MapPin, User, FileText, ChevronDown,
  ChevronUp, Package, Calendar, RefreshCw, Truck, Eye
} from "lucide-react";
import { fetchApi, postApi } from "../api";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/* ── input row helper ── */
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-indigo-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium break-words min-w-0">{value || "-"}</span>
    </div>
  );
}

/* ── editable field ── */
function EditField({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  const cls = "w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-gray-50 focus:bg-white";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {textarea
        ? <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} className={cls + " resize-none"} placeholder={placeholder}/>
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} placeholder={placeholder}/>
      }
    </div>
  );
}

export default function Suppliers() {
  const [suppliers,    setSuppliers]    = useState([]);
  const [receiveGoods, setReceiveGoods] = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState(null);
  const [editMode,     setEditMode]     = useState(false);
  const [editData,     setEditData]     = useState({});
  const [isSaving,     setIsSaving]     = useState(false);
  const [expandedPO,   setExpandedPO]   = useState(null);
  const [isAddOpen,    setIsAddOpen]    = useState(false);
  const [newData,      setNewData]      = useState({
    name: "", contactPerson: "", phone: "", email: "", address: "", taxId: ""
  });

  const loadData = () => {
    setIsLoading(true);
    Promise.all([fetchApi("getSuppliers"), fetchApi("getReceiveGoods")])
      .then(([s, rg]) => {
        const sArr = Array.isArray(s) ? s : [];
        setSuppliers(sArr);
        setReceiveGoods(Array.isArray(rg) ? rg : []);
        // keep selected in sync
        setSelected(prev => {
          if (!prev) return null;
          return sArr.find(x => (x.SupplierID || x.Name) === (prev.SupplierID || prev.Name)) || prev;
        });
        setIsLoading(false);
      });
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => suppliers.filter(s => {
    const q = search.toLowerCase();
    return !q
      || (s.Name || "").toLowerCase().includes(q)
      || (s.Phone || "").includes(q)
      || (s.ContactPerson || "").toLowerCase().includes(q);
  }), [suppliers, search]);

  // PO records for the selected supplier
  const supplierPOs = useMemo(() => {
    if (!selected) return [];
    const name = (selected.Name || "").toLowerCase();
    return receiveGoods
      .filter(rg => (rg.CompanyName || "").toLowerCase() === name)
      .sort((a, b) => new Date(b.Date || b.ReceivedAt || 0) - new Date(a.Date || a.ReceivedAt || 0));
  }, [receiveGoods, selected]);

  const handleSelect = (s) => {
    setSelected(s);
    setEditMode(false);
    setExpandedPO(null);
  };

  const handleEditStart = () => {
    setEditData({
      SupplierID:    selected.SupplierID || "",
      Name:          selected.Name || "",
      ContactPerson: selected.ContactPerson || "",
      Phone:         selected.Phone || "",
      Email:         selected.Email || "",
      Address:       selected.Address || "",
      TaxID:         selected.TaxID || "",
    });
    setEditMode(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await postApi({ action: "updateSupplier", payload: editData });
    setIsSaving(false);
    if (res.success) {
      setSelected({ ...editData });
      setEditMode(false);
      loadData();
    } else {
      // Fallback: try saveSupplier with same ID
      const res2 = await postApi({ action: "saveSupplier", payload: editData });
      setIsSaving(false);
      if (res2.success) {
        setSelected({ ...editData });
        setEditMode(false);
        loadData();
      } else {
        alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
      }
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newData.name.trim()) { alert("กรุณาระบุชื่อบริษัท"); return; }
    setIsSaving(true);
    const res = await postApi({ action: "saveSupplier", payload: { ...newData } });
    setIsSaving(false);
    if (res.success) {
      setIsAddOpen(false);
      setNewData({ name: "", contactPerson: "", phone: "", email: "", address: "", taxId: "" });
      loadData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  // Parse PO items from JSON string or array
  const getPOItems = (po) => {
    let items = po.Items || po.items || po.CartDetails || [];
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    return Array.isArray(items) ? items : [];
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Truck size={22}/>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">ซัพพลายเออร์ (Suppliers)</h2>
            <p className="text-sm text-gray-500">จัดการข้อมูลผู้จำหน่ายและประวัติใบ PO</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors" title="รีเฟรช">
            <RefreshCw size={16}/>
          </button>
          <button
            onClick={() => { setNewData({ name: "", contactPerson: "", phone: "", email: "", address: "", taxId: "" }); setIsAddOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
            <Plus size={16}/> เพิ่มซัพพลายเออร์
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

        {/* LEFT: Supplier list */}
        <div className="w-full lg:w-72 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden shrink-0">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / เบอร์โทร..."
                className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13}/></button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              <div className="py-12 flex justify-center text-gray-400"><Loader2 size={22} className="animate-spin"/></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                <Building2 size={36} className="opacity-20"/>
                <span className="text-sm">{search ? "ไม่พบซัพพลายเออร์" : "ยังไม่มีข้อมูล"}</span>
              </div>
            ) : filtered.map((s, i) => {
              const isSelected = selected && (selected.SupplierID || selected.Name) === (s.SupplierID || s.Name);
              const poCount    = receiveGoods.filter(rg => (rg.CompanyName || "").toLowerCase() === (s.Name || "").toLowerCase()).length;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(s)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${isSelected ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-gray-50 border-l-2 border-transparent"}`}
                >
                  <div className="font-semibold text-sm text-gray-900 truncate">{s.Name || "—"}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    {s.Phone && <span className="flex items-center gap-0.5"><Phone size={10}/> {s.Phone}</span>}
                    {poCount > 0 && <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">{poCount} PO</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} / {suppliers.length} ซัพพลายเออร์
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div className="flex-1 flex flex-col gap-5 min-h-0 overflow-y-auto">
          {!selected ? (
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
              <Building2 size={48} className="opacity-20"/>
              <p className="text-sm">เลือกซัพพลายเออร์จากรายการด้านซ้าย</p>
            </div>
          ) : (
            <>
              {/* Supplier Info Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-indigo-50/40">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-600"/>
                    <h3 className="font-bold text-gray-900">{selected.Name}</h3>
                    {selected.TaxID && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{selected.TaxID}</span>}
                  </div>
                  {!editMode && (
                    <button
                      onClick={handleEditStart}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-colors"
                    >
                      <Pencil size={13}/> แก้ไข
                    </button>
                  )}
                </div>

                {editMode ? (
                  <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <EditField label="ชื่อบริษัท / ผู้จำหน่าย *" value={editData.Name} onChange={v => setEditData(p => ({...p, Name: v}))} placeholder="ชื่อบริษัท..."/>
                      </div>
                      <EditField label="ผู้ติดต่อ" value={editData.ContactPerson} onChange={v => setEditData(p => ({...p, ContactPerson: v}))} placeholder="ชื่อผู้ติดต่อ..."/>
                      <EditField label="เบอร์โทร" value={editData.Phone} onChange={v => setEditData(p => ({...p, Phone: v}))} placeholder="02-xxx-xxxx"/>
                      <EditField label="อีเมล" value={editData.Email} onChange={v => setEditData(p => ({...p, Email: v}))} type="email" placeholder="email@company.com"/>
                      <EditField label="เลขประจำตัวผู้เสียภาษี" value={editData.TaxID} onChange={v => setEditData(p => ({...p, TaxID: v}))} placeholder="13 หลัก"/>
                      <div className="sm:col-span-2">
                        <EditField label="ที่อยู่" value={editData.Address} onChange={v => setEditData(p => ({...p, Address: v}))} placeholder="ที่อยู่สำนักงาน..." textarea/>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                        ยกเลิก
                      </button>
                      <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-60">
                        {isSaving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
                        {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<Building2 size={13}/>} label="ชื่อบริษัท" value={selected.Name}/>
                    <InfoRow icon={<User size={13}/>}     label="ผู้ติดต่อ"  value={selected.ContactPerson}/>
                    <InfoRow icon={<Phone size={13}/>}    label="เบอร์โทร"   value={selected.Phone}/>
                    <InfoRow icon={<Mail size={13}/>}     label="อีเมล"      value={selected.Email}/>
                    <InfoRow icon={<Hash size={13}/>}     label="เลขภาษี"    value={selected.TaxID}/>
                    <InfoRow icon={<MapPin size={13}/>}   label="ที่อยู่"    value={selected.Address}/>
                  </div>
                )}
              </div>

              {/* PO History */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500"/>
                    <span className="font-bold text-gray-900">ประวัติใบ PO</span>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{supplierPOs.length}</span>
                  </div>
                </div>

                {supplierPOs.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                    <FileText size={40} className="opacity-20"/>
                    <span className="text-sm">ยังไม่มีประวัติ PO สำหรับซัพพลายเออร์นี้</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {supplierPOs.map((po, pi) => {
                      const items    = getPOItems(po);
                      const isExpPO  = expandedPO === pi;
                      const date     = po.Date || po.ReceivedAt || po.CreatedAt;
                      const orderNo  = po.OrderNumber || po.LotNumber || po.ReceiveID || `PO-${pi+1}`;
                      const totalCost= items.reduce((s, i) => s + (parseFloat(i.unitCost||i.UnitCost||0) * parseFloat(i.quantity||i.Quantity||1)), 0);

                      return (
                        <div key={pi}>
                          <button
                            type="button"
                            onClick={() => setExpandedPO(isExpPO ? null : pi)}
                            className="w-full px-6 py-4 hover:bg-gray-50/60 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-sm font-mono">{orderNo}</span>
                                  {po.FileName && (
                                    <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <Eye size={10}/> มีเอกสาร
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                  <span className="flex items-center gap-0.5"><Calendar size={11}/> {formatDate(date)}</span>
                                  <span className="flex items-center gap-0.5"><Package size={11}/> {items.length} รายการ</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {totalCost > 0 && (
                                  <span className="font-bold text-amber-700 text-sm">
                                    ฿{totalCost.toLocaleString(undefined,{minimumFractionDigits:2})}
                                  </span>
                                )}
                                {isExpPO ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                              </div>
                            </div>
                          </button>

                          {isExpPO && (
                            <div className="px-6 pb-5">
                              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                {/* PO meta */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 text-xs border-b border-gray-100">
                                  <div><span className="text-gray-400">เลขที่ออเดอร์:</span><div className="font-mono font-semibold text-gray-800 mt-0.5">{orderNo}</div></div>
                                  <div><span className="text-gray-400">วันที่รับเข้า:</span><div className="font-semibold text-gray-800 mt-0.5">{formatDate(date)}</div></div>
                                  {po.FileName && <div><span className="text-gray-400">เอกสาร:</span><div className="text-blue-600 font-medium mt-0.5 truncate">{po.FileName}</div></div>}
                                </div>
                                {/* Items table */}
                                {items.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-indigo-50/60 text-indigo-700 font-semibold">
                                        <th className="py-2 px-4 text-left">สินค้า</th>
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
                                        const qty     = parseFloat(item.quantity || item.Quantity || 1);
                                        const cost    = parseFloat(item.unitCost || item.UnitCost || 0);
                                        const rowTotal= qty * cost;
                                        return (
                                          <tr key={ii} className="hover:bg-white/80 transition-colors">
                                            <td className="py-2 px-4 font-medium text-gray-800">{item.productName || item.Name || "-"}</td>
                                            <td className="py-2 px-3 font-mono text-gray-500">{item.barcode || item.Barcode || "-"}</td>
                                            <td className="py-2 px-3 text-center font-semibold">{qty}</td>
                                            <td className="py-2 px-3 text-right text-gray-700">
                                              {cost > 0 ? `฿${cost.toLocaleString(undefined,{minimumFractionDigits:2})}` : "-"}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-amber-700">
                                              {rowTotal > 0 ? `฿${rowTotal.toLocaleString(undefined,{minimumFractionDigits:2})}` : "-"}
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
                                      <tr className="bg-amber-50 font-bold text-amber-800">
                                        <td colSpan={4} className="py-2 px-4 text-right text-xs">รวมต้นทุนทั้งสิ้น</td>
                                        <td className="py-2 px-3 text-right">฿{totalCost.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                                        <td colSpan={2}></td>
                                      </tr>
                                    </tfoot>
                                  </table>
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
            </>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600"><Plus size={18}/></div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">เพิ่มซัพพลายเออร์ใหม่</h3>
                  <p className="text-xs text-gray-400">กรอกข้อมูลผู้จำหน่ายให้ครบถ้วน</p>
                </div>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อบริษัท/ผู้จำหน่าย <span className="text-red-500">*</span></label>
                  <input type="text" required autoFocus
                    value={newData.name}
                    onChange={e => setNewData(p => ({...p, name: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    placeholder="เช่น CP Foods, Betagro Group..."/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ผู้ติดต่อ</label>
                  <input type="text"
                    value={newData.contactPerson}
                    onChange={e => setNewData(p => ({...p, contactPerson: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    placeholder="ชื่อผู้ติดต่อ..."/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทร</label>
                  <input type="text"
                    value={newData.phone}
                    onChange={e => setNewData(p => ({...p, phone: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    placeholder="02-xxx-xxxx"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                  <input type="text"
                    value={newData.taxId}
                    onChange={e => setNewData(p => ({...p, taxId: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    placeholder="13 หลัก"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">อีเมล</label>
                  <input type="email"
                    value={newData.email}
                    onChange={e => setNewData(p => ({...p, email: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    placeholder="email@company.com"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ที่อยู่</label>
                  <textarea rows={2}
                    value={newData.address}
                    onChange={e => setNewData(p => ({...p, address: e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-none"
                    placeholder="ที่อยู่สำนักงาน..."/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-60">
                  {isSaving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
                  {isSaving ? "กำลังบันทึก..." : "บันทึกซัพพลายเออร์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

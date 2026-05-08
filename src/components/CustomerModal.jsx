import { useState } from "react";
import { X, Search, UserPlus, Star, Loader2, Users } from "lucide-react";
import { postApi } from "../api";

export default function CustomerModal({ isOpen, onClose, customers, onSelectCustomer, onCustomerAdded }) {
  const [tab, setTab] = useState("search");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", taxId: "", taxAddress: "", address: "", points: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      !q ||
      String(c.Name || "").toLowerCase().includes(q) ||
      String(c.Phone || "").includes(q) ||
      String(c.TaxID || "").includes(q)
    );
  });

  const resetForm = () => {
    setForm({ name: "", phone: "", taxId: "", taxAddress: "", address: "", points: "" });
    setError("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("กรุณากรอกชื่อ-นามสกุล"); return; }
    setError("");
    setIsSaving(true);
    try {
      const res = await postApi({
        action: "saveCustomer",
        payload: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          taxId: form.taxId.trim(),
          taxAddress: form.taxAddress.trim(),
          address: form.address.trim(),
          points: parseFloat(form.points) || 0,
        }
      });
      if (res.success) {
        const newCust = {
          Name: form.name.trim(),
          Phone: form.phone.trim(),
          TaxID: form.taxId.trim(),
          TaxAddress: form.taxAddress.trim(),
          Address: form.address.trim(),
          Points: parseFloat(form.points) || 0,
        };
        onCustomerAdded(newCust);
        onSelectCustomer(newCust);
        resetForm();
        onClose();
      } else {
        setError(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setSearch("");
    setTab("search");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary" />
            <h3 className="text-lg font-bold text-gray-900">จัดการลูกค้า</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 transition-colors rounded-lg p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => { setTab("search"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "search" ? "border-b-2 border-primary text-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
          >
            ค้นหาลูกค้า
          </button>
          <button
            onClick={() => { setTab("add"); setError(""); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "add" ? "border-b-2 border-primary text-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}
          >
            เพิ่มลูกค้าใหม่
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ---- TAB: SEARCH ---- */}
          {tab === "search" && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ชื่อ / เบอร์โทร / เลขภาษี..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    ไม่พบลูกค้า
                  </div>
                ) : (
                  filtered.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { onSelectCustomer(c); handleClose(); }}
                      className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{c.Name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {c.Phone ? `โทร: ${c.Phone}` : ""}
                          {c.TaxID ? ` · Tax: ${c.TaxID}` : ""}
                        </div>
                      </div>
                      {Number(c.Points) > 0 && (
                        <span className="shrink-0 text-xs bg-yellow-50 border border-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1 font-semibold">
                          <Star size={11} /> {Number(c.Points).toLocaleString()} pts
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ---- TAB: ADD ---- */}
          {tab === "add" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชื่อ-นามสกุล / บริษัท <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="กรอกชื่อ-นามสกุลหรือชื่อบริษัท"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0XX-XXX-XXXX"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เลขประจำตัวผู้เสียภาษี</label>
                <input
                  value={form.taxId}
                  onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))}
                  placeholder="13 หลัก"
                  maxLength={13}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ที่อยู่ออกใบกำกับภาษี</label>
                <textarea
                  value={form.taxAddress}
                  onChange={e => setForm(p => ({ ...p, taxAddress: e.target.value }))}
                  placeholder="ที่อยู่สำหรับออกใบกำกับภาษี"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ที่อยู่จริง</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="ที่อยู่ที่พักอาศัยจริง (ถ้าต่างจากที่อยู่ภาษี)"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">จำนวนพ้อย (Points)</label>
                <input
                  type="number"
                  value={form.points}
                  onChange={e => setForm(p => ({ ...p, points: e.target.value }))}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><UserPlus size={16} /> บันทึกลูกค้า</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

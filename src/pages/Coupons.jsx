import { useState, useEffect } from "react";
import {
  Ticket, Plus, Edit2, ToggleLeft, ToggleRight,
  X, Check, Loader2, Gift, Users, Star, ChevronDown,
} from "lucide-react";
import { fetchApi, postApi } from "../api";

const EMPTY_FORM = {
  name: "",
  type: "FIXED_AMOUNT",
  value: "",
  price: "",
  minOrderAmount: "",
  description: "",
  status: "ACTIVE",
  freeItemBarcode: "",
  freeItemName: "",
};

function Badge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
      <Check size={11} /> ใช้งาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      <X size={11} /> ปิด
    </span>
  );
}

export default function Coupons() {
  const [tab, setTab] = useState("coupons"); // "coupons" | "issue"
  const [templates, setTemplates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Issue tab
  const [issueCustomer, setIssueCustomer] = useState("");
  const [issueCouponId, setIssueCouponId] = useState("");
  const [issueQty, setIssueQty] = useState(1);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState("");
  const [issueError, setIssueError] = useState("");

  // ---- Load data ----
  const loadAll = async () => {
    setIsLoading(true);
    const [tmpl, custs, prods] = await Promise.all([
      fetchApi("getCoupons"),
      fetchApi("getCustomers"),
      fetchApi("getProducts"),
    ]);
    setTemplates(Array.isArray(tmpl) ? tmpl : []);
    setCustomers(Array.isArray(custs) ? custs : []);
    setProducts(Array.isArray(prods) ? prods : []);
    setIsLoading(false);
  };

  // ---- Barcode lookup ----
  const lookupBarcode = (barcode) => {
    const b = barcode.trim();
    if (!b) return;
    const found = products.find(p => String(p.Barcode || "").trim() === b);
    if (found) {
      setForm(prev => ({ ...prev, freeItemName: found.Name || found.name || "" }));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---- Coupon template modal ----
  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.Name || "",
      type: item.Type || "FIXED_AMOUNT",
      value: String(item.Value || ""),
      price: String(item.Price || ""),
      minOrderAmount: String(item.MinOrderAmount || ""),
      description: item.Description || "",
      status: item.Status || "ACTIVE",
      freeItemBarcode: item.FreeItemBarcode || "",
      freeItemName: item.FreeItemName || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("กรุณากรอกชื่อคูปอง");
      return;
    }
    if (form.type !== "FREE_ITEM" && !form.value) {
      alert("กรุณากรอกมูลค่าส่วนลด");
      return;
    }
    if (form.type === "FREE_ITEM" && !form.freeItemName.trim()) {
      alert("กรุณากรอกชื่อสินค้าที่ให้ฟรี");
      return;
    }
    setIsSaving(true);
    const res = await postApi({
      action: "saveCoupon",
      payload: {
        couponId: editItem?.CouponID || "",
        name: form.name.trim(),
        type: form.type,
        value: form.type === "FREE_ITEM" ? 0 : (parseFloat(form.value) || 0),
        price: parseFloat(form.price) || 0,
        minOrderAmount: parseFloat(form.minOrderAmount) || 0,
        description: form.description.trim(),
        status: form.status,
        freeItemBarcode: form.freeItemBarcode.trim(),
        freeItemName: form.freeItemName.trim(),
      },
    });
    setIsSaving(false);
    if (res.success) {
      setShowModal(false);
      loadAll();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "ไม่ทราบสาเหตุ"));
    }
  };

  const handleToggle = async (item) => {
    const newStatus = item.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.CouponID === item.CouponID ? { ...t, Status: newStatus } : t))
    );
    await postApi({
      action: "saveCoupon",
      payload: {
        couponId: item.CouponID,
        name: item.Name,
        type: item.Type,
        value: item.Value,
        price: item.Price,
        minOrderAmount: item.MinOrderAmount,
        description: item.Description,
        status: newStatus,
        freeItemBarcode: item.FreeItemBarcode || "",
        freeItemName: item.FreeItemName || "",
      },
    });
    loadAll();
  };

  // ---- Issue coupon ----
  const selectedCouponTemplate = templates.find((t) => t.CouponID === issueCouponId);
  const selectedCustomer = customers.find((c) => c.Name === issueCustomer);

  const handleIssueCoupon = async () => {
    if (!issueCustomer || !issueCouponId) {
      setIssueError("กรุณาเลือกลูกค้าและคูปอง");
      return;
    }
    setIsIssuing(true);
    setIssueSuccess("");
    setIssueError("");
    const qty = Math.max(1, Math.min(50, parseInt(issueQty) || 1));
    const res = await postApi({
      action: "issueCoupon",
      payload: {
        customerName: issueCustomer,
        couponId: issueCouponId,
        price: 0,
        quantity: qty,
      },
    });
    setIsIssuing(false);
    if (res.success) {
      const custLabel = selectedCustomer?.Name || issueCustomer;
      const couponLabel = selectedCouponTemplate?.Name || issueCouponId;
      const expiry = selectedCouponTemplate?.ExpiryDays
        ? ` (หมดอายุใน ${selectedCouponTemplate.ExpiryDays} วัน)`
        : "";
      const countLabel = qty > 1 ? ` จำนวน ${qty} ใบ` : "";
      setIssueSuccess(
        `ออกคูปอง "${couponLabel}"${countLabel} ให้ ${custLabel} สำเร็จ!${expiry}`
      );
      setIssueCustomer("");
      setIssueCouponId("");
      setIssueQty(1);
    } else {
      setIssueError("เกิดข้อผิดพลาด: " + (res.error || "ไม่ทราบสาเหตุ"));
    }
  };

  // ---- Type label helper ----
  const typeLabel = (type) =>
    type === "PERCENT" ? "ลด%" : type === "FIXED_AMOUNT" ? "ลดเงิน" : type === "FREE_ITEM" ? "ของแถม" : type || "-";

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Ticket className="text-violet-600" /> จัดการคูปอง (Coupons)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            สร้างและออกคูปองส่วนลดให้ลูกค้า
          </p>
        </div>

        {tab === "coupons" && (
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus size={16} /> สร้างคูปองใหม่
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "coupons", label: "คูปอง", icon: <Ticket size={15} /> },
          { key: "issue", label: "ออกคูปอง", icon: <Gift size={15} /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-white shadow text-violet-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: COUPONS ── */}
      {tab === "coupons" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                <Loader2 size={36} className="animate-spin text-violet-400" />
                <span className="text-sm">กำลังโหลดข้อมูลคูปอง...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                <Ticket size={48} className="opacity-20" />
                <span className="text-sm">ยังไม่มีคูปอง กดสร้างใหม่ได้เลย!</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-violet-50/60 sticky top-0 z-10">
                  <tr className="border-b border-violet-100 text-sm font-semibold text-violet-800">
                    <th className="py-3 px-6">ชื่อคูปอง</th>
                    <th className="py-3 px-4">ประเภท</th>
                    <th className="py-3 px-4 text-right">มูลค่า</th>
                    <th className="py-3 px-4 text-right">ราคาซื้อ</th>
                    <th className="py-3 px-4 text-right">ขั้นต่ำ</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {templates.map((item, idx) => (
                    <tr
                      key={item.CouponID || idx}
                      className={`hover:bg-violet-50/20 transition-colors text-sm ${
                        item.Status !== "ACTIVE" ? "opacity-55 bg-gray-50" : ""
                      }`}
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-900">{item.Name || "-"}</div>
                        {item.Description && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.Description}</div>
                        )}
                        {item.CouponID && (
                          <div className="text-[10px] font-mono text-gray-300 mt-0.5">
                            {item.CouponID}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            item.Type === "PERCENT"
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : item.Type === "FREE_ITEM"
                              ? "bg-green-50 text-green-700 border-green-100"
                              : "bg-violet-50 text-violet-700 border-violet-100"
                          }`}
                        >
                          {item.Type === "PERCENT" ? (
                            <Star size={11} />
                          ) : item.Type === "FREE_ITEM" ? (
                            <Gift size={11} />
                          ) : (
                            <Ticket size={11} />
                          )}
                          {typeLabel(item.Type)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900">
                        {item.Type === "PERCENT"
                          ? `${Number(item.Value || 0).toLocaleString()}%`
                          : item.Type === "FREE_ITEM"
                          ? <span className="text-green-700 text-xs">{item.FreeItemName || "-"}</span>
                          : `฿${Number(item.Value || 0).toLocaleString()}`}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-600">
                        {Number(item.Price || 0) > 0
                          ? `฿${Number(item.Price).toLocaleString()}`
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-600">
                        {Number(item.MinOrderAmount || 0) > 0
                          ? `฿${Number(item.MinOrderAmount).toLocaleString()}`
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggle(item)}
                          title={item.Status === "ACTIVE" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          className="transition-colors"
                        >
                          {item.Status === "ACTIVE" ? (
                            <ToggleRight size={26} className="text-emerald-500" />
                          ) : (
                            <ToggleLeft size={26} className="text-gray-300" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: ISSUE COUPON ── */}
      {tab === "issue" && (
        <div className="max-w-lg">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Gift size={20} className="text-violet-500" />
              <h3 className="font-bold text-gray-900 text-base">ออกคูปองให้ลูกค้า</h3>
            </div>

            {/* Select customer */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Users size={13} /> เลือกลูกค้า <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={issueCustomer}
                  onChange={(e) => {
                    setIssueCustomer(e.target.value);
                    setIssueSuccess("");
                    setIssueError("");
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                >
                  <option value="">-- เลือกลูกค้า --</option>
                  {customers.map((c, i) => (
                    <option key={i} value={c.Name}>
                      {c.Name}
                      {c.Phone ? ` (${c.Phone})` : ""}
                      {Number(c.Points) > 0 ? ` · ${Number(c.Points).toLocaleString()} pts` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            {/* Select coupon */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Ticket size={13} /> เลือกคูปอง <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={issueCouponId}
                  onChange={(e) => {
                    setIssueCouponId(e.target.value);
                    setIssueSuccess("");
                    setIssueError("");
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                >
                  <option value="">-- เลือกคูปอง --</option>
                  {templates
                    .filter((t) => t.Status === "ACTIVE")
                    .map((t, i) => (
                      <option key={i} value={t.CouponID}>
                        {t.Name} —{" "}
                        {t.Type === "PERCENT"
                          ? `ลด ${t.Value}%`
                          : t.Type === "FREE_ITEM"
                          ? `ของแถม: ${t.FreeItemName || "-"}`
                          : `ลด ฿${Number(t.Value || 0).toLocaleString()}`}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <Star size={13} /> จำนวนคูปอง (ใบ)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={issueQty}
                onChange={(e) => {
                  setIssueQty(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)));
                  setIssueSuccess(""); setIssueError("");
                }}
                className="w-32 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
              />
              <span className="ml-2 text-xs text-gray-400">สูงสุด 50 ใบ</span>
            </div>

            {/* Preview */}
            {issueCustomer && issueCouponId && selectedCouponTemplate && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm space-y-1">
                <div className="font-semibold text-violet-800 flex items-center gap-1.5">
                  <Gift size={14} /> สรุปการออกคูปอง
                </div>
                <div className="text-gray-700">
                  ลูกค้า:{" "}
                  <span className="font-semibold">{issueCustomer}</span>
                </div>
                <div className="text-gray-700">
                  คูปอง:{" "}
                  <span className="font-semibold">{selectedCouponTemplate.Name}</span>
                  {" — "}
                  {selectedCouponTemplate.Type === "PERCENT"
                    ? `ลด ${selectedCouponTemplate.Value}%`
                    : selectedCouponTemplate.Type === "FREE_ITEM"
                    ? `ของแถม: ${selectedCouponTemplate.FreeItemName || "-"}`
                    : `ลด ฿${Number(selectedCouponTemplate.Value || 0).toLocaleString()}`}
                </div>
                {issueQty > 1 && (
                  <div className="text-violet-700 text-xs font-semibold">
                    จำนวน {issueQty} ใบ
                  </div>
                )}
                {selectedCouponTemplate.ExpiryDays && (
                  <div className="text-gray-500 text-xs">
                    หมดอายุใน {selectedCouponTemplate.ExpiryDays} วัน
                  </div>
                )}
                <div className="text-violet-600 text-xs font-medium">
                  ออกให้ฟรี (ไม่มีค่าใช้จ่าย)
                </div>
              </div>
            )}

            {/* Success */}
            {issueSuccess && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                {issueSuccess}
              </div>
            )}

            {/* Error */}
            {issueError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <X size={16} className="mt-0.5 shrink-0" />
                {issueError}
              </div>
            )}

            {/* Issue button */}
            <button
              onClick={handleIssueCoupon}
              disabled={isIssuing || !issueCustomer || !issueCouponId}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isIssuing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> กำลังออกคูปอง...
                </>
              ) : (
                <>
                  <Gift size={16} /> ออกคูปองให้ลูกค้า
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Ticket size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editItem ? "แก้ไขคูปอง" : "สร้างคูปองใหม่"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    กำหนดมูลค่าและเงื่อนไขการใช้งาน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal form */}
            <form
              onSubmit={handleSave}
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  ชื่อคูปอง <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="เช่น ลด 50 บาท"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white transition-all"
                />
              </div>

              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    ประเภท <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value, value: "" }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                  >
                    <option value="FIXED_AMOUNT">ลดเงิน (฿)</option>
                    <option value="PERCENT">ลดเปอร์เซ็นต์ (%)</option>
                    <option value="FREE_ITEM">สินค้าฟรี (ของแถม)</option>
                  </select>
                </div>
                {form.type !== "FREE_ITEM" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      มูลค่า <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={form.type === "PERCENT" ? 100 : undefined}
                      value={form.value}
                      onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                      placeholder={form.type === "PERCENT" ? "เช่น 10" : "เช่น 50"}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Free item fields */}
              {form.type === "FREE_ITEM" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      บาร์โค้ดสินค้าฟรี
                    </label>
                    <input
                      type="text"
                      value={form.freeItemBarcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((p) => ({ ...p, freeItemBarcode: val }));
                        lookupBarcode(val);
                      }}
                      onBlur={(e) => lookupBarcode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupBarcode(form.freeItemBarcode); } }}
                      placeholder="สแกนหรือพิมพ์บาร์โค้ด"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      ชื่อสินค้าฟรี <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.freeItemName}
                      onChange={(e) => setForm((p) => ({ ...p, freeItemName: e.target.value }))}
                      placeholder="เช่น อาหารแมว 1 ถุง"
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all ${
                        form.freeItemName ? "bg-green-50 border-green-200 text-green-800 font-semibold" : "bg-gray-50 border-gray-200 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Price + MinOrderAmount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    ราคาที่ลูกค้าต้องจ่าย (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    placeholder="0 = ฟรี"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    ยอดขั้นต่ำ (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, minOrderAmount: e.target.value }))
                    }
                    placeholder="0 = ไม่กำหนด"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  รายละเอียด
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50 focus:bg-white"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  สถานะ
                </label>
                <div className="flex gap-3">
                  {["ACTIVE", "INACTIVE"].map((s) => (
                    <label
                      key={s}
                      className={`flex-1 flex items-center gap-2 border px-4 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all ${
                        form.status === s
                          ? "border-violet-500 bg-violet-50 text-violet-800 ring-1 ring-violet-500"
                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        className="w-4 h-4 text-violet-600"
                        checked={form.status === s}
                        onChange={() => setForm((p) => ({ ...p, status: s }))}
                      />
                      {s === "ACTIVE" ? (
                        <>
                          <Badge active /> ใช้งาน
                        </>
                      ) : (
                        <>
                          <Badge active={false} /> ปิด
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-violet-100 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> บันทึกคูปอง
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

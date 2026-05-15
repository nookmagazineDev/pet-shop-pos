import { useState, useEffect, useMemo } from "react";
import {
  Users, Search, Star, Ticket, ChevronDown, ChevronUp, Phone, MapPin, Hash,
  Loader2, Download, X, History, TrendingUp, TrendingDown, Plus, Minus,
  Scissors, Clock, Check, AlertCircle,
} from "lucide-react";
import { fetchApi, postApi, invalidateCache } from "../api";
import { exportToExcel } from "../utils/excelExport";
import toast from "react-hot-toast";

const MANUAL_REASONS = [
  "ซื้อแพคเกจพิเศษ",
  "รีวิวร้าน / Follow Social Media",
  "แนะนำลูกค้าใหม่",
  "ชดเชยความไม่สะดวก",
  "โปรโมชั่นพิเศษ",
  "อื่นๆ",
];

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("th-TH", { dateStyle: "medium" });
}

function cpStatusBadge(status) {
  const map = {
    ACTIVE:   { cls: "bg-green-50 text-green-700 border-green-100",  label: "ใช้งาน" },
    USED_UP:  { cls: "bg-gray-100 text-gray-500 border-gray-200",    label: "ใช้หมดแล้ว" },
    EXPIRED:  { cls: "bg-red-50 text-red-600 border-red-100",        label: "หมดอายุ" },
  };
  const s = map[status] || map.ACTIVE;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>;
}

export default function Members() {
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [sortPoints, setSortPoints] = useState("");
  const [creditSearch, setCreditSearch] = useState({});

  // Manual Points modal
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsTarget, setPointsTarget] = useState(null);
  const [pointsForm, setPointsForm] = useState({ delta: "", reason: MANUAL_REASONS[0], customReason: "", mode: "add" });
  const [isSavingPoints, setIsSavingPoints] = useState(false);

  const loadAll = () => {
    setIsLoading(true);
    Promise.all([
      fetchApi("getCustomers",       { skipCache: true }),
      fetchApi("getCustomerCoupons", { skipCache: true }),
      fetchApi("getPointsHistory",   { skipCache: true }),
      fetchApi("getCustomerPackages",{ skipCache: true }),
    ]).then(([custs, couponData, histData, cpData]) => {
      setCustomers(Array.isArray(custs)      ? custs          : []);
      setCoupons(Array.isArray(couponData)   ? couponData     : []);
      setPointsHistory(Array.isArray(histData) ? [...histData].reverse() : []);
      setCustomerPackages(Array.isArray(cpData) ? cpData       : []);
      setIsLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  // Pre-index credit history by customer name
  const creditHistoryByName = useMemo(() => {
    const map = {};
    pointsHistory.forEach(h => {
      const key = String(h.CustomerName || "").trim().toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [pointsHistory]);

  // Pre-index customer packages by customer name
  const cpByName = useMemo(() => {
    const map = {};
    customerPackages.forEach(cp => {
      const key = String(cp.CustomerName || "").trim().toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(cp);
    });
    return map;
  }, [customerPackages]);

  const getCreditHistory = name => creditHistoryByName[String(name || "").trim().toLowerCase()] || [];
  const getCustomerPackagesFor = name => cpByName[String(name || "").trim().toLowerCase()] || [];

  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        String(c.Name || "").toLowerCase().includes(q) ||
        String(c.Phone || "").includes(q) ||
        String(c.CustomerID || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!sortPoints) return 0;
      const pa = parseFloat(a.Points) || 0;
      const pb = parseFloat(b.Points) || 0;
      return sortPoints === "asc" ? pa - pb : pb - pa;
    });

  const getActiveCoupons = customerName =>
    coupons.filter(cc =>
      String(cc.CustomerName || "") === String(customerName || "") &&
      String(cc.Status || "").toUpperCase() === "ACTIVE"
    );

  const toggleExpand = id => setExpandedId(prev => (prev === id ? null : id));
  const cycleSortPoints = () => setSortPoints(prev => prev === "" ? "desc" : prev === "desc" ? "asc" : "");

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("ไม่มีข้อมูลที่จะส่งออก"); return; }
    const rows = filtered.map((c, i) => ({
      "ลำดับ": i + 1, "รหัสสมาชิก": c.CustomerID || "-", "ชื่อ": c.Name || "-",
      "เบอร์โทร": c.Phone || "-", "เลขภาษี": c.TaxID || "-",
      "เครดิตสะสม": parseFloat(c.Points) || 0,
      "อัพเดทเครดิตล่าสุด": formatDate(c.PointsUpdatedAt),
      "วันที่สมัคร": formatDate(c.CreatedAt),
    }));
    exportToExcel(rows, "Members", "Members_List");
  };

  // ── Manual Points ──────────────────────────────────
  const openPointsModal = (customer, e) => {
    e.stopPropagation();
    setPointsTarget(customer);
    setPointsForm({ delta: "", reason: MANUAL_REASONS[0], customReason: "", mode: "add" });
    setShowPointsModal(true);
  };

  const handleSavePoints = async () => {
    const delta = parseFloat(pointsForm.delta) || 0;
    if (delta <= 0) { toast.error("กรุณาระบุจำนวนพ้อย"); return; }
    const actualDelta = pointsForm.mode === "deduct" ? -delta : delta;
    const reason = pointsForm.reason === "อื่นๆ" ? (pointsForm.customReason.trim() || "Manual") : pointsForm.reason;
    setIsSavingPoints(true);
    const res = await postApi({
      action: "addManualPoints",
      payload: { customerName: pointsTarget.Name, points: actualDelta, reason },
    });
    setIsSavingPoints(false);
    if (res.success) {
      toast.success(res.message || "บันทึกสำเร็จ");
      invalidateCache("getCustomers");
      invalidateCache("getPointsHistory");
      loadAll();
      setShowPointsModal(false);
    } else {
      toast.error(res.error || "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> จัดการสมาชิก (Members)
          </h2>
          <p className="text-sm text-gray-500 mt-1">ดูและจัดการข้อมูลลูกค้าสมาชิกทั้งหมด</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์โทร / รหัสสมาชิก..."
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={cycleSortPoints}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${sortPoints ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-yellow-300 hover:text-yellow-600"}`}>
          <Star size={14} />
          เครดิต{sortPoints === "desc" ? " ↓ มากสุด" : sortPoints === "asc" ? " ↑ น้อยสุด" : " (เรียงลำดับ)"}
        </button>
        <div className="text-sm text-gray-400 ml-auto">
          แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> / {customers.length} สมาชิก
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
              <Loader2 size={36} className="animate-spin text-indigo-400" />
              <span className="text-sm">กำลังโหลดข้อมูลสมาชิก...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
              <Users size={48} className="opacity-20" />
              <span className="text-sm">{search ? "ไม่พบสมาชิกที่ค้นหา" : "ยังไม่มีข้อมูลสมาชิก"}</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-indigo-50/60 sticky top-0 z-10">
                <tr className="border-b border-indigo-100 text-sm font-semibold text-indigo-800">
                  <th className="py-3 px-6">ชื่อ</th>
                  <th className="py-3 px-4">เบอร์โทร</th>
                  <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-indigo-100/60" onClick={cycleSortPoints}>
                    <span className="flex items-center justify-end gap-1">เครดิตสะสม {sortPoints === "desc" ? "↓" : sortPoints === "asc" ? "↑" : "↕"}</span>
                  </th>
                  <th className="py-3 px-4">แพคเกจครั้ง</th>
                  <th className="py-3 px-4">วันที่สมัคร</th>
                  <th className="py-3 px-4 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const rowId     = c.CustomerID || c.Name || idx;
                  const isExpanded = expandedId === rowId;
                  const activeCoupons   = getActiveCoupons(c.Name);
                  const custPackages    = getCustomerPackagesFor(c.Name);
                  const activePackages  = custPackages.filter(cp => cp.Status === "ACTIVE");

                  return [
                    /* Main row */
                    <tr key={`row-${rowId}`} onClick={() => toggleExpand(rowId)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-indigo-50/30 ${isExpanded ? "bg-indigo-50/40" : ""}`}>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-gray-900 text-sm">{c.Name || "-"}</div>
                        {c.CustomerID && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.CustomerID}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-600">{c.Phone || "-"}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Star size={11} /> {Number(c.Points || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {activePackages.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {activePackages.slice(0, 2).map((cp, pi) => {
                              const remaining = (parseInt(cp.TotalSessions) || 0) - (parseInt(cp.UsedSessions) || 0);
                              return (
                                <span key={pi} className="inline-flex items-center gap-1 text-xs bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                  <Scissors size={10} /> {remaining} ครั้ง
                                </span>
                              );
                            })}
                            {activePackages.length > 2 && <span className="text-xs text-gray-400">+{activePackages.length - 2}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{formatDate(c.CreatedAt)}</td>
                      <td className="py-3.5 px-4 text-center text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>,

                    /* Expanded row */
                    isExpanded && (
                      <tr key={`detail-${rowId}`} className="bg-indigo-50/20">
                        <td colSpan={6} className="px-6 pt-2 pb-5">
                          <div className="space-y-4">

                            {/* Row 1: info + coupons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Info card */}
                              <div className="bg-white border border-indigo-100 rounded-2xl p-5 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                                  <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
                                    <Users size={14} /> ข้อมูลสมาชิก
                                  </h4>
                                  {/* Manual points button */}
                                  <button onClick={e => openPointsModal(c, e)}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors">
                                    <Star size={12} /> เพิ่ม/หักพ้อย
                                  </button>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <InfoRow icon={<Hash size={13} />} label="รหัสสมาชิก" value={c.CustomerID || "-"} mono />
                                  <InfoRow icon={<Users size={13} />} label="ชื่อ"         value={c.Name || "-"} />
                                  <InfoRow icon={<Phone size={13} />} label="เบอร์โทร"     value={c.Phone || "-"} />
                                  <InfoRow icon={<Hash size={13} />} label="เลขภาษี"       value={c.TaxID || "-"} mono />
                                  <InfoRow icon={<MapPin size={13} />} label="ที่อยู่ภาษี" value={c.TaxAddress || "-"} />
                                  <InfoRow icon={<MapPin size={13} />} label="ที่อยู่"      value={c.Address || "-"} />
                                  <InfoRow icon={<Star size={13} />}  label="เครดิตสะสม"
                                    value={<span className="font-bold text-yellow-600">{Number(c.Points || 0).toLocaleString()} pts</span>} />
                                  <InfoRow icon={<Star size={13} />}  label="อัพเดทล่าสุด" value={formatDate(c.PointsUpdatedAt)} />
                                  <InfoRow icon={<Users size={13} />} label="วันที่สมัคร"  value={formatDate(c.CreatedAt)} />
                                </div>
                              </div>

                              {/* Coupons + Session Packages */}
                              <div className="space-y-4">
                                {/* Active coupons */}
                                <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col">
                                  <h4 className="text-sm font-bold text-indigo-800 border-b border-indigo-50 pb-2 flex items-center gap-1.5 shrink-0">
                                    <Ticket size={14} /> คูปองที่ยังใช้ได้
                                    {activeCoupons.length > 0 && (
                                      <span className="ml-auto bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{activeCoupons.length}</span>
                                    )}
                                  </h4>
                                  {activeCoupons.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-gray-400">
                                      <Ticket size={28} className="opacity-20 mb-1.5" />
                                      <span className="text-xs">ไม่มีคูปองที่ใช้งานได้</span>
                                    </div>
                                  ) : (
                                    <div className="mt-3 space-y-2 overflow-y-auto max-h-40">
                                      {activeCoupons.map((cc, ci) => (
                                        <div key={ci} className="flex items-start justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl px-3.5 py-3">
                                          <div className="min-w-0">
                                            <div className="font-semibold text-gray-900 text-sm truncate">{cc.CouponName || cc.CouponID || "คูปอง"}</div>
                                            {cc.ExpiryDate && <div className="text-[11px] text-gray-400 mt-0.5">หมดอายุ: {formatDate(cc.ExpiryDate)}</div>}
                                          </div>
                                          <span className="shrink-0 text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">ใช้ได้</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Session packages */}
                                {custPackages.length > 0 && (
                                  <div className="bg-white border border-violet-100 rounded-2xl p-5 shadow-sm">
                                    <h4 className="text-sm font-bold text-violet-800 border-b border-violet-50 pb-2 flex items-center gap-1.5 mb-3">
                                      <Scissors size={14} /> แพคเกจครั้งของลูกค้า
                                      <span className="ml-auto bg-violet-100 text-violet-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{custPackages.length}</span>
                                    </h4>
                                    <div className="space-y-2 max-h-52 overflow-y-auto">
                                      {custPackages.map((cp, pi) => {
                                        const total     = parseInt(cp.TotalSessions) || 0;
                                        const used      = parseInt(cp.UsedSessions) || 0;
                                        const remaining = total - used;
                                        const pct       = total > 0 ? Math.round((used / total) * 100) : 0;
                                        const isExpired = cp.ExpiryDate && new Date(cp.ExpiryDate) < new Date();
                                        const status    = isExpired && cp.Status === "ACTIVE" ? "EXPIRED" : (cp.Status || "ACTIVE");
                                        return (
                                          <div key={pi} className={`rounded-xl border p-3 ${status === "ACTIVE" ? "border-violet-100 bg-violet-50/40" : "border-gray-100 bg-gray-50/50 opacity-60"}`}>
                                            <div className="flex items-start justify-between gap-2">
                                              <div>
                                                <div className="font-semibold text-violet-900 text-xs">{cp.PackageName || "-"}</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                                  <Clock size={10} /> หมดอายุ: {fmtDate(cp.ExpiryDate)}
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <div className={`font-bold text-sm ${remaining === 0 ? "text-gray-400" : remaining <= 1 ? "text-red-500" : "text-violet-700"}`}>
                                                  {remaining}<span className="text-xs font-normal text-gray-400">/{total}</span>
                                                </div>
                                                {cpStatusBadge(status)}
                                              </div>
                                            </div>
                                            <div className="mt-2 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                              <div className={`h-full rounded-full ${pct >= 100 ? "bg-gray-400" : pct >= 70 ? "bg-red-400" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Credit history */}
                            {(() => {
                              const history = getCreditHistory(c.Name);
                              const cKey    = rowId;
                              const cq      = (creditSearch[cKey] || "").toLowerCase().trim();
                              const visible = cq
                                ? history.filter(h =>
                                    String(h.Reference || "").toLowerCase().includes(cq) ||
                                    String(h.Type || "").toLowerCase().includes(cq) ||
                                    String(h.Points || "").includes(cq)
                                  )
                                : history;
                              const earnTotal   = history.filter(h => h.Type === "EARN" || h.Type === "MANUAL_ADD").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
                              const redeemTotal = history.filter(h => h.Type !== "EARN" && h.Type !== "MANUAL_ADD").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
                              return (
                                <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm overflow-hidden">
                                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-indigo-50 bg-indigo-50/40">
                                    <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
                                      <History size={14} /> ประวัติการใช้งานเครดิต
                                      <span className="ml-1 bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{history.length} รายการ</span>
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                                        <TrendingUp size={11} /> รับ +{earnTotal.toLocaleString()}
                                      </span>
                                      <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">
                                        <TrendingDown size={11} /> ใช้ -{redeemTotal.toLocaleString()}
                                      </span>
                                      <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full">
                                        <Star size={11} /> คงเหลือ {Number(c.Points || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  {history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                                      <History size={32} className="opacity-20" />
                                      <span className="text-xs">ยังไม่มีประวัติการใช้งานเครดิต</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="px-5 py-2.5 border-b border-gray-50 bg-gray-50/50">
                                        <div className="relative max-w-xs">
                                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                          <input value={creditSearch[cKey] || ""}
                                            onChange={e => setCreditSearch(prev => ({ ...prev, [cKey]: e.target.value }))}
                                            onClick={e => e.stopPropagation()}
                                            placeholder="ค้นหาประเภท / หมายเหตุ..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white" />
                                        </div>
                                      </div>
                                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-gray-50 sticky top-0">
                                            <tr className="border-b border-gray-100 text-gray-500 font-semibold">
                                              <th className="py-2 px-4">วันที่ / เวลา</th>
                                              <th className="py-2 px-4 text-center">ประเภท</th>
                                              <th className="py-2 px-4 text-right">เครดิต</th>
                                              <th className="py-2 px-4 text-right">คงเหลือ</th>
                                              <th className="py-2 px-4">หมายเหตุ / อ้างอิง</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-50">
                                            {visible.length === 0 ? (
                                              <tr><td colSpan={5} className="py-6 text-center text-gray-400">ไม่พบรายการที่ค้นหา</td></tr>
                                            ) : (
                                              visible.map((h, hi) => {
                                                const isEarn = h.Type === "EARN" || h.Type === "MANUAL_ADD";
                                                return (
                                                  <tr key={hi} className={isEarn ? "hover:bg-emerald-50/30" : "hover:bg-red-50/30"}>
                                                    <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                                      {h.Date ? new Date(h.Date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-"}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                      {isEarn ? (
                                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                          <TrendingUp size={9} /> รับเครดิต
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                                                          <TrendingDown size={9} /> ใช้เครดิต
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className={`py-2.5 px-4 text-right font-bold ${isEarn ? "text-emerald-600" : "text-red-500"}`}>
                                                      {isEarn ? "+" : "-"}{(parseFloat(h.Points) || 0).toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-semibold text-gray-700">
                                                      {h.Balance != null ? Number(h.Balance).toLocaleString() : "-"}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-gray-500 max-w-[200px] truncate" title={h.Reference || ""}>
                                                      {h.Reference || <span className="text-gray-300">-</span>}
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ MODAL: Manual Points ══════════════════════════ */}
      {showPointsModal && pointsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Star size={18} className="text-yellow-500" /> เพิ่ม / หักพ้อย
              </h3>
              <button onClick={() => setShowPointsModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Customer info */}
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900">{pointsTarget.Name}</div>
                  <div className="text-xs text-gray-500">{pointsTarget.Phone || "-"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">พ้อยปัจจุบัน</div>
                  <div className="font-bold text-yellow-600 text-lg flex items-center gap-1">
                    <Star size={14} /> {Number(pointsTarget.Points || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Add / Deduct toggle */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">ประเภท</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPointsForm(p => ({ ...p, mode: "add" }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${pointsForm.mode === "add" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
                    <Plus size={14} /> เพิ่มพ้อย
                  </button>
                  <button type="button" onClick={() => setPointsForm(p => ({ ...p, mode: "deduct" }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${pointsForm.mode === "deduct" ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-500"}`}>
                    <Minus size={14} /> หักพ้อย
                  </button>
                </div>
              </div>

              {/* Points amount */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">จำนวนพ้อย <span className="text-red-500">*</span></label>
                <input type="number" value={pointsForm.delta}
                  onChange={e => setPointsForm(p => ({ ...p, delta: e.target.value }))}
                  placeholder="50" min="1"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400" />
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เหตุผล</label>
                <select value={pointsForm.reason} onChange={e => setPointsForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400">
                  {MANUAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {pointsForm.reason === "อื่นๆ" && (
                  <input value={pointsForm.customReason}
                    onChange={e => setPointsForm(p => ({ ...p, customReason: e.target.value }))}
                    placeholder="ระบุเหตุผล..."
                    className="mt-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400" />
                )}
              </div>

              {/* Preview */}
              {pointsForm.delta && parseFloat(pointsForm.delta) > 0 && (
                <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${pointsForm.mode === "add" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                  <AlertCircle size={13} />
                  พ้อยจะเป็น {(Number(pointsTarget.Points || 0) + (pointsForm.mode === "add" ? 1 : -1) * parseFloat(pointsForm.delta)).toLocaleString()} หลังบันทึก
                </div>
              )}

              <button onClick={handleSavePoints} disabled={isSavingPoints}
                className={`w-full py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${pointsForm.mode === "add" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-500 hover:bg-red-600"}`}>
                {isSavingPoints ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> ยืนยัน{pointsForm.mode === "add" ? "เพิ่ม" : "หัก"}พ้อย</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-indigo-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className={`text-gray-900 font-medium break-words min-w-0 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

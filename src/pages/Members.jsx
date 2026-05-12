import { useState, useEffect, useMemo } from "react";
import { Users, Search, Star, Ticket, ChevronDown, ChevronUp, Phone, MapPin, Hash, Loader2, Download, X, History, TrendingUp, TrendingDown } from "lucide-react";
import { fetchApi } from "../api";
import { exportToExcel } from "../utils/excelExport";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function Members() {
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [sortPoints, setSortPoints] = useState(""); // "" | "asc" | "desc"
  const [creditSearch, setCreditSearch] = useState({}); // { [customerId]: searchStr }

  useEffect(() => {
    Promise.all([
      fetchApi("getCustomers"),
      fetchApi("getCustomerCoupons"),
      fetchApi("getPointsHistory"),
    ]).then(([custs, couponData, histData]) => {
      setCustomers(Array.isArray(custs) ? custs : []);
      setCoupons(Array.isArray(couponData) ? couponData : []);
      setPointsHistory(Array.isArray(histData) ? [...histData].reverse() : []);
      setIsLoading(false);
    });
  }, []);

  // Pre-index credit history by customer name (lowercase) for fast lookup
  const creditHistoryByName = useMemo(() => {
    const map = {};
    pointsHistory.forEach(h => {
      const key = String(h.CustomerName || "").trim().toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [pointsHistory]);

  const getCreditHistory = (name) =>
    creditHistoryByName[String(name || "").trim().toLowerCase()] || [];

  const filtered = customers
    .filter((c) => {
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

  const getActiveCoupons = (customerName) =>
    coupons.filter(
      (cc) =>
        String(cc.CustomerName || "") === String(customerName || "") &&
        String(cc.Status || "").toUpperCase() === "ACTIVE"
    );

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const cycleSortPoints = () => {
    setSortPoints(prev => prev === "" ? "desc" : prev === "desc" ? "asc" : "");
  };

  const handleExport = () => {
    if (filtered.length === 0) { alert("ไม่มีข้อมูลที่จะส่งออก"); return; }
    const rows = filtered.map((c, i) => ({
      "ลำดับ": i + 1,
      "รหัสสมาชิก": c.CustomerID || "-",
      "ชื่อ": c.Name || "-",
      "เบอร์โทร": c.Phone || "-",
      "เลขภาษี": c.TaxID || "-",
      "เครดิตสะสม": parseFloat(c.Points) || 0,
      "อัพเดทเครดิตล่าสุด": formatDate(c.PointsUpdatedAt),
      "วันที่สมัคร": formatDate(c.CreatedAt),
    }));
    exportToExcel(rows, "Members", "Members_List");
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> จัดการสมาชิก (Members)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ดูและจัดการข้อมูลลูกค้าสมาชิกทั้งหมด
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์โทร / รหัสสมาชิก..."
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort by points */}
        <button
          onClick={cycleSortPoints}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            sortPoints
              ? "border-yellow-400 bg-yellow-50 text-yellow-700"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-yellow-300 hover:text-yellow-600"
          }`}
        >
          <Star size={14} />
          เครดิต{sortPoints === "desc" ? " ↓ มากสุด" : sortPoints === "asc" ? " ↑ น้อยสุด" : " (เรียงลำดับ)"}
        </button>

        <div className="text-sm text-gray-400 ml-auto">
          แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> / {customers.length} สมาชิก
        </div>
      </div>

      {/* Table card */}
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
              <span className="text-sm">
                {search ? "ไม่พบสมาชิกที่ค้นหา" : "ยังไม่มีข้อมูลสมาชิก"}
              </span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-indigo-50/60 sticky top-0 z-10">
                <tr className="border-b border-indigo-100 text-sm font-semibold text-indigo-800">
                  <th className="py-3 px-6">ชื่อ</th>
                  <th className="py-3 px-4">เบอร์โทร</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer select-none hover:bg-indigo-100/60 transition-colors"
                    onClick={cycleSortPoints}
                    title="คลิกเพื่อเรียงลำดับ"
                  >
                    <span className="flex items-center justify-end gap-1">
                      เครดิตสะสม
                      {sortPoints === "desc" ? " ↓" : sortPoints === "asc" ? " ↑" : " ↕"}
                    </span>
                  </th>
                  <th className="py-3 px-4">อัพเดทเครดิตล่าสุด</th>
                  <th className="py-3 px-4">วันที่สมัคร</th>
                  <th className="py-3 px-4 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const rowId = c.CustomerID || c.Name || idx;
                  const isExpanded = expandedId === rowId;
                  const activeCoupons = getActiveCoupons(c.Name);

                  return [
                    /* Main row */
                    <tr
                      key={`row-${rowId}`}
                      onClick={() => toggleExpand(rowId)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-indigo-50/30 ${
                        isExpanded ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-gray-900 text-sm">{c.Name || "-"}</div>
                        {c.CustomerID && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.CustomerID}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-600">{c.Phone || "-"}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Star size={11} />
                          {Number(c.Points || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{formatDate(c.PointsUpdatedAt)}</td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{formatDate(c.CreatedAt)}</td>
                      <td className="py-3.5 px-4 text-center text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>,

                    /* Expanded detail row */
                    isExpanded && (
                      <tr key={`detail-${rowId}`} className="bg-indigo-50/20">
                        <td colSpan={6} className="px-6 pt-2 pb-5">
                          <div className="space-y-4">
                            {/* Row 1: info + coupons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Info card */}
                              <div className="bg-white border border-indigo-100 rounded-2xl p-5 space-y-3 shadow-sm">
                                <h4 className="text-sm font-bold text-indigo-800 border-b border-indigo-50 pb-2 flex items-center gap-1.5">
                                  <Users size={14} /> ข้อมูลสมาชิก
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <InfoRow icon={<Hash size={13} />} label="รหัสสมาชิก" value={c.CustomerID || "-"} mono />
                                  <InfoRow icon={<Users size={13} />} label="ชื่อ" value={c.Name || "-"} />
                                  <InfoRow icon={<Phone size={13} />} label="เบอร์โทร" value={c.Phone || "-"} />
                                  <InfoRow icon={<Hash size={13} />} label="เลขภาษี" value={c.TaxID || "-"} mono />
                                  <InfoRow icon={<MapPin size={13} />} label="ที่อยู่ภาษี" value={c.TaxAddress || "-"} />
                                  <InfoRow icon={<MapPin size={13} />} label="ที่อยู่" value={c.Address || "-"} />
                                  <InfoRow
                                    icon={<Star size={13} />}
                                    label="เครดิตสะสม"
                                    value={<span className="font-bold text-yellow-600">{Number(c.Points || 0).toLocaleString()} pts</span>}
                                  />
                                  <InfoRow icon={<Star size={13} />} label="อัพเดทล่าสุด" value={formatDate(c.PointsUpdatedAt)} />
                                  <InfoRow icon={<Users size={13} />} label="วันที่สมัคร" value={formatDate(c.CreatedAt)} />
                                </div>
                              </div>

                              {/* Active coupons card */}
                              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col">
                                <h4 className="text-sm font-bold text-indigo-800 border-b border-indigo-50 pb-2 flex items-center gap-1.5 shrink-0">
                                  <Ticket size={14} /> คูปองที่ยังใช้ได้
                                  {activeCoupons.length > 0 && (
                                    <span className="ml-auto bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                      {activeCoupons.length}
                                    </span>
                                  )}
                                </h4>
                                {activeCoupons.length === 0 ? (
                                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-gray-400">
                                    <Ticket size={32} className="opacity-20 mb-2" />
                                    <span className="text-xs">ไม่มีคูปองที่ใช้งานได้</span>
                                  </div>
                                ) : (
                                  <div className="mt-3 space-y-2 overflow-y-auto max-h-52">
                                    {activeCoupons.map((cc, ci) => (
                                      <div key={ci} className="flex items-start justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl px-3.5 py-3">
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-900 text-sm truncate">{cc.CouponName || cc.CouponID || "คูปอง"}</div>
                                          {cc.ExpiryDate && <div className="text-[11px] text-gray-400 mt-0.5">หมดอายุ: {formatDate(cc.ExpiryDate)}</div>}
                                          {cc.CouponID && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{cc.CouponID}</div>}
                                        </div>
                                        <span className="shrink-0 text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">ใช้ได้</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Credit history card (full width) */}
                            {(() => {
                              const history = getCreditHistory(c.Name);
                              const cKey = rowId;
                              const cq = (creditSearch[cKey] || "").toLowerCase().trim();
                              const visibleHistory = cq
                                ? history.filter(h =>
                                    String(h.Reference || "").toLowerCase().includes(cq) ||
                                    String(h.Type || "").toLowerCase().includes(cq) ||
                                    String(h.Points || "").includes(cq)
                                  )
                                : history;

                              const earnTotal  = history.filter(h => h.Type === "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
                              const redeemTotal = history.filter(h => h.Type !== "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);

                              return (
                                <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm overflow-hidden">
                                  {/* Card header */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-indigo-50 bg-indigo-50/40">
                                    <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
                                      <History size={14} /> ประวัติการใช้งานเครดิต
                                      <span className="ml-1 bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                        {history.length} รายการ
                                      </span>
                                    </h4>
                                    {/* Summary badges */}
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
                                      {/* Search bar */}
                                      <div className="px-5 py-2.5 border-b border-gray-50 bg-gray-50/50">
                                        <div className="relative max-w-xs">
                                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                          <input
                                            value={creditSearch[cKey] || ""}
                                            onChange={e => setCreditSearch(prev => ({ ...prev, [cKey]: e.target.value }))}
                                            onClick={e => e.stopPropagation()}
                                            placeholder="ค้นหาประเภท / หมายเหตุ / จำนวน..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white"
                                          />
                                        </div>
                                      </div>

                                      {/* Table */}
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
                                            {visibleHistory.length === 0 ? (
                                              <tr><td colSpan={5} className="py-6 text-center text-gray-400">ไม่พบรายการที่ค้นหา</td></tr>
                                            ) : (
                                              visibleHistory.map((h, hi) => {
                                                const isEarn = h.Type === "EARN";
                                                const pts = parseFloat(h.Points) || 0;
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
                                                      {isEarn ? "+" : "-"}{pts.toLocaleString()}
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
    </div>
  );
}

function InfoRow({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-indigo-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className={`text-gray-900 font-medium break-words min-w-0 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

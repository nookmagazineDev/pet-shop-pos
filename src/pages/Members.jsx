import { useState, useEffect } from "react";
import { Users, Search, Star, Ticket, ChevronDown, ChevronUp, Phone, MapPin, Hash, Loader2 } from "lucide-react";
import { fetchApi } from "../api";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function Members() {
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchApi("getCustomers"),
      fetchApi("getCustomerCoupons"),
    ]).then(([custs, couponData]) => {
      setCustomers(Array.isArray(custs) ? custs : []);
      setCoupons(Array.isArray(couponData) ? couponData : []);
      setIsLoading(false);
    });
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      String(c.Name || "").toLowerCase().includes(q) ||
      String(c.Phone || "").includes(q) ||
      String(c.CustomerID || "").toLowerCase().includes(q)
    );
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

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์โทร / รหัสสมาชิก..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
          />
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
                  <th className="py-3 px-4 text-right">แต้มสะสม</th>
                  <th className="py-3 px-4">อัพเดทแต้มล่าสุด</th>
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
                        <div className="font-semibold text-gray-900 text-sm">
                          {c.Name || "-"}
                        </div>
                        {c.CustomerID && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {c.CustomerID}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-600">
                        {c.Phone || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Star size={11} />
                          {Number(c.Points || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">
                        {formatDate(c.PointsUpdatedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">
                        {formatDate(c.CreatedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-400">
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </td>
                    </tr>,

                    /* Expanded detail row */
                    isExpanded && (
                      <tr key={`detail-${rowId}`} className="bg-indigo-50/20">
                        <td colSpan={6} className="px-6 pt-2 pb-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Info card */}
                            <div className="bg-white border border-indigo-100 rounded-2xl p-5 space-y-3 shadow-sm">
                              <h4 className="text-sm font-bold text-indigo-800 border-b border-indigo-50 pb-2 flex items-center gap-1.5">
                                <Users size={14} /> ข้อมูลสมาชิก
                              </h4>
                              <div className="space-y-2 text-sm">
                                <InfoRow
                                  icon={<Hash size={13} />}
                                  label="รหัสสมาชิก"
                                  value={c.CustomerID || "-"}
                                  mono
                                />
                                <InfoRow
                                  icon={<Users size={13} />}
                                  label="ชื่อ"
                                  value={c.Name || "-"}
                                />
                                <InfoRow
                                  icon={<Phone size={13} />}
                                  label="เบอร์โทร"
                                  value={c.Phone || "-"}
                                />
                                <InfoRow
                                  icon={<Hash size={13} />}
                                  label="เลขภาษี"
                                  value={c.TaxID || "-"}
                                  mono
                                />
                                <InfoRow
                                  icon={<MapPin size={13} />}
                                  label="ที่อยู่ภาษี"
                                  value={c.TaxAddress || "-"}
                                />
                                <InfoRow
                                  icon={<MapPin size={13} />}
                                  label="ที่อยู่"
                                  value={c.Address || "-"}
                                />
                                <InfoRow
                                  icon={<Star size={13} />}
                                  label="แต้มสะสม"
                                  value={
                                    <span className="font-bold text-yellow-600">
                                      {Number(c.Points || 0).toLocaleString()} pts
                                    </span>
                                  }
                                />
                                <InfoRow
                                  icon={<Star size={13} />}
                                  label="อัพเดทแต้มล่าสุด"
                                  value={formatDate(c.PointsUpdatedAt)}
                                />
                                <InfoRow
                                  icon={<Users size={13} />}
                                  label="วันที่สมัคร"
                                  value={formatDate(c.CreatedAt)}
                                />
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
                                    <div
                                      key={ci}
                                      className="flex items-start justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl px-3.5 py-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-semibold text-gray-900 text-sm truncate">
                                          {cc.CouponName || cc.CouponID || "คูปอง"}
                                        </div>
                                        {cc.ExpiryDate && (
                                          <div className="text-[11px] text-gray-400 mt-0.5">
                                            หมดอายุ: {formatDate(cc.ExpiryDate)}
                                          </div>
                                        )}
                                        {cc.CouponID && (
                                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                            {cc.CouponID}
                                          </div>
                                        )}
                                      </div>
                                      <span className="shrink-0 text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">
                                        ใช้ได้
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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

        {/* Footer count */}
        {!isLoading && (
          <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
            แสดง {filtered.length} จาก {customers.length} สมาชิก
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-indigo-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span
        className={`text-gray-900 font-medium break-words min-w-0 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Plus, Edit2, ToggleLeft, ToggleRight, Star, Gift, Loader2, Check, X, Search, Calendar, Download, Phone } from "lucide-react";
import { fetchApi, postApi } from "../api";
import { exportReportToExcel } from "../utils/excelExport";

const emptyForm = { name: "", price: "", points: "", bonusPoints: "", description: "", status: "ACTIVE" };

const today = new Date().toISOString().split("T")[0];

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("packages");

  // History filters
  const [histSearch, setHistSearch] = useState("");
  const [histStartDate, setHistStartDate] = useState("");
  const [histEndDate, setHistEndDate] = useState(today);
  const [histType, setHistType] = useState("all"); // "all" | "EARN" | "REDEEM"

  useEffect(() => {
    Promise.all([
      fetchApi("getPackages"),
      fetchApi("getPointsHistory"),
      fetchApi("getCustomers"),
    ]).then(([pkgs, hist, custs]) => {
      setPackages(Array.isArray(pkgs) ? pkgs : []);
      setHistory(Array.isArray(hist) ? [...hist].reverse() : []);
      setCustomers(Array.isArray(custs) ? custs : []);
      setIsLoading(false);
    });
  }, []);

  // Build phone lookup map
  const phoneMap = useMemo(() => {
    const m = {};
    customers.forEach(c => { if (c.Name) m[c.Name.trim().toLowerCase()] = c.Phone || ""; });
    return m;
  }, [customers]);

  const getPhone = (name) => phoneMap[(name || "").trim().toLowerCase()] || "-";

  // Filtered history
  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      // Search
      if (histSearch.trim()) {
        const q = histSearch.toLowerCase();
        const phone = getPhone(h.CustomerName);
        if (
          !String(h.CustomerName || "").toLowerCase().includes(q) &&
          !String(phone).includes(q) &&
          !String(h.Reference || "").toLowerCase().includes(q)
        ) return false;
      }
      // Date range
      if (histStartDate || histEndDate) {
        const d = new Date(h.Date);
        if (histStartDate) {
          const start = new Date(histStartDate); start.setHours(0, 0, 0, 0);
          if (d < start) return false;
        }
        if (histEndDate) {
          const end = new Date(histEndDate); end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }
      // Type
      if (histType !== "all") {
        if (histType === "EARN" && h.Type !== "EARN") return false;
        if (histType === "REDEEM" && h.Type === "EARN") return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, histSearch, histStartDate, histEndDate, histType, phoneMap]);

  const handleExportHistory = () => {
    if (filteredHistory.length === 0) { alert("ไม่มีข้อมูลที่จะส่งออก"); return; }
    const headers = [
      { key: "no",           label: "No." },
      { key: "date",         label: "วันที่เวลา" },
      { key: "customerName", label: "ลูกค้า" },
      { key: "phone",        label: "เบอร์โทร" },
      { key: "type",         label: "ประเภท" },
      { key: "points",       label: "เครดิต" },
      { key: "balance",      label: "คงเหลือ" },
      { key: "reference",    label: "หมายเหตุ/อ้างอิง" },
    ];
    const rows = filteredHistory.map((h, i) => ({
      no: i + 1,
      date: new Date(h.Date).toLocaleString("th-TH"),
      customerName: h.CustomerName || "-",
      phone: getPhone(h.CustomerName),
      type: h.Type === "EARN" ? "รับเครดิต" : "ใช้เครดิต",
      points: (h.Type === "EARN" ? "+" : "-") + Number(h.Points).toLocaleString(),
      balance: Number(h.Balance).toLocaleString(),
      reference: h.Reference || "-",
    }));
    const earnTotal = filteredHistory.filter(h => h.Type === "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
    const redeemTotal = filteredHistory.filter(h => h.Type !== "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
    const totals = {
      no: "รวม",
      type: `รับ ${earnTotal.toLocaleString()} / ใช้ ${redeemTotal.toLocaleString()}`,
    };

    const periodStr = (() => {
      if (histStartDate && histEndDate) return `${histStartDate} ถึง ${histEndDate}`;
      if (histStartDate) return `ตั้งแต่ ${histStartDate}`;
      if (histEndDate) return `ถึง ${histEndDate}`;
      return "ทั้งหมด";
    })();

    exportReportToExcel({
      title: "ประวัติเครดิต",
      company: { name: "", branch: "", taxId: "", address: "" },
      period: periodStr,
      headers,
      rows,
      totals,
      sheetName: "CreditHistory",
      fileName: "Credit_History",
    });
  };

  const openAdd = () => { setEditPkg(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (pkg) => {
    setEditPkg(pkg);
    setForm({
      name: pkg.Name || "",
      price: String(pkg.Price || ""),
      points: String(pkg.Points || ""),
      bonusPoints: String(pkg.BonusPoints || "0"),
      description: pkg.Description || "",
      status: pkg.Status || "ACTIVE",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.points) {
      alert("กรุณากรอกชื่อ, ราคา และจำนวนเครดิต"); return;
    }
    setIsSaving(true);
    const res = await postApi({
      action: "savePackage",
      payload: {
        packageId: editPkg?.PackageID || "",
        name: form.name.trim(),
        price: parseFloat(form.price),
        points: parseFloat(form.points),
        bonusPoints: parseFloat(form.bonusPoints) || 0,
        description: form.description.trim(),
        status: form.status,
      }
    });
    setIsSaving(false);
    if (res.success) {
      const updated = await fetchApi("getPackages");
      setPackages(Array.isArray(updated) ? updated : []);
      setShowForm(false);
    } else {
      alert(res.error || "บันทึกไม่สำเร็จ");
    }
  };

  const toggleStatus = async (pkg) => {
    const newStatus = pkg.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await postApi({ action: "savePackage", payload: { packageId: pkg.PackageID, name: pkg.Name, price: pkg.Price, points: pkg.Points, bonusPoints: pkg.BonusPoints, description: pkg.Description, status: newStatus } });
    setPackages(prev => prev.map(p => p.PackageID === pkg.PackageID ? { ...p, Status: newStatus } : p));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const earnSum = filteredHistory.filter(h => h.Type === "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
  const redeemSum = filteredHistory.filter(h => h.Type !== "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ระบบเครดิต</h2>
          <p className="text-sm text-gray-500 mt-0.5">จัดการแพคเกจเครดิตและประวัติการใช้เครดิต</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
          <Plus size={16} /> เพิ่มแพคเกจเครดิต
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ key: "packages", label: "แพคเกจเครดิต" }, { key: "history", label: "ประวัติเครดิต" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PACKAGES ── */}
      {activeTab === "packages" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {packages.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Gift size={40} className="mx-auto mb-3 opacity-30" />
              <p>ยังไม่มีแพคเกจ กด "เพิ่มแพคเกจ" เพื่อสร้าง</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                <tr>
                  <th className="py-3 px-6">ชื่อแพคเกจ</th>
                  <th className="py-3 px-4 text-right">ราคา (฿)</th>
                  <th className="py-3 px-4 text-right">เครดิตฐาน</th>
                  <th className="py-3 px-4 text-right">โบนัสเครดิต</th>
                  <th className="py-3 px-4 text-right">รวมเครดิต</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {packages.map((pkg, i) => {
                  const total = (parseFloat(pkg.Points) || 0) + (parseFloat(pkg.BonusPoints) || 0);
                  const isActive = pkg.Status === "ACTIVE";
                  return (
                    <tr key={i} className={`text-sm hover:bg-gray-50/60 transition-colors ${!isActive ? "opacity-50" : ""}`}>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-900">{pkg.Name}</div>
                        {pkg.Description && <div className="text-xs text-gray-400 mt-0.5">{pkg.Description}</div>}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900">฿{Number(pkg.Price).toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-gray-600">{Number(pkg.Points).toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-yellow-600 font-medium">+{Number(pkg.BonusPoints || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Star size={11} /> {total.toLocaleString()} pts
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button onClick={() => toggleStatus(pkg)} title={isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                          {isActive
                            ? <ToggleRight size={24} className="text-green-500" />
                            : <ToggleLeft size={24} className="text-gray-400" />}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button onClick={() => openEdit(pkg)} className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50">
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: HISTORY ── */}
      {activeTab === "history" && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร / อ้างอิง..."
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {histSearch && (
                  <button onClick={() => setHistSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type filter */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {[
                  { key: "all",    label: "ทั้งหมด" },
                  { key: "EARN",   label: "รับเครดิต" },
                  { key: "REDEEM", label: "ใช้เครดิต" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setHistType(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      histType === t.key
                        ? t.key === "EARN"
                          ? "bg-white shadow text-green-600"
                          : t.key === "REDEEM"
                            ? "bg-white shadow text-red-500"
                            : "bg-white shadow text-primary"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Export */}
              <button
                onClick={handleExportHistory}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <Download size={15} /> Export Excel
              </button>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={15} className="text-gray-400" />
                <span className="font-medium">ช่วงวันที่:</span>
              </div>
              <input
                type="date"
                value={histStartDate}
                onChange={e => setHistStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              />
              <span className="text-gray-400 text-sm">ถึง</span>
              <input
                type="date"
                value={histEndDate}
                onChange={e => setHistEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              />
              {(histStartDate || histEndDate) && (
                <button
                  onClick={() => { setHistStartDate(""); setHistEndDate(today); }}
                  className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> ล้างวันที่
                </button>
              )}
            </div>

            {/* Summary badges */}
            {filteredHistory.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">
                  ทั้งหมด {filteredHistory.length} รายการ
                </span>
                <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                  <Check size={11} /> รับเครดิต: +{earnSum.toLocaleString()} pts
                </span>
                <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                  <X size={11} /> ใช้เครดิต: -{redeemSum.toLocaleString()} pts
                </span>
              </div>
            )}
          </div>

          {/* History table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Star size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{history.length === 0 ? "ยังไม่มีประวัติเครดิต" : "ไม่พบรายการที่ตรงกับเงื่อนไข"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[750px]">
                  <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-600 sticky top-0">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">วันที่</th>
                      <th className="py-3 px-4">ลูกค้า</th>
                      <th className="py-3 px-4">เบอร์โทร</th>
                      <th className="py-3 px-4 text-center">ประเภท</th>
                      <th className="py-3 px-4 text-right">เครดิต</th>
                      <th className="py-3 px-4 text-right">คงเหลือ</th>
                      <th className="py-3 px-4">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredHistory.map((h, i) => {
                      const isEarn = h.Type === "EARN";
                      return (
                        <tr key={i} className={`hover:bg-gray-50/60 transition-colors ${isEarn ? "" : "bg-red-50/20"}`}>
                          <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(h.Date).toLocaleString("th-TH")}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{h.CustomerName || "-"}</td>
                          <td className="py-3 px-4 text-gray-500">
                            <span className="flex items-center gap-1">
                              <Phone size={12} className="text-gray-300" />
                              {getPhone(h.CustomerName)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isEarn ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                              {isEarn ? <Check size={11} /> : <X size={11} />}
                              {isEarn ? "รับเครดิต" : "ใช้เครดิต"}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${isEarn ? "text-green-600" : "text-red-500"}`}>
                            {isEarn ? "+" : "-"}{Number(h.Points).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">{Number(h.Balance).toLocaleString()}</td>
                          <td className="py-3 px-4 text-xs text-gray-400 max-w-[180px] truncate">{h.Reference || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr className="text-sm font-bold text-gray-700">
                      <td colSpan={5} className="py-3 px-4">รวม {filteredHistory.length} รายการ</td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-green-600">+{earnSum.toLocaleString()}</div>
                        <div className="text-red-500">-{redeemSum.toLocaleString()}</div>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD/EDIT FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{editPkg ? "แก้ไขแพคเกจเครดิต" : "เพิ่มแพคเกจเครดิตใหม่"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชื่อแพคเกจ <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="เช่น แพคเกจ 1,000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ราคา (฿) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value, points: e.target.value }))} placeholder="1000" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เครดิตฐาน <span className="text-red-500">*</span></label>
                  <input type="number" value={form.points} onChange={e => setForm(p => ({ ...p, points: e.target.value }))} placeholder="1000" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">โบนัสเครดิต (ฟรีเพิ่ม)</label>
                <input type="number" value={form.bonusPoints} onChange={e => setForm(p => ({ ...p, bonusPoints: e.target.value }))} placeholder="0" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                {(parseFloat(form.points) || 0) > 0 && (
                  <p className="text-xs text-yellow-600 mt-1.5 flex items-center gap-1">
                    <Star size={11} /> รวมเครดิตที่ได้: {((parseFloat(form.points) || 0) + (parseFloat(form.bonusPoints) || 0)).toLocaleString()} pts
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">รายละเอียด</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
              <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> บันทึกแพคเกจ</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

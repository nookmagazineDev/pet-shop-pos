import { useState, useEffect, useMemo } from "react";
import {
  Plus, Edit2, ToggleLeft, ToggleRight, Star, Gift, Loader2, Check, X,
  Search, Calendar, Download, Phone, Scissors, ShoppingBag, MinusCircle,
  Users, Clock, AlertCircle, RefreshCw,
} from "lucide-react";
import { fetchApi, postApi, invalidateCache } from "../api";
import { exportReportToExcel } from "../utils/excelExport";
import toast from "react-hot-toast";

// ── constants ────────────────────────────────────────────
const EMPTY_FORM = {
  name: "", price: "", points: "", bonusPoints: "",
  description: "", status: "ACTIVE",
  packageType: "POINTS", sessionCount: "", expiryDays: "365",
  bonusSessions: "0", bonusServiceName: "", bonusServiceSessions: "0",
  subtype: "GENERAL",
  rewardType: "NONE", rewardRef: "", rewardName: "", rewardQty: "1",
};

const REWARD_TYPES = [
  { k: "NONE",   label: "ไม่มี"      },
  { k: "ITEM",   label: "สินค้าฟรี"  },
  { k: "COUPON", label: "คูปอง"      },
];

const SUBTYPES = [
  { k: "GENERAL",      label: "ทั่วไป"       },
  { k: "GROOMING",     label: "Grooming"     },
  { k: "HOTEL",        label: "Hotel"        },
  { k: "SUBSCRIPTION", label: "Subscription" },
];

const MANUAL_REASONS = [
  "ซื้อแพคเกจพิเศษ",
  "ชดเชยความไม่สะดวก",
  "รีวิวร้าน",
  "Follow Social Media",
  "แนะนำลูกค้าใหม่",
  "โปรโมชั่นพิเศษ",
  "อื่นๆ",
];

const today = new Date().toISOString().split("T")[0];

function fmt(val) {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString("th-TH", { dateStyle: "medium" });
}

function statusBadge(status) {
  const map = {
    ACTIVE:   { cls: "bg-green-50 text-green-700 border-green-100",  label: "ใช้งาน" },
    USED_UP:  { cls: "bg-gray-100 text-gray-500 border-gray-200",    label: "ใช้หมดแล้ว" },
    EXPIRED:  { cls: "bg-red-50 text-red-600 border-red-100",        label: "หมดอายุ" },
    INACTIVE: { cls: "bg-gray-100 text-gray-400 border-gray-200",    label: "ปิดใช้งาน" },
  };
  const s = map[status] || map.INACTIVE;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── main component ────────────────────────────────────────
export default function Packages() {
  // data
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // tabs
  const [activeTab, setActiveTab] = useState("packages");

  // package form (add/edit)
  const [showForm, setShowForm] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // history filters
  const [histSearch, setHistSearch] = useState("");
  const [histStartDate, setHistStartDate] = useState("");
  const [histEndDate, setHistEndDate] = useState(today);
  const [histType, setHistType] = useState("all");

  // customer packages filters
  const [cpSearch, setCpSearch] = useState("");
  const [cpStatus, setCpStatus] = useState("ACTIVE");

  // buy-session modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyForm, setBuyForm] = useState({ customerName: "", phone: "", packageId: "", paidAmount: "" });
  const [isBuying, setIsBuying] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // use-session modal
  const [showUseModal, setShowUseModal] = useState(false);
  const [useTarget, setUseTarget] = useState(null);
  const [useForm, setUseForm] = useState({ sessionsUsed: "1", note: "" });
  const [isUsing, setIsUsing] = useState(false);

  // extend expiry modal
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendDate, setExtendDate] = useState("");
  const [isExtending, setIsExtending] = useState(false);

  // ── load data ──────────────────────────────────────────
  const loadAll = () => {
    setIsLoading(true);
    Promise.all([
      fetchApi("getPackages", { skipCache: true }),
      fetchApi("getPointsHistory", { skipCache: true }),
      fetchApi("getCustomers", { skipCache: true }),
      fetchApi("getCustomerPackages", { skipCache: true }),
    ]).then(([pkgs, hist, custs, cpkgs]) => {
      setPackages(Array.isArray(pkgs) ? pkgs : []);
      setHistory(Array.isArray(hist) ? [...hist].reverse() : []);
      setCustomers(Array.isArray(custs) ? custs : []);
      setCustomerPackages(Array.isArray(cpkgs) ? [...cpkgs].reverse() : []);
      setIsLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  // ── derived ────────────────────────────────────────────
  const phoneMap = useMemo(() => {
    const m = {};
    customers.forEach(c => { if (c.Name) m[c.Name.trim().toLowerCase()] = c.Phone || ""; });
    return m;
  }, [customers]);
  const getPhone = name => phoneMap[(name || "").trim().toLowerCase()] || "-";

  const sessionPackages = useMemo(
    () => packages.filter(p => (p.PackageType || "POINTS") === "SESSIONS" && p.Status === "ACTIVE"),
    [packages]
  );

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      if (histSearch.trim()) {
        const q = histSearch.toLowerCase();
        const ph = getPhone(h.CustomerName);
        if (!String(h.CustomerName || "").toLowerCase().includes(q) &&
            !String(ph).includes(q) &&
            !String(h.Reference || "").toLowerCase().includes(q)) return false;
      }
      if (histStartDate) {
        const s = new Date(histStartDate); s.setHours(0, 0, 0, 0);
        if (new Date(h.Date) < s) return false;
      }
      if (histEndDate) {
        const e = new Date(histEndDate); e.setHours(23, 59, 59, 999);
        if (new Date(h.Date) > e) return false;
      }
      if (histType === "EARN" && h.Type !== "EARN") return false;
      if (histType === "REDEEM" && h.Type === "EARN") return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, histSearch, histStartDate, histEndDate, histType, phoneMap]);

  const filteredCPs = useMemo(() => {
    return customerPackages.filter(cp => {
      if (cpStatus !== "all" && String(cp.Status || "ACTIVE") !== cpStatus) return false;
      if (cpSearch.trim()) {
        const q = cpSearch.toLowerCase();
        if (!String(cp.CustomerName || "").toLowerCase().includes(q) &&
            !String(cp.PackageName || "").toLowerCase().includes(q) &&
            !String(cp.Phone || "").includes(q)) return false;
      }
      return true;
    });
  }, [customerPackages, cpSearch, cpStatus]);

  // ── package form ───────────────────────────────────────
  const openAdd = () => { setEditPkg(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = pkg => {
    setEditPkg(pkg);
    setForm({
      name:               pkg.Name || "",
      price:              String(pkg.Price || ""),
      points:             String(pkg.Points || ""),
      bonusPoints:        String(pkg.BonusPoints || "0"),
      description:        pkg.Description || "",
      status:             pkg.Status || "ACTIVE",
      packageType:        pkg.PackageType || "POINTS",
      sessionCount:       String(pkg.SessionCount || ""),
      expiryDays:         String(pkg.ExpiryDays || "365"),
      bonusSessions:      String(pkg.BonusSessions || "0"),
      bonusServiceName:   pkg.BonusServiceName || "",
      bonusServiceSessions: String(pkg.BonusServiceSessions || "0"),
      subtype:            pkg.Subtype || "GENERAL",
      rewardType:         pkg.RewardType || "NONE",
      rewardRef:          pkg.RewardRef || "",
      rewardName:         pkg.RewardName || "",
      rewardQty:          String(pkg.RewardQty || "1"),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { toast.error("กรุณากรอกชื่อและราคา"); return; }
    if (form.packageType === "POINTS" && !form.points) { toast.error("กรุณากรอกจำนวนเครดิต"); return; }
    if (form.packageType === "SESSIONS" && (!form.sessionCount || parseInt(form.sessionCount) < 1)) {
      toast.error("กรุณากรอกจำนวนครั้ง (อย่างน้อย 1)"); return;
    }
    setIsSaving(true);
    const res = await postApi({
      action: "savePackage",
      payload: {
        packageId:            editPkg?.PackageID || "",
        name:                 form.name.trim(),
        price:                parseFloat(form.price),
        points:               form.packageType === "POINTS" ? parseFloat(form.points) : 0,
        bonusPoints:          form.packageType === "POINTS" ? parseFloat(form.bonusPoints) || 0 : 0,
        description:          form.description.trim(),
        status:               form.status,
        packageType:          form.packageType,
        sessionCount:         form.packageType === "SESSIONS" ? parseInt(form.sessionCount) : 0,
        expiryDays:           parseInt(form.expiryDays) || 365,
        bonusSessions:        parseInt(form.bonusSessions) || 0,
        bonusServiceName:     form.bonusServiceName.trim(),
        bonusServiceSessions: parseInt(form.bonusServiceSessions) || 0,
        subtype:              form.subtype || "GENERAL",
        rewardType:           form.rewardType || "NONE",
        rewardRef:            form.rewardRef.trim(),
        rewardName:           form.rewardName.trim(),
        rewardQty:            parseInt(form.rewardQty) || 1,
      },
    });
    setIsSaving(false);
    if (res.success) {
      toast.success(editPkg ? "แก้ไขแพคเกจสำเร็จ" : "เพิ่มแพคเกจสำเร็จ");
      invalidateCache("getPackages");
      const updated = await fetchApi("getPackages", { skipCache: true });
      setPackages(Array.isArray(updated) ? updated : []);
      setShowForm(false);
    } else {
      toast.error(res.error || "บันทึกไม่สำเร็จ");
    }
  };

  const toggleStatus = async pkg => {
    const newStatus = pkg.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await postApi({
      action: "savePackage",
      payload: { packageId: pkg.PackageID, name: pkg.Name, price: pkg.Price, points: pkg.Points, bonusPoints: pkg.BonusPoints, description: pkg.Description, status: newStatus, packageType: pkg.PackageType || "POINTS", sessionCount: pkg.SessionCount || 0, expiryDays: pkg.ExpiryDays || 365 },
    });
    setPackages(prev => prev.map(p => p.PackageID === pkg.PackageID ? { ...p, Status: newStatus } : p));
  };

  // ── buy-session modal ──────────────────────────────────
  const openBuyModal = () => {
    setBuyForm({ customerName: "", phone: "", packageId: sessionPackages[0]?.PackageID || "", paidAmount: "" });
    setCustomerSuggestions([]);
    setShowBuyModal(true);
  };

  const onCustomerInput = val => {
    setBuyForm(p => ({ ...p, customerName: val }));
    if (val.trim().length > 0) {
      const q = val.toLowerCase();
      setCustomerSuggestions(customers.filter(c =>
        String(c.Name || "").toLowerCase().includes(q) ||
        String(c.Phone || "").includes(q)
      ).slice(0, 6));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectCustomer = c => {
    setBuyForm(p => ({ ...p, customerName: c.Name, phone: c.Phone || "" }));
    // Auto-fill paidAmount from package price
    const pkg = packages.find(p => p.PackageID === buyForm.packageId);
    if (pkg) setBuyForm(p => ({ ...p, paidAmount: String(pkg.Price || "") }));
    setShowSuggestions(false);
  };

  const handleBuySession = async () => {
    if (!buyForm.customerName.trim()) { toast.error("กรุณาระบุชื่อลูกค้า"); return; }
    if (!buyForm.packageId) { toast.error("กรุณาเลือกแพคเกจ"); return; }
    setIsBuying(true);
    const res = await postApi({
      action: "purchaseSessionPackage",
      payload: {
        customerName: buyForm.customerName.trim(),
        phone: buyForm.phone,
        packageId: buyForm.packageId,
        paidAmount: parseFloat(buyForm.paidAmount) || 0,
      },
    });
    setIsBuying(false);
    if (res.success) {
      toast.success(`ซื้อแพคเกจครั้งสำเร็จ — ${res.totalSessions} ครั้ง`);
      if (res.rewardIssued) {
        if (res.rewardIssued.type === "ITEM") {
          toast.success(`🎁 ออกคูปองสินค้าฟรีให้ลูกค้าแล้ว: ${res.rewardIssued.name} x${res.rewardIssued.qty} (ใช้ได้หน้า POS)`, { duration: 5000 });
        } else {
          toast.success(`🎁 ออกคูปองแถม: ${res.rewardIssued.name} x${res.rewardIssued.qty}`, { duration: 4000 });
        }
      }
      invalidateCache("getCustomerPackages");
      invalidateCache("getCustomers");
      const updated = await fetchApi("getCustomerPackages", { skipCache: true });
      setCustomerPackages(Array.isArray(updated) ? [...updated].reverse() : []);
      setShowBuyModal(false);
    } else {
      toast.error(res.error || "บันทึกไม่สำเร็จ");
    }
  };

  // ── use-session modal ──────────────────────────────────
  const openUseModal = cp => {
    setUseTarget(cp);
    setUseForm({ sessionsUsed: "1", note: "" });
    setShowUseModal(true);
  };

  const handleUseSession = async () => {
    if (!useTarget) return;
    const n = parseInt(useForm.sessionsUsed) || 1;
    const remaining = (parseInt(useTarget.TotalSessions) || 0) - (parseInt(useTarget.UsedSessions) || 0);
    if (n > remaining) { toast.error(`เหลือแค่ ${remaining} ครั้ง`); return; }
    setIsUsing(true);
    const res = await postApi({
      action: "usePackageSession",
      payload: { customerPackageId: useTarget.ID, sessionsUsed: n, note: useForm.note },
    });
    setIsUsing(false);
    if (res.success) {
      toast.success(`ใช้ ${n} ครั้ง | เหลือ ${res.remainingSessions} ครั้ง`);
      invalidateCache("getCustomerPackages");
      const updated = await fetchApi("getCustomerPackages", { skipCache: true });
      setCustomerPackages(Array.isArray(updated) ? [...updated].reverse() : []);
      setShowUseModal(false);
    } else {
      toast.error(res.error || "บันทึกไม่สำเร็จ");
    }
  };

  // ── extend expiry ──────────────────────────────────────
  const openExtendModal = cp => {
    setExtendTarget(cp);
    // Default: 30 days from current expiry or today
    const base = cp.ExpiryDate ? new Date(cp.ExpiryDate) : new Date();
    base.setDate(base.getDate() + 30);
    setExtendDate(base.toISOString().split("T")[0]);
    setShowExtendModal(true);
  };

  const handleExtendExpiry = async () => {
    if (!extendTarget || !extendDate) { toast.error("กรุณาระบุวันหมดอายุใหม่"); return; }
    setIsExtending(true);
    const res = await postApi({
      action: "extendPackageExpiry",
      payload: { id: extendTarget.ID, newExpiryDate: extendDate },
    });
    setIsExtending(false);
    if (res.success) {
      toast.success("ต่ออายุแพคเกจสำเร็จ");
      invalidateCache("getCustomerPackages");
      const updated = await fetchApi("getCustomerPackages", { skipCache: true });
      setCustomerPackages(Array.isArray(updated) ? [...updated].reverse() : []);
      setShowExtendModal(false);
    } else {
      toast.error(res.error || "ต่ออายุไม่สำเร็จ");
    }
  };

  // ── export history ─────────────────────────────────────
  const handleExportHistory = () => {
    if (filteredHistory.length === 0) { toast.error("ไม่มีข้อมูลที่จะส่งออก"); return; }
    const headers = [
      { key: "no", label: "No." }, { key: "date", label: "วันที่" },
      { key: "customerName", label: "ลูกค้า" }, { key: "phone", label: "เบอร์โทร" },
      { key: "type", label: "ประเภท" }, { key: "points", label: "เครดิต" },
      { key: "balance", label: "คงเหลือ" }, { key: "reference", label: "หมายเหตุ" },
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
    exportReportToExcel({ title: "ประวัติเครดิต", company: {}, period: `${histStartDate || "ทั้งหมด"} - ${histEndDate}`, headers, rows, totals: {}, sheetName: "CreditHistory", fileName: "Credit_History" });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  }

  const earnSum   = filteredHistory.filter(h => h.Type === "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);
  const redeemSum = filteredHistory.filter(h => h.Type !== "EARN").reduce((s, h) => s + (parseFloat(h.Points) || 0), 0);

  const TABS = [
    { key: "packages",  label: "แพคเกจ" },
    { key: "sessions",  label: `แพคเกจครั้ง (${customerPackages.filter(cp => cp.Status === "ACTIVE").length})` },
    { key: "history",   label: "ประวัติเครดิต" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ระบบเครดิต &amp; แพคเกจครั้ง</h2>
          <p className="text-sm text-gray-500 mt-0.5">จัดการแพคเกจเครดิต แพคเกจครั้ง และประวัติการใช้งาน</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { invalidateCache("getPackages"); invalidateCache("getCustomerPackages"); invalidateCache("getPointsHistory"); loadAll(); }}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            <RefreshCw size={15} /> รีเฟรช
          </button>
          {activeTab === "sessions" && sessionPackages.length > 0 && (
            <button onClick={openBuyModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors">
              <ShoppingBag size={15} /> ซื้อแพคเกจครั้ง
            </button>
          )}
          {activeTab === "packages" && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 shadow-sm transition-opacity">
              <Plus size={16} /> เพิ่มแพคเกจ
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PACKAGES ─────────────────────────────── */}
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
                  <th className="py-3 px-4 text-center">ประเภท</th>
                  <th className="py-3 px-4 text-right">ราคา (฿)</th>
                  <th className="py-3 px-4 text-right">เครดิต / ครั้ง</th>
                  <th className="py-3 px-4 text-right">อายุ (วัน)</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {packages.map((pkg, i) => {
                  const isPoints  = (pkg.PackageType || "POINTS") === "POINTS";
                  const isActive  = pkg.Status === "ACTIVE";
                  const total     = isPoints ? (parseFloat(pkg.Points) || 0) + (parseFloat(pkg.BonusPoints) || 0) : 0;
                  return (
                    <tr key={i} className={`text-sm hover:bg-gray-50/60 transition-colors ${!isActive ? "opacity-50" : ""}`}>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-900">{pkg.Name}</div>
                        {pkg.Description && <div className="text-xs text-gray-400 mt-0.5">{pkg.Description}</div>}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isPoints ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full">
                            <Star size={10} /> เครดิต
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full">
                            <Scissors size={10} /> ครั้ง
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900">฿{Number(pkg.Price).toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">
                        {isPoints ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full text-xs font-bold">
                            <Star size={11} /> {total.toLocaleString()} pts
                            {parseFloat(pkg.BonusPoints) > 0 && <span className="text-yellow-500">(+{Number(pkg.BonusPoints).toLocaleString()} bonus)</span>}
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full text-xs font-bold">
                              <Scissors size={11} /> {Number(pkg.SessionCount || 0).toLocaleString()} ครั้ง
                              {Number(pkg.BonusSessions) > 0 && <span className="text-violet-400">(แถม {Number(pkg.BonusSessions)} ครั้ง)</span>}
                            </span>
                            {pkg.BonusServiceName && (
                              <div className="text-xs text-amber-600 font-medium">+ {pkg.BonusServiceName} {Number(pkg.BonusServiceSessions || 0)} ครั้ง</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-500 text-xs">
                        <div>{Number(pkg.ExpiryDays || 365).toLocaleString()} วัน</div>
                        {pkg.RewardType && pkg.RewardType !== "NONE" && pkg.RewardRef && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">
                            <Gift size={9} />
                            {pkg.RewardType === "COUPON" ? "คูปอง" : "สินค้า"}: {String(pkg.RewardRef).substring(0, 18)}{String(pkg.RewardRef).length > 18 ? "…" : ""} x{Number(pkg.RewardQty || 1)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button onClick={() => toggleStatus(pkg)} title={isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                          {isActive
                            ? <ToggleRight size={24} className="text-green-500" />
                            : <ToggleLeft  size={24} className="text-gray-400"  />}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button onClick={() => openEdit(pkg)} className="text-blue-500 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-50 transition-colors">
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

      {/* ── TAB: SESSION PACKAGES ─────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={cpSearch} onChange={e => setCpSearch(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร / แพคเกจ..."
                className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400" />
              {cpSearch && <button onClick={() => setCpSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[{ k: "all", l: "ทั้งหมด" }, { k: "ACTIVE", l: "ใช้งาน" }, { k: "USED_UP", l: "หมดแล้ว" }, { k: "EXPIRED", l: "หมดอายุ" }].map(s => (
                <button key={s.k} onClick={() => setCpStatus(s.k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${cpStatus === s.k ? "bg-white shadow text-violet-600" : "text-gray-500 hover:text-gray-700"}`}>
                  {s.l}
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-400 ml-auto">{filteredCPs.length} รายการ</div>
          </div>

          {sessionPackages.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> ยังไม่มีแพคเกจประเภท "ครั้ง" — ไปที่แท็บ "แพคเกจ" แล้วเพิ่มแพคเกจที่เลือกประเภท "ครั้ง"
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredCPs.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Scissors size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{customerPackages.length === 0 ? "ยังไม่มีลูกค้าซื้อแพคเกจครั้ง" : "ไม่พบรายการที่ตรงเงื่อนไข"}</p>
                {sessionPackages.length > 0 && (
                  <button onClick={openBuyModal} className="mt-3 inline-flex items-center gap-1.5 text-violet-600 hover:text-violet-800 text-sm font-semibold underline underline-offset-2">
                    <Plus size={14} /> เพิ่มลูกค้าซื้อแพคเกจ
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[780px]">
                  <thead className="bg-violet-50/60 border-b border-violet-100 font-semibold text-violet-800 sticky top-0">
                    <tr>
                      <th className="py-3 px-5">ลูกค้า</th>
                      <th className="py-3 px-4">แพคเกจ</th>
                      <th className="py-3 px-4 text-center">ครั้งคงเหลือ</th>
                      <th className="py-3 px-4">วันซื้อ</th>
                      <th className="py-3 px-4">หมดอายุ</th>
                      <th className="py-3 px-4 text-center">สถานะ</th>
                      <th className="py-3 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCPs.map((cp, i) => {
                      const total     = parseInt(cp.TotalSessions) || 0;
                      const used      = parseInt(cp.UsedSessions)  || 0;
                      const remaining = total - used;
                      const pct       = total > 0 ? Math.round((used / total) * 100) : 0;
                      const isExpired = cp.ExpiryDate && new Date(cp.ExpiryDate) < new Date();
                      const status    = isExpired && cp.Status === "ACTIVE" ? "EXPIRED" : (cp.Status || "ACTIVE");
                      return (
                        <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-gray-900">{cp.CustomerName || "-"}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {cp.Phone || "-"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-gray-800">{cp.PackageName || "-"}</div>
                            <div className="text-xs text-gray-400">฿{Number(cp.PaidAmount || 0).toLocaleString()}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className={`font-bold text-lg ${remaining === 0 ? "text-gray-400" : remaining <= 1 ? "text-red-500" : "text-violet-700"}`}>
                              {remaining}
                              <span className="text-xs font-normal text-gray-400"> / {total}</span>
                            </div>
                            <div className="w-24 mx-auto mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-gray-400" : pct >= 70 ? "bg-red-400" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-500 text-xs">{fmt(cp.PurchaseDate)}</td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={isExpired ? "text-red-500 font-medium" : "text-gray-500"}>
                              {fmt(cp.ExpiryDate)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">{statusBadge(status)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              <button
                                onClick={() => openUseModal(cp)}
                                disabled={status !== "ACTIVE" || remaining === 0}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <MinusCircle size={12} /> ใช้ครั้ง
                              </button>
                              <button
                                onClick={() => openExtendModal(cp)}
                                title="ต่ออายุ"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                <Calendar size={12} /> ต่ออายุ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: HISTORY ──────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={histSearch} onChange={e => setHistSearch(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า / เบอร์ / อ้างอิง..."
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                {histSearch && <button onClick={() => setHistSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {[{ k: "all", l: "ทั้งหมด" }, { k: "EARN", l: "รับเครดิต" }, { k: "REDEEM", l: "ใช้เครดิต" }].map(t => (
                  <button key={t.k} onClick={() => setHistType(t.k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${histType === t.k ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <button onClick={handleExportHistory}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
                <Download size={15} /> Export Excel
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500"><Calendar size={15} className="text-gray-400" /><span>ช่วงวันที่:</span></div>
              <input type="date" value={histStartDate} onChange={e => setHistStartDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary" />
              <span className="text-gray-400 text-sm">ถึง</span>
              <input type="date" value={histEndDate} onChange={e => setHistEndDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary" />
              {(histStartDate || histEndDate) && (
                <button onClick={() => { setHistStartDate(""); setHistEndDate(today); }} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <X size={12} /> ล้างวันที่
                </button>
              )}
            </div>
            {filteredHistory.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">{filteredHistory.length} รายการ</span>
                <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                  <Check size={11} /> รับ: +{earnSum.toLocaleString()} pts
                </span>
                <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                  <X size={11} /> ใช้: -{redeemSum.toLocaleString()} pts
                </span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Star size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{history.length === 0 ? "ยังไม่มีประวัติเครดิต" : "ไม่พบรายการที่ตรงเงื่อนไข"}</p>
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
                      const isEarn = h.Type === "EARN" || h.Type === "MANUAL_ADD";
                      return (
                        <tr key={i} className={`hover:bg-gray-50/60 transition-colors ${isEarn ? "" : "bg-red-50/20"}`}>
                          <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(h.Date).toLocaleString("th-TH")}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{h.CustomerName || "-"}</td>
                          <td className="py-3 px-4 text-gray-500 flex items-center gap-1"><Phone size={12} className="text-gray-300" />{getPhone(h.CustomerName)}</td>
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

      {/* ══ MODAL: Add/Edit Package ═══════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{editPkg ? "แก้ไขแพคเกจ" : "เพิ่มแพคเกจใหม่"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Package type selector */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">ประเภทแพคเกจ</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ k: "POINTS", icon: <Star size={14} />, label: "เครดิต", desc: "ลูกค้าได้รับพ้อยสะสม" },
                    { k: "SESSIONS", icon: <Scissors size={14} />, label: "ครั้ง", desc: "Grooming / Hotel ตัดครั้ง" }
                  ].map(t => (
                    <button key={t.k} type="button" onClick={() => setForm(p => ({ ...p, packageType: t.k }))}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${form.packageType === t.k ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      <div className="flex items-center gap-1.5 font-semibold text-sm">{t.icon} {t.label}</div>
                      <div className="text-xs text-gray-400">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชื่อแพคเกจ <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={form.packageType === "SESSIONS" ? "เช่น แพคเกจ Grooming 5 ครั้ง" : "เช่น แพคเกจเครดิต 1,000"}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ราคา (฿) <span className="text-red-500">*</span></label>
                <input type="number" value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value, ...(p.packageType === "POINTS" && { points: e.target.value }) }))}
                  placeholder="1000" min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>

              {/* Points-specific */}
              {form.packageType === "POINTS" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เครดิตฐาน <span className="text-red-500">*</span></label>
                    <input type="number" value={form.points} onChange={e => setForm(p => ({ ...p, points: e.target.value }))}
                      placeholder="1000" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">โบนัสเครดิต</label>
                    <input type="number" value={form.bonusPoints} onChange={e => setForm(p => ({ ...p, bonusPoints: e.target.value }))}
                      placeholder="0" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
              )}

              {/* Sessions-specific */}
              {form.packageType === "SESSIONS" && (
                <div className="space-y-3">
                  {/* Subtype */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ประเภทบริการ</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SUBTYPES.map(s => (
                        <button key={s.k} type="button" onClick={() => setForm(p => ({ ...p, subtype: s.k }))}
                          className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${form.subtype === s.k ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Session count + Bonus sessions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">จำนวนครั้ง (รวมทั้งหมด) <span className="text-red-500">*</span></label>
                      <input type="number" value={form.sessionCount} onChange={e => setForm(p => ({ ...p, sessionCount: e.target.value }))}
                        placeholder="11" min="1" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                      <p className="text-[10px] text-gray-400 mt-0.5">เช่น ซื้อ 10 แถม 1 = ใส่ 11</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ครั้งโบนัส (แถม)</label>
                      <input type="number" value={form.bonusSessions} onChange={e => setForm(p => ({ ...p, bonusSessions: e.target.value }))}
                        placeholder="1" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                      <p className="text-[10px] text-gray-400 mt-0.5">แถมกี่ครั้ง</p>
                    </div>
                  </div>

                  {/* Bonus service */}
                  <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-amber-700">บริการเสริมโบนัส (ไม่บังคับ)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชื่อบริการโบนัส</label>
                        <input value={form.bonusServiceName} onChange={e => setForm(p => ({ ...p, bonusServiceName: e.target.value }))}
                          placeholder="เช่น แปรงฟัน" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">จำนวนครั้งโบนัส</label>
                        <input type="number" value={form.bonusServiceSessions} onChange={e => setForm(p => ({ ...p, bonusServiceSessions: e.target.value }))}
                          placeholder="5" min="0" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Purchase Reward ─────────────────────────── */}
              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                  <Gift size={13} /> ของแถมเมื่อซื้อแพคเกจ (ไม่บังคับ)
                </p>
                {/* Reward type selector */}
                <div className="grid grid-cols-3 gap-1.5">
                  {REWARD_TYPES.map(r => (
                    <button key={r.k} type="button"
                      onClick={() => setForm(p => ({ ...p, rewardType: r.k, rewardRef: "", rewardName: "" }))}
                      className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${form.rewardType === r.k ? "border-purple-500 bg-purple-100 text-purple-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* ITEM: barcode + name + qty */}
                {form.rewardType === "ITEM" && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">บาร์โค้ดสินค้า</label>
                        <input value={form.rewardRef} onChange={e => setForm(p => ({ ...p, rewardRef: e.target.value }))}
                          placeholder="เช่น 8851234100036"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">จำนวน (ชิ้น)</label>
                        <input type="number" value={form.rewardQty} onChange={e => setForm(p => ({ ...p, rewardQty: e.target.value }))}
                          placeholder="1" min="1"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">ชื่อสินค้า (แสดงในใบเสร็จ)</label>
                      <input value={form.rewardName} onChange={e => setForm(p => ({ ...p, rewardName: e.target.value }))}
                        placeholder="เช่น แชมพูอาบน้ำสุนัข Bio Groom"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400" />
                    </div>
                    {form.rewardRef && form.rewardName && (
                      <div className="text-[10px] text-purple-700 bg-purple-100 px-2 py-1.5 rounded-lg flex items-center gap-1">
                        <Gift size={10} /> เมื่อซื้อ จะออก "คูปองสินค้าฟรี" เข้าบัญชีลูกค้าอัตโนมัติ — ใช้ได้ที่หน้า POS ราคา ฿0
                      </div>
                    )}
                  </div>
                )}

                {/* COUPON: coupon ID/name + qty */}
                {form.rewardType === "COUPON" && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">ID / ชื่อคูปอง (จากหน้าคูปอง)</label>
                      <input value={form.rewardRef} onChange={e => setForm(p => ({ ...p, rewardRef: e.target.value }))}
                        placeholder="เช่น CPT-xxx หรือ ส่วนลด 10%"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">จำนวน</label>
                      <input type="number" value={form.rewardQty} onChange={e => setForm(p => ({ ...p, rewardQty: e.target.value }))}
                        placeholder="1" min="1"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-purple-400" />
                    </div>
                    {form.rewardRef && (
                      <div className="col-span-3 text-[10px] text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">
                        เมื่อซื้อ จะออกคูปองนี้ให้ลูกค้าโดยอัตโนมัติ
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expiry */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">อายุการใช้งาน (วัน)</label>
                <input type="number" value={form.expiryDays} onChange={e => setForm(p => ({ ...p, expiryDays: e.target.value }))}
                  placeholder="365" min="1" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                <p className="text-xs text-gray-400 mt-1">นับจากวันที่ซื้อ (default 365 วัน)</p>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">รายละเอียด</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="px-6 py-4 border-t shrink-0">
              <button onClick={handleSave} disabled={isSaving}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> บันทึกแพคเกจ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Buy Session Package ════════════════════ */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag size={18} className="text-violet-600" /> ลูกค้าซื้อแพคเกจครั้ง
              </h3>
              <button onClick={() => setShowBuyModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Customer */}
              <div className="relative">
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชื่อลูกค้า <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input value={buyForm.customerName} onChange={e => onCustomerInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="ค้นหาหรือพิมพ์ชื่อลูกค้า..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
                </div>
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {customerSuggestions.map((c, i) => (
                      <button key={i} onMouseDown={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 flex items-center justify-between">
                        <span className="font-medium text-gray-900">{c.Name}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={11} />{c.Phone || "-"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เบอร์โทร</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input value={buyForm.phone} onChange={e => setBuyForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0812345678"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
                </div>
              </div>

              {/* Package */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">แพคเกจ <span className="text-red-500">*</span></label>
                <select value={buyForm.packageId}
                  onChange={e => {
                    const pkg = packages.find(p => p.PackageID === e.target.value);
                    setBuyForm(p => ({ ...p, packageId: e.target.value, paidAmount: pkg ? String(pkg.Price || "") : "" }));
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400">
                  <option value="">-- เลือกแพคเกจ --</option>
                  {sessionPackages.map(pkg => (
                    <option key={pkg.PackageID} value={pkg.PackageID}>
                      {pkg.Name} — {Number(pkg.SessionCount || 0)} ครั้ง / ฿{Number(pkg.Price).toLocaleString()} / {Number(pkg.ExpiryDays || 365)} วัน
                    </option>
                  ))}
                </select>
              </div>

              {/* Paid amount */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ยอดที่รับชำระ (฿)</label>
                <input type="number" value={buyForm.paidAmount} onChange={e => setBuyForm(p => ({ ...p, paidAmount: e.target.value }))}
                  placeholder="0" min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
              </div>

              {/* Reward preview */}
              {(() => {
                const selPkg = packages.find(p => p.PackageID === buyForm.packageId);
                if (!selPkg || !selPkg.RewardType || selPkg.RewardType === "NONE" || !selPkg.RewardRef) return null;
                const rewardLabel = selPkg.RewardType === "ITEM"
                  ? (selPkg.RewardName || selPkg.RewardRef)
                  : selPkg.RewardRef;
                return (
                  <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 text-xs">
                    <Gift size={14} className="text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-purple-700">ของแถมที่ลูกค้าจะได้รับ: </span>
                      <span className="text-purple-600 font-medium">
                        {selPkg.RewardType === "ITEM" ? "🎁 " : "🎟 "}{rewardLabel} x{Number(selPkg.RewardQty || 1)}
                      </span>
                      {selPkg.RewardType === "ITEM" && (
                        <div className="text-purple-400 mt-0.5">ระบบจะออกคูปองสินค้าฟรีเข้าบัญชีลูกค้าอัตโนมัติ — ใช้ได้ที่ POS ราคา ฿0</div>
                      )}
                      {selPkg.RewardType === "COUPON" && (
                        <div className="text-purple-400 mt-0.5">จะออกคูปองอัตโนมัติเมื่อยืนยัน</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <button onClick={handleBuySession} disabled={isBuying}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {isBuying ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> ยืนยันซื้อแพคเกจ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Use Session ════════════════════════════ */}
      {showUseModal && useTarget && (() => {
        const total     = parseInt(useTarget.TotalSessions) || 0;
        const used      = parseInt(useTarget.UsedSessions)  || 0;
        const remaining = total - used;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Scissors size={18} className="text-violet-600" /> ใช้ครั้ง
                </h3>
                <button onClick={() => setShowUseModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                {/* Customer info */}
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="font-bold text-violet-800 text-base">{useTarget.CustomerName}</div>
                  <div className="text-violet-600">{useTarget.PackageName}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-500">ครั้งคงเหลือ</span>
                    <span className={`font-bold text-xl ${remaining <= 1 ? "text-red-500" : "text-violet-700"}`}>
                      {remaining} <span className="text-sm font-normal text-gray-400">/ {total}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} /> หมดอายุ: {fmt(useTarget.ExpiryDate)}
                  </div>
                </div>

                {/* Sessions to use */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">จำนวนครั้งที่ใช้</label>
                  <input type="number" value={useForm.sessionsUsed}
                    onChange={e => setUseForm(p => ({ ...p, sessionsUsed: e.target.value }))}
                    min="1" max={remaining}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">หมายเหตุ (เช่น บริการที่ใช้)</label>
                  <input value={useForm.note} onChange={e => setUseForm(p => ({ ...p, note: e.target.value }))}
                    placeholder="เช่น Grooming Golden Retriever"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
                </div>

                {parseInt(useForm.sessionsUsed) >= remaining && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertCircle size={13} /> แพคเกจจะหมดหลังใช้งานนี้
                  </div>
                )}

                <button onClick={handleUseSession} disabled={isUsing}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {isUsing ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> ยืนยันใช้ {useForm.sessionsUsed} ครั้ง</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Extend Expiry ═══════════════════════════ */}
      {showExtendModal && extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" /> ต่ออายุแพคเกจ
              </h3>
              <button onClick={() => setShowExtendModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1 text-sm">
                <div className="font-bold text-blue-800">{extendTarget.CustomerName}</div>
                <div className="text-blue-600">{extendTarget.PackageName}</div>
                <div className="text-gray-500 text-xs mt-1">อายุปัจจุบัน: {fmt(extendTarget.ExpiryDate)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">วันหมดอายุใหม่ <span className="text-red-500">*</span></label>
                <input type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={handleExtendExpiry} disabled={isExtending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {isExtending ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก...</> : <><Check size={16} /> ยืนยันต่ออายุ</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

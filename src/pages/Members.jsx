import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, Search, Star, Ticket, ChevronDown, ChevronUp, Phone, MapPin, Hash,
  Loader2, Download, X, History, TrendingUp, TrendingDown, Plus, Minus,
  Scissors, Clock, Check, AlertCircle, Mail, MessageCircle, StickyNote,
  Edit2, Trash2, PawPrint, ShoppingBag, Calendar, Heart, Weight,
  Syringe, AlertTriangle, FileText, RefreshCw,
} from "lucide-react";
import { fetchApi, postApi, invalidateCache } from "../api";
import { exportToExcel } from "../utils/excelExport";
import toast from "react-hot-toast";

// ── constants ───────────────────────────────────────────────────────────
const MANUAL_REASONS = [
  "ซื้อแพคเกจพิเศษ", "รีวิวร้าน / Follow Social Media",
  "แนะนำลูกค้าใหม่", "ชดเชยความไม่สะดวก", "โปรโมชั่นพิเศษ", "อื่นๆ",
];
const SPECIES_LIST = ["สุนัข", "แมว", "กระต่าย", "นกแก้ว", "หนูแฮมสเตอร์", "ปลา", "เต่า", "อื่นๆ"];
const SPECIES_EMOJI = { "สุนัข": "🐕", "แมว": "🐈", "กระต่าย": "🐇", "นกแก้ว": "🦜", "หนูแฮมสเตอร์": "🐹", "ปลา": "🐟", "เต่า": "🐢", "อื่นๆ": "🐾" };

const EMPTY_PET = {
  petId: "", customerName: "", petName: "", species: "สุนัข", breed: "",
  birthDate: "", weight: "", color: "", vaccineDate: "", nextVaccineDate: "",
  medicalNotes: "", allergies: "", notes: "",
};

const EMPTY_CUST_EDIT = {
  customerId: "", name: "", phone: "", email: "", lineId: "",
  taxId: "", taxAddress: "", address: "", birthday: "", notes: "",
};

const EXPANDED_TABS = [
  { k: "info",      label: "ข้อมูล",        icon: Users },
  { k: "pets",      label: "สัตว์เลี้ยง",   icon: PawPrint },
  { k: "coupons",   label: "คูปอง",         icon: Ticket },
  { k: "packages",  label: "แพคเกจครั้ง",   icon: Scissors },
  { k: "points",    label: "ประวัติพ้อย",   icon: Star },
  { k: "purchases", label: "ประวัติซื้อ",   icon: ShoppingBag },
];

// ── helpers ─────────────────────────────────────────────────────────────
function fmtFull(val) {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString("th-TH", { dateStyle: "medium" });
}
function ageStr(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d)) return null;
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  let m = now.getMonth() - d.getMonth();
  if (m < 0) { y--; m += 12; }
  if (y > 0) return `${y} ปี ${m} เดือน`;
  return `${m} เดือน`;
}

function cpStatusBadge(status) {
  const map = {
    ACTIVE:  { cls: "bg-green-50 text-green-700 border-green-100", label: "ใช้งาน" },
    USED_UP: { cls: "bg-gray-100 text-gray-500 border-gray-200",   label: "หมดแล้ว" },
    EXPIRED: { cls: "bg-red-50 text-red-600 border-red-100",       label: "หมดอายุ" },
  };
  const s = map[status] || map.ACTIVE;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>;
}

// ── main component ───────────────────────────────────────────────────────
export default function Members() {
  // data
  const [customers, setCustomers]           = useState([]);
  const [coupons, setCoupons]               = useState([]);
  const [pointsHistory, setPointsHistory]   = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [pets, setPets]                     = useState([]);
  const [transactions, setTransactions]     = useState([]);
  const [txLoaded, setTxLoaded]             = useState(false);
  const [isLoading, setIsLoading]           = useState(true);

  // UI state
  const [search, setSearch]       = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTab, setExpandedTab] = useState({}); // { rowId: tabKey }
  const [sortPoints, setSortPoints] = useState("");
  const [creditSearch, setCreditSearch] = useState({});

  // Modals
  const [petModal, setPetModal]         = useState(null); // { mode:"add"|"edit", customer, pet }
  const [editCustModal, setEditCustModal] = useState(null); // customer obj
  const [pointsModal, setPointsModal]   = useState(null); // customer obj
  const [confirmDel, setConfirmDel]     = useState(null); // { petId, petName }

  // Form states
  const [petForm, setPetForm]   = useState(EMPTY_PET);
  const [custForm, setCustForm] = useState(EMPTY_CUST_EDIT);
  const [ptForm, setPtForm]     = useState({ delta: "", reason: MANUAL_REASONS[0], customReason: "", mode: "add" });

  // Saving flags
  const [savingPet, setSavingPet]   = useState(false);
  const [savingCust, setSavingCust] = useState(false);
  const [savingPt, setSavingPt]     = useState(false);
  const [deletingPet, setDeletingPet] = useState(false);

  // ── data loading ─────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      fetchApi("getCustomers",       { skipCache: true }),
      fetchApi("getCustomerCoupons", { skipCache: true }),
      fetchApi("getPointsHistory",   { skipCache: true }),
      fetchApi("getCustomerPackages",{ skipCache: true }),
      fetchApi("getPets",            { skipCache: true }),
    ]).then(([custs, couponData, histData, cpData, petsData]) => {
      setCustomers(Array.isArray(custs)       ? custs : []);
      setCoupons(Array.isArray(couponData)    ? couponData : []);
      setPointsHistory(Array.isArray(histData) ? [...histData].reverse() : []);
      setCustomerPackages(Array.isArray(cpData) ? cpData : []);
      setPets(Array.isArray(petsData) ? petsData.filter(p => p.Status !== "DELETED") : []);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadTransactions = useCallback(async () => {
    if (txLoaded) return;
    const txs = await fetchApi("getTransactions");
    setTransactions(Array.isArray(txs) ? txs : []);
    setTxLoaded(true);
  }, [txLoaded]);

  // ── derived maps ─────────────────────────────────────────────────────
  const creditHistoryByName = useMemo(() => {
    const map = {};
    pointsHistory.forEach(h => {
      const k = String(h.CustomerName || "").trim().toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(h);
    });
    return map;
  }, [pointsHistory]);

  const cpByName = useMemo(() => {
    const map = {};
    customerPackages.forEach(cp => {
      const k = String(cp.CustomerName || "").trim().toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(cp);
    });
    return map;
  }, [customerPackages]);

  const petsByName = useMemo(() => {
    const map = {};
    pets.forEach(p => {
      const k = String(p.CustomerName || "").trim().toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(p);
    });
    return map;
  }, [pets]);

  const getCreditHistory   = name => creditHistoryByName[String(name||"").trim().toLowerCase()] || [];
  const getCustPackages    = name => cpByName[String(name||"").trim().toLowerCase()] || [];
  const getCustPets        = name => petsByName[String(name||"").trim().toLowerCase()] || [];
  const getActiveCoupons   = name => coupons.filter(cc =>
    String(cc.CustomerName||"") === String(name||"") &&
    String(cc.Status||"").toUpperCase() === "ACTIVE"
  );

  const getPurchases = useCallback(name => {
    const n = String(name||"").trim().toLowerCase();
    return transactions.filter(tx => {
      const info = String(tx.CustomerInfo || "");
      if (!info || info === "{}") return false;
      try {
        const obj  = JSON.parse(info);
        const tname = String(obj.name || obj.customerName || "").trim().toLowerCase();
        return tname === n;
      } catch { return false; }
    });
  }, [transactions]);

  // ── filter / sort ─────────────────────────────────────────────────────
  const filtered = useMemo(() => customers
    .filter(c => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        String(c.Name||"").toLowerCase().includes(q) ||
        String(c.Phone||"").includes(q) ||
        String(c.Email||"").toLowerCase().includes(q) ||
        String(c.CustomerID||"").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!sortPoints) return 0;
      const pa = parseFloat(a.Points)||0, pb = parseFloat(b.Points)||0;
      return sortPoints === "asc" ? pa - pb : pb - pa;
    })
  , [customers, search, sortPoints]);

  const cycleSortPoints = () => setSortPoints(p => p===""?"desc":p==="desc"?"asc":"");

  // ── expand / tab ─────────────────────────────────────────────────────
  const toggleExpand = id => {
    setExpandedId(prev => {
      if (prev === id) return null;
      if (!expandedTab[id]) setExpandedTab(t => ({ ...t, [id]: "info" }));
      return id;
    });
  };
  const setTab = (id, tab) => {
    setExpandedTab(t => ({ ...t, [id]: tab }));
    if (tab === "purchases") loadTransactions();
  };

  // ── export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (filtered.length === 0) { toast.error("ไม่มีข้อมูลที่จะส่งออก"); return; }
    exportToExcel(filtered.map((c,i) => ({
      "ลำดับ": i+1, "รหัสสมาชิก": c.CustomerID||"-", "ชื่อ": c.Name||"-",
      "เบอร์โทร": c.Phone||"-", "Email": c.Email||"-", "Line ID": c.LineID||"-",
      "เลขภาษี": c.TaxID||"-", "เครดิตสะสม": parseFloat(c.Points)||0,
      "สัตว์เลี้ยง": getCustPets(c.Name).map(p=>p.PetName).join(", ")||"-",
      "วันเกิดลูกค้า": fmtDate(c.Birthday),
      "วันที่สมัคร": fmtFull(c.CreatedAt),
    })), "Members", "Members_List");
  };

  // ── edit customer ─────────────────────────────────────────────────────
  const openEditCust = (c, e) => {
    e.stopPropagation();
    setCustForm({
      customerId: c.CustomerID||"", name: c.Name||"", phone: c.Phone||"",
      email: c.Email||"", lineId: c.LineID||"", taxId: c.TaxID||"",
      taxAddress: c.TaxAddress||"", address: c.Address||"",
      birthday: c.Birthday ? String(c.Birthday).split("T")[0] : "",
      notes: c.Notes||"",
    });
    setEditCustModal(c);
  };
  const handleSaveCust = async () => {
    if (!custForm.name.trim()) { toast.error("กรุณาระบุชื่อ"); return; }
    setSavingCust(true);
    const res = await postApi({ action: "saveCustomer", payload: {
      customerId: custForm.customerId, name: custForm.name.trim(),
      phone: custForm.phone, email: custForm.email, lineId: custForm.lineId,
      taxId: custForm.taxId, taxAddress: custForm.taxAddress, address: custForm.address,
      birthday: custForm.birthday, notes: custForm.notes,
    }});
    setSavingCust(false);
    if (res.success) {
      toast.success("อัพเดทข้อมูลสมาชิกสำเร็จ");
      invalidateCache("getCustomers"); loadAll(); setEditCustModal(null);
    } else toast.error(res.error||"บันทึกไม่สำเร็จ");
  };

  // ── pet CRUD ──────────────────────────────────────────────────────────
  const openAddPet = (customer, e) => {
    e.stopPropagation();
    setPetForm({ ...EMPTY_PET, customerName: customer.Name });
    setPetModal({ mode: "add", customer });
  };
  const openEditPet = (customer, pet, e) => {
    e.stopPropagation();
    setPetForm({
      petId: pet.PetID||"", customerName: customer.Name,
      petName: pet.PetName||"", species: pet.Species||"สุนัข", breed: pet.Breed||"",
      birthDate: pet.BirthDate ? String(pet.BirthDate).split("T")[0] : "",
      weight: String(pet.Weight||""), color: pet.Color||"",
      vaccineDate: pet.VaccineDate ? String(pet.VaccineDate).split("T")[0] : "",
      nextVaccineDate: pet.NextVaccineDate ? String(pet.NextVaccineDate).split("T")[0] : "",
      medicalNotes: pet.MedicalNotes||"", allergies: pet.Allergies||"", notes: pet.Notes||"",
    });
    setPetModal({ mode: "edit", customer, pet });
  };
  const handleSavePet = async () => {
    if (!petForm.petName.trim()) { toast.error("กรุณาระบุชื่อสัตว์เลี้ยง"); return; }
    setSavingPet(true);
    const res = await postApi({ action: "savePet", payload: petForm });
    setSavingPet(false);
    if (res.success) {
      toast.success(petModal.mode === "add" ? "เพิ่มสัตว์เลี้ยงสำเร็จ" : "อัพเดทสำเร็จ");
      invalidateCache("getPets"); loadAll(); setPetModal(null);
    } else toast.error(res.error||"บันทึกไม่สำเร็จ");
  };
  const handleDeletePet = async () => {
    if (!confirmDel) return;
    setDeletingPet(true);
    const res = await postApi({ action: "deletePet", payload: { petId: confirmDel.petId } });
    setDeletingPet(false);
    if (res.success) {
      toast.success("ลบสัตว์เลี้ยงสำเร็จ");
      invalidateCache("getPets"); loadAll(); setConfirmDel(null);
    } else toast.error(res.error||"ลบไม่สำเร็จ");
  };

  // ── manual points ─────────────────────────────────────────────────────
  const openPointsModal = (c, e) => {
    e.stopPropagation();
    setPtForm({ delta: "", reason: MANUAL_REASONS[0], customReason: "", mode: "add" });
    setPointsModal(c);
  };
  const handleSavePt = async () => {
    const delta = parseFloat(ptForm.delta)||0;
    if (delta <= 0) { toast.error("กรุณาระบุจำนวนพ้อย"); return; }
    const actual = ptForm.mode === "deduct" ? -delta : delta;
    const reason = ptForm.reason === "อื่นๆ" ? (ptForm.customReason.trim()||"Manual") : ptForm.reason;
    setSavingPt(true);
    const res = await postApi({ action: "addManualPoints", payload: { customerName: pointsModal.Name, points: actual, reason }});
    setSavingPt(false);
    if (res.success) {
      toast.success(res.message||"บันทึกสำเร็จ");
      invalidateCache("getCustomers"); invalidateCache("getPointsHistory");
      loadAll(); setPointsModal(null);
    } else toast.error(res.error||"บันทึกไม่สำเร็จ");
  };

  // ── render ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
        <span className="text-sm">กำลังโหลดข้อมูลสมาชิก...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> จัดการสมาชิก
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {customers.length} สมาชิก · {pets.length} สัตว์เลี้ยง · {customerPackages.filter(cp=>cp.Status==="ACTIVE").length} แพคเกจที่ใช้งานอยู่
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { ["getCustomers","getCustomerCoupons","getPointsHistory","getCustomerPackages","getPets"].forEach(k=>invalidateCache(k)); loadAll(); }}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> รีเฟรช
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์ / Email / รหัสสมาชิก..."
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          {search && <button onClick={()=>setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
        <button onClick={cycleSortPoints}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${sortPoints?"border-yellow-400 bg-yellow-50 text-yellow-700":"border-gray-200 bg-gray-50 text-gray-500 hover:border-yellow-300 hover:text-yellow-600"}`}>
          <Star size={14} />
          เครดิต{sortPoints==="desc"?" ↓ มากสุด":sortPoints==="asc"?" ↑ น้อยสุด":" (เรียงลำดับ)"}
        </button>
        <div className="text-sm text-gray-400 ml-auto">
          แสดง <span className="font-semibold text-gray-700">{filtered.length}</span> / {customers.length}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
              <Users size={48} className="opacity-20" />
              <span className="text-sm">{search?"ไม่พบสมาชิกที่ค้นหา":"ยังไม่มีข้อมูลสมาชิก"}</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-indigo-50/60 sticky top-0 z-10">
                <tr className="border-b border-indigo-100 text-sm font-semibold text-indigo-800">
                  <th className="py-3 px-5">ชื่อ / ติดต่อ</th>
                  <th className="py-3 px-4">สัตว์เลี้ยง</th>
                  <th className="py-3 px-4 text-right cursor-pointer select-none hover:bg-indigo-100/60" onClick={cycleSortPoints}>
                    <span className="flex items-center justify-end gap-1">เครดิต {sortPoints==="desc"?"↓":sortPoints==="asc"?"↑":"↕"}</span>
                  </th>
                  <th className="py-3 px-4 text-center">แพคเกจครั้ง</th>
                  <th className="py-3 px-4">วันที่สมัคร</th>
                  <th className="py-3 px-4 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const rowId = c.CustomerID || c.Name || idx;
                  const isExp = expandedId === rowId;
                  const custPets    = getCustPets(c.Name);
                  const activeCP    = getCustPackages(c.Name).filter(cp=>cp.Status==="ACTIVE");

                  return [
                    /* ── main row ── */
                    <tr key={`row-${rowId}`} onClick={()=>toggleExpand(rowId)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-indigo-50/30 ${isExp?"bg-indigo-50/40":""}`}>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-gray-900 text-sm">{c.Name||"-"}</div>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          {c.Phone && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Phone size={10}/>{c.Phone}</span>}
                          {c.Email && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Mail size={10}/>{c.Email}</span>}
                          {c.LineID && <span className="text-xs text-green-600 flex items-center gap-0.5"><MessageCircle size={10}/>{c.LineID}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {custPets.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {custPets.slice(0,3).map((p,pi)=>(
                              <span key={pi} className="text-xs bg-orange-50 border border-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                {SPECIES_EMOJI[p.Species]||"🐾"} {p.PetName}
                              </span>
                            ))}
                            {custPets.length>3 && <span className="text-xs text-gray-400">+{custPets.length-3}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-300">ยังไม่มี</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Star size={11}/>{Number(c.Points||0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {activeCP.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {activeCP.slice(0,2).map((cp,pi)=>{
                              const rem = (parseInt(cp.TotalSessions)||0)-(parseInt(cp.UsedSessions)||0);
                              return <span key={pi} className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium"><Scissors size={10} className="inline mr-0.5"/>{rem}ครั้ง</span>;
                            })}
                          </div>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{fmtDate(c.CreatedAt)}</td>
                      <td className="py-3.5 px-4 text-center text-gray-400">
                        {isExp ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </td>
                    </tr>,

                    /* ── expanded row ── */
                    isExp && (
                      <tr key={`detail-${rowId}`} className="bg-slate-50/60">
                        <td colSpan={6} className="px-4 pt-1 pb-5">
                          {/* Tab bar */}
                          <div className="flex gap-0.5 bg-white border border-gray-100 rounded-xl p-1 mb-4 w-fit shadow-sm">
                            {EXPANDED_TABS.map(t => {
                              const Icon = t.icon;
                              const active = (expandedTab[rowId]||"info") === t.k;
                              return (
                                <button key={t.k}
                                  onClick={e=>{e.stopPropagation(); setTab(rowId,t.k);}}
                                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${active?"bg-indigo-600 text-white shadow":"text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                  <Icon size={13}/>{t.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* ── tab: ข้อมูล ── */}
                          {(expandedTab[rowId]||"info") === "info" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Users size={14}/>ข้อมูลสมาชิก</h4>
                                  <div className="flex gap-1.5">
                                    <button onClick={e=>openPointsModal(c,e)}
                                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors">
                                      <Star size={11}/>พ้อย
                                    </button>
                                    <button onClick={e=>openEditCust(c,e)}
                                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                                      <Edit2 size={11}/>แก้ไข
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                  <InfoRow icon={<Hash size={12}/>}           label="รหัสสมาชิก"  value={c.CustomerID||"-"} mono />
                                  <InfoRow icon={<Users size={12}/>}          label="ชื่อ"         value={c.Name||"-"} />
                                  <InfoRow icon={<Phone size={12}/>}          label="เบอร์โทร"     value={c.Phone||"-"} />
                                  <InfoRow icon={<Mail size={12}/>}           label="Email"        value={c.Email||"-"} />
                                  <InfoRow icon={<MessageCircle size={12}/>}  label="Line ID"      value={c.LineID||"-"} />
                                  <InfoRow icon={<Calendar size={12}/>}       label="วันเกิด"      value={fmtDate(c.Birthday)} />
                                  <InfoRow icon={<Hash size={12}/>}           label="เลขภาษี"      value={c.TaxID||"-"} mono />
                                  <InfoRow icon={<Star size={12}/>}           label="เครดิตสะสม"
                                    value={<span className="font-bold text-yellow-600">{Number(c.Points||0).toLocaleString()} pts</span>} />
                                  <InfoRow icon={<MapPin size={12}/>}         label="ที่อยู่ภาษี"  value={c.TaxAddress||"-"} />
                                  <InfoRow icon={<MapPin size={12}/>}         label="ที่อยู่"       value={c.Address||"-"} />
                                </div>
                                {c.Notes && (
                                  <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                                    <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-500"/> {c.Notes}
                                  </div>
                                )}
                              </div>
                              {/* Quick stats card */}
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { label: "สัตว์เลี้ยง",      val: getCustPets(c.Name).length,          color: "bg-orange-50 text-orange-700 border-orange-100",  icon: <PawPrint size={18}/> },
                                    { label: "คูปองใช้ได้",      val: getActiveCoupons(c.Name).length,      color: "bg-indigo-50 text-indigo-700 border-indigo-100",  icon: <Ticket size={18}/> },
                                    { label: "แพคเกจครั้งใช้งาน",val: getCustPackages(c.Name).filter(cp=>cp.Status==="ACTIVE").length, color: "bg-violet-50 text-violet-700 border-violet-100", icon: <Scissors size={18}/> },
                                    { label: "เครดิตสะสม",       val: Number(c.Points||0).toLocaleString()+" pts", color: "bg-yellow-50 text-yellow-700 border-yellow-100", icon: <Star size={18}/> },
                                  ].map((s,si)=>(
                                    <div key={si} className={`rounded-2xl border p-4 flex items-center gap-3 ${s.color}`}>
                                      <div className="opacity-60">{s.icon}</div>
                                      <div>
                                        <div className="font-bold text-lg leading-tight">{s.val}</div>
                                        <div className="text-xs opacity-70">{s.label}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-xs text-gray-500 space-y-1.5">
                                  <div className="font-semibold text-gray-700 mb-2">Timeline</div>
                                  <div className="flex justify-between"><span>สมัครสมาชิก</span><span className="font-medium text-gray-800">{fmtFull(c.CreatedAt)}</span></div>
                                  <div className="flex justify-between"><span>อัพเดทล่าสุด</span><span className="font-medium text-gray-800">{fmtFull(c.UpdatedAt)}</span></div>
                                  <div className="flex justify-between"><span>อัพเดทพ้อยล่าสุด</span><span className="font-medium text-gray-800">{fmtFull(c.PointsUpdatedAt)}</span></div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── tab: สัตว์เลี้ยง ── */}
                          {(expandedTab[rowId]||"info") === "pets" && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><PawPrint size={14}/>สัตว์เลี้ยง ({getCustPets(c.Name).length})</h4>
                                <button onClick={e=>openAddPet(c,e)}
                                  className="flex items-center gap-1 text-xs px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors">
                                  <Plus size={13}/> เพิ่มสัตว์เลี้ยง
                                </button>
                              </div>
                              {getCustPets(c.Name).length === 0 ? (
                                <div className="bg-white border border-dashed border-orange-200 rounded-2xl py-12 flex flex-col items-center gap-2 text-gray-400">
                                  <PawPrint size={36} className="opacity-20"/>
                                  <p className="text-sm">ยังไม่มีสัตว์เลี้ยง กด "เพิ่มสัตว์เลี้ยง" เพื่อเพิ่ม</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {getCustPets(c.Name).map((pet,pi)=>(
                                    <PetCard key={pi} pet={pet}
                                      onEdit={e=>openEditPet(c,pet,e)}
                                      onDelete={e=>{e.stopPropagation();setConfirmDel({petId:pet.PetID,petName:pet.PetName});}}/>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── tab: คูปอง ── */}
                          {(expandedTab[rowId]||"info") === "coupons" && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><Ticket size={14}/>คูปองทั้งหมด</h4>
                              {getActiveCoupons(c.Name).length === 0 ? (
                                <div className="bg-white border border-dashed border-indigo-200 rounded-2xl py-10 flex flex-col items-center gap-2 text-gray-400">
                                  <Ticket size={32} className="opacity-20"/><p className="text-sm">ไม่มีคูปองที่ใช้ได้</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {getActiveCoupons(c.Name).map((cc,ci)=>(
                                    <div key={ci} className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
                                      <div>
                                        <div className="font-semibold text-gray-900">{cc.CouponName||cc.CouponID}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">หมดอายุ: {fmtDate(cc.ExpiryDate)}</div>
                                        {cc.Value && <div className="text-xs text-indigo-600 font-medium mt-1">ลด: {cc.Type==="PERCENT"?cc.Value+"%":"฿"+Number(cc.Value).toLocaleString()}</div>}
                                      </div>
                                      <span className="shrink-0 text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-semibold">ใช้ได้</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── tab: แพคเกจครั้ง ── */}
                          {(expandedTab[rowId]||"info") === "packages" && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3"><Scissors size={14}/>แพคเกจครั้ง ({getCustPackages(c.Name).length})</h4>
                              {getCustPackages(c.Name).length === 0 ? (
                                <div className="bg-white border border-dashed border-violet-200 rounded-2xl py-10 flex flex-col items-center gap-2 text-gray-400">
                                  <Scissors size={32} className="opacity-20"/><p className="text-sm">ยังไม่มีแพคเกจครั้ง</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {getCustPackages(c.Name).map((cp,pi)=>{
                                    const total = parseInt(cp.TotalSessions)||0;
                                    const used  = parseInt(cp.UsedSessions)||0;
                                    const rem   = total - used;
                                    const pct   = total>0 ? Math.round((used/total)*100) : 0;
                                    const isExp2= cp.ExpiryDate && new Date(cp.ExpiryDate)<new Date();
                                    const status= isExp2&&cp.Status==="ACTIVE"?"EXPIRED":(cp.Status||"ACTIVE");
                                    return (
                                      <div key={pi} className={`bg-white border rounded-2xl p-4 shadow-sm ${status==="ACTIVE"?"border-violet-100":"border-gray-100 opacity-70"}`}>
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                          <div>
                                            <div className="font-semibold text-violet-900 text-sm">{cp.PackageName||"-"}</div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock size={10}/> หมดอายุ: {fmtDate(cp.ExpiryDate)}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className={`font-bold text-lg ${rem===0?"text-gray-400":rem<=1?"text-red-500":"text-violet-700"}`}>
                                              {rem}<span className="text-xs font-normal text-gray-400">/{total}</span>
                                            </div>
                                            {cpStatusBadge(status)}
                                          </div>
                                        </div>
                                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${pct>=100?"bg-gray-400":pct>=70?"bg-red-400":"bg-violet-500"}`} style={{width:`${pct}%`}}/>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">ใช้แล้ว {used} ครั้ง · ฿{Number(cp.PaidAmount||0).toLocaleString()}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── tab: ประวัติพ้อย ── */}
                          {(expandedTab[rowId]||"info") === "points" && (() => {
                            const hist = getCreditHistory(c.Name);
                            const cKey = rowId;
                            const cq   = (creditSearch[cKey]||"").toLowerCase();
                            const visible = cq ? hist.filter(h=>
                              String(h.Reference||"").toLowerCase().includes(cq)||
                              String(h.Type||"").includes(cq)
                            ) : hist;
                            const earnT   = hist.filter(h=>h.Type==="EARN"||h.Type==="MANUAL_ADD").reduce((s,h)=>s+(parseFloat(h.Points)||0),0);
                            const redeemT = hist.filter(h=>h.Type!=="EARN"&&h.Type!=="MANUAL_ADD").reduce((s,h)=>s+(parseFloat(h.Points)||0),0);
                            return (
                              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-50 bg-gray-50/40">
                                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                    <History size={14}/> ประวัติพ้อย
                                    <span className="bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">{hist.length}</span>
                                  </h4>
                                  <div className="flex gap-2 text-xs font-semibold">
                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full"><TrendingUp size={11}/> +{earnT.toLocaleString()}</span>
                                    <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full"><TrendingDown size={11}/> -{redeemT.toLocaleString()}</span>
                                    <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-100 px-2.5 py-1 rounded-full"><Star size={11}/> {Number(c.Points||0).toLocaleString()}</span>
                                  </div>
                                </div>
                                {hist.length === 0 ? (
                                  <div className="py-10 flex flex-col items-center gap-2 text-gray-400"><History size={32} className="opacity-20"/><span className="text-xs">ยังไม่มีประวัติ</span></div>
                                ) : (
                                  <>
                                    <div className="px-5 py-2.5 border-b border-gray-50 bg-gray-50/50">
                                      <div className="relative max-w-xs">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                        <input value={creditSearch[cKey]||""} onChange={e=>setCreditSearch(p=>({...p,[cKey]:e.target.value}))}
                                          onClick={e=>e.stopPropagation()} placeholder="ค้นหา..."
                                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"/>
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 sticky top-0">
                                          <tr className="border-b border-gray-100 text-gray-500 font-semibold">
                                            <th className="py-2 px-4">วันที่</th>
                                            <th className="py-2 px-4 text-center">ประเภท</th>
                                            <th className="py-2 px-4 text-right">พ้อย</th>
                                            <th className="py-2 px-4 text-right">คงเหลือ</th>
                                            <th className="py-2 px-4">หมายเหตุ</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {visible.map((h,hi)=>{
                                            const isEarn = h.Type==="EARN"||h.Type==="MANUAL_ADD";
                                            return (
                                              <tr key={hi} className={isEarn?"hover:bg-emerald-50/30":"hover:bg-red-50/30"}>
                                                <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{h.Date?new Date(h.Date).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"}):"-"}</td>
                                                <td className="py-2 px-4 text-center">
                                                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isEarn?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-600"}`}>
                                                    {isEarn?<TrendingUp size={9}/>:<TrendingDown size={9}/>} {isEarn?"รับ":"ใช้"}
                                                  </span>
                                                </td>
                                                <td className={`py-2 px-4 text-right font-bold ${isEarn?"text-emerald-600":"text-red-500"}`}>{isEarn?"+":"-"}{(parseFloat(h.Points)||0).toLocaleString()}</td>
                                                <td className="py-2 px-4 text-right font-semibold text-gray-700">{h.Balance!=null?Number(h.Balance).toLocaleString():"-"}</td>
                                                <td className="py-2 px-4 text-gray-500 max-w-[200px] truncate">{h.Reference||"-"}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {/* ── tab: ประวัติซื้อ ── */}
                          {(expandedTab[rowId]||"info") === "purchases" && (
                            <div>
                              {!txLoaded ? (
                                <div className="flex flex-col items-center py-10 gap-2 text-gray-400">
                                  <Loader2 size={28} className="animate-spin text-indigo-400"/><span className="text-sm">กำลังโหลดประวัติซื้อ...</span>
                                </div>
                              ) : (() => {
                                const purchases = getPurchases(c.Name).filter(tx=>tx.Status!=="CANCELLED");
                                const total = purchases.reduce((s,tx)=>s+(parseFloat(tx.TotalAmount)||0),0);
                                return (
                                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 bg-gray-50/40">
                                      <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                        <ShoppingBag size={14}/> ประวัติซื้อ
                                        <span className="bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">{purchases.length} บิล</span>
                                      </h4>
                                      <span className="text-sm font-bold text-gray-700">ยอดรวม ฿{total.toLocaleString()}</span>
                                    </div>
                                    {purchases.length === 0 ? (
                                      <div className="py-10 flex flex-col items-center gap-2 text-gray-400"><ShoppingBag size={32} className="opacity-20"/><span className="text-xs">ไม่มีประวัติซื้อที่ระบุชื่อลูกค้า</span></div>
                                    ) : (
                                      <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-gray-50 sticky top-0">
                                            <tr className="border-b border-gray-100 text-gray-500 font-semibold">
                                              <th className="py-2 px-4">วันที่</th>
                                              <th className="py-2 px-4">เลขที่บิล</th>
                                              <th className="py-2 px-4 text-right">ยอด (฿)</th>
                                              <th className="py-2 px-4">ช่องทางชำระ</th>
                                              <th className="py-2 px-4">รายการสินค้า</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-50">
                                            {purchases.map((tx,ti)=>{
                                              let cartItems = [];
                                              try { cartItems = JSON.parse(tx.CartDetails||"[]"); } catch{}
                                              return (
                                                <tr key={ti} className="hover:bg-gray-50/60">
                                                  <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{tx.Date?new Date(tx.Date).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"}):"-"}</td>
                                                  <td className="py-2.5 px-4 font-mono text-indigo-600">{tx.ReceiptNo||tx.OrderID||"-"}</td>
                                                  <td className="py-2.5 px-4 text-right font-bold text-gray-900">฿{Number(tx.TotalAmount||0).toLocaleString()}</td>
                                                  <td className="py-2.5 px-4 text-gray-500">{tx.PaymentMethod||"-"}</td>
                                                  <td className="py-2.5 px-4 text-gray-500 max-w-[220px] truncate">
                                                    {cartItems.map(item=>item.Name||item.name).filter(Boolean).join(", ")||"-"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
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

      {/* ══ MODAL: Edit Customer ══════════════════════════════════════════ */}
      {editCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Edit2 size={17} className="text-indigo-600"/>แก้ไขข้อมูลสมาชิก</h3>
              <button onClick={()=>setEditCustModal(null)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="ชื่อ *" value={custForm.name} onChange={v=>setCustForm(p=>({...p,name:v}))} placeholder="ชื่อลูกค้า"/>
                <Field label="เบอร์โทร" value={custForm.phone} onChange={v=>setCustForm(p=>({...p,phone:v}))} placeholder="0812345678"/>
                <Field label="Email" icon={<Mail size={13}/>} value={custForm.email} onChange={v=>setCustForm(p=>({...p,email:v}))} placeholder="email@example.com"/>
                <Field label="Line ID" icon={<MessageCircle size={13}/>} value={custForm.lineId} onChange={v=>setCustForm(p=>({...p,lineId:v}))} placeholder="@lineID"/>
                <Field label="วันเกิดลูกค้า" type="date" value={custForm.birthday} onChange={v=>setCustForm(p=>({...p,birthday:v}))}/>
                <Field label="เลขภาษี" value={custForm.taxId} onChange={v=>setCustForm(p=>({...p,taxId:v}))} placeholder="0000000000000"/>
              </div>
              <Field label="ที่อยู่ภาษี" value={custForm.taxAddress} onChange={v=>setCustForm(p=>({...p,taxAddress:v}))} placeholder="ที่อยู่ออกใบกำกับ"/>
              <Field label="ที่อยู่" value={custForm.address} onChange={v=>setCustForm(p=>({...p,address:v}))} placeholder="ที่อยู่สำหรับจัดส่ง"/>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">หมายเหตุ (Notes)</label>
                <textarea value={custForm.notes} onChange={e=>setCustForm(p=>({...p,notes:e.target.value}))}
                  placeholder="หมายเหตุพิเศษ เช่น ลูกค้า VIP / แพ้ยา / ชอบบริการพิเศษ"
                  rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"/>
              </div>
            </div>
            <div className="px-6 py-4 border-t shrink-0">
              <button onClick={handleSaveCust} disabled={savingCust}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {savingCust?<><Loader2 size={16} className="animate-spin"/>กำลังบันทึก...</>:<><Check size={16}/>บันทึกข้อมูล</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Add/Edit Pet ═══════════════════════════════════════════ */}
      {petModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PawPrint size={18} className="text-orange-500"/>
                {petModal.mode==="add"?"เพิ่มสัตว์เลี้ยง":"แก้ไขสัตว์เลี้ยง"}
                <span className="text-sm font-normal text-gray-400">— {petModal.customer.Name}</span>
              </h3>
              <button onClick={()=>setPetModal(null)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Basic */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="ชื่อสัตว์เลี้ยง *" value={petForm.petName} onChange={v=>setPetForm(p=>({...p,petName:v}))} placeholder="เช่น มะลิ"/>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ชนิด</label>
                  <select value={petForm.species} onChange={e=>setPetForm(p=>({...p,species:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400">
                    {SPECIES_LIST.map(s=><option key={s} value={s}>{SPECIES_EMOJI[s]} {s}</option>)}
                  </select>
                </div>
                <Field label="สายพันธุ์" value={petForm.breed} onChange={v=>setPetForm(p=>({...p,breed:v}))} placeholder="เช่น Golden Retriever"/>
                <Field label="สี / ลักษณะ" icon={<Heart size={13}/>} value={petForm.color} onChange={v=>setPetForm(p=>({...p,color:v}))} placeholder="เช่น สีทอง ขนยาว"/>
                <Field label="วันเกิด" icon={<Calendar size={13}/>} type="date" value={petForm.birthDate} onChange={v=>setPetForm(p=>({...p,birthDate:v}))}/>
                <Field label="น้ำหนัก (kg)" icon={<Weight size={13}/>} type="number" value={petForm.weight} onChange={v=>setPetForm(p=>({...p,weight:v}))} placeholder="5.5"/>
              </div>
              {/* Health */}
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Syringe size={12}/>สุขภาพ</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="วันฉีดวัคซีนล่าสุด" type="date" value={petForm.vaccineDate} onChange={v=>setPetForm(p=>({...p,vaccineDate:v}))}/>
                  <Field label="นัดฉีดวัคซีนถัดไป"  type="date" value={petForm.nextVaccineDate} onChange={v=>setPetForm(p=>({...p,nextVaccineDate:v}))}/>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><AlertTriangle size={12} className="text-red-400"/>โรคประจำตัว / ประวัติสุขภาพ</label>
                <textarea value={petForm.medicalNotes} onChange={e=>setPetForm(p=>({...p,medicalNotes:e.target.value}))}
                  placeholder="เช่น เบาหวาน / โรคไต / ผ่าตัดมาก่อน" rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 resize-none"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><AlertCircle size={12} className="text-red-400"/>สิ่งที่แพ้ (Allergies)</label>
                <textarea value={petForm.allergies} onChange={e=>setPetForm(p=>({...p,allergies:e.target.value}))}
                  placeholder="เช่น แพ้ยา / แพ้อาหาร / แพ้แชมพู" rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 resize-none"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><FileText size={12}/>หมายเหตุเพิ่มเติม</label>
                <textarea value={petForm.notes} onChange={e=>setPetForm(p=>({...p,notes:e.target.value}))}
                  placeholder="เช่น ชอบของเล่น / ขี้กลัว / ต้องการดูแลพิเศษ" rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 resize-none"/>
              </div>
            </div>
            <div className="px-6 py-4 border-t shrink-0">
              <button onClick={handleSavePet} disabled={savingPet}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {savingPet?<><Loader2 size={16} className="animate-spin"/>กำลังบันทึก...</>:<><Check size={16}/>บันทึกสัตว์เลี้ยง</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Manual Points ══════════════════════════════════════════ */}
      {pointsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Star size={18} className="text-yellow-500"/>เพิ่ม / หักพ้อย</h3>
              <button onClick={()=>setPointsModal(null)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <div><div className="font-bold text-gray-900">{pointsModal.Name}</div><div className="text-xs text-gray-500">{pointsModal.Phone||"-"}</div></div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">พ้อยปัจจุบัน</div>
                  <div className="font-bold text-yellow-600 text-lg flex items-center gap-1"><Star size={14}/>{Number(pointsModal.Points||0).toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{k:"add",label:"เพิ่มพ้อย",icon:<Plus size={14}/>,cls:"border-green-500 bg-green-50 text-green-700"},
                  {k:"deduct",label:"หักพ้อย",icon:<Minus size={14}/>,cls:"border-red-400 bg-red-50 text-red-600"}].map(t=>(
                  <button key={t.k} type="button" onClick={()=>setPtForm(p=>({...p,mode:t.k}))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${ptForm.mode===t.k?t.cls:"border-gray-200 text-gray-500"}`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
              <Field label="จำนวนพ้อย *" type="number" value={ptForm.delta} onChange={v=>setPtForm(p=>({...p,delta:v}))} placeholder="50"/>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">เหตุผล</label>
                <select value={ptForm.reason} onChange={e=>setPtForm(p=>({...p,reason:e.target.value}))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400">
                  {MANUAL_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                {ptForm.reason==="อื่นๆ" && (
                  <input value={ptForm.customReason} onChange={e=>setPtForm(p=>({...p,customReason:e.target.value}))}
                    placeholder="ระบุเหตุผล..." className="mt-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-yellow-400"/>
                )}
              </div>
              {ptForm.delta && parseFloat(ptForm.delta)>0 && (
                <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${ptForm.mode==="add"?"bg-green-50 text-green-700 border border-green-100":"bg-red-50 text-red-600 border border-red-100"}`}>
                  <AlertCircle size={13}/> พ้อยจะเป็น {Math.max(0,(Number(pointsModal.Points||0)+(ptForm.mode==="add"?1:-1)*parseFloat(ptForm.delta))).toLocaleString()} หลังบันทึก
                </div>
              )}
              <button onClick={handleSavePt} disabled={savingPt}
                className={`w-full py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${ptForm.mode==="add"?"bg-yellow-500 hover:bg-yellow-600":"bg-red-500 hover:bg-red-600"}`}>
                {savingPt?<><Loader2 size={16} className="animate-spin"/>กำลังบันทึก...</>:<><Check size={16}/>ยืนยัน{ptForm.mode==="add"?"เพิ่ม":"หัก"}พ้อย</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Confirm Delete Pet ═════════════════════════════════════ */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <Trash2 size={40} className="mx-auto text-red-400 mb-3"/>
            <h3 className="font-bold text-gray-900 text-lg">ลบสัตว์เลี้ยง?</h3>
            <p className="text-sm text-gray-500 mt-1 mb-5">ต้องการลบ <strong className="text-gray-800">{confirmDel.petName}</strong> ออกจากระบบ?</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmDel(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button onClick={handleDeletePet} disabled={deletingPet}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {deletingPet?<Loader2 size={15} className="animate-spin"/>:<Trash2 size={15}/>} ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────
function PetCard({ pet, onEdit, onDelete }) {
  const emoji = SPECIES_EMOJI[pet.Species] || "🐾";
  const age   = ageStr(pet.BirthDate);
  return (
    <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-gray-900">{pet.PetName}</div>
            <div className="text-xs text-gray-400">{pet.Species}{pet.Breed?` · ${pet.Breed}`:""}</div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={13}/></button>
          <button onClick={onDelete} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13}/></button>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        {pet.Color     && <PetRow icon={<Heart size={11}/>}    label="สี"          val={pet.Color}/>}
        {age           && <PetRow icon={<Calendar size={11}/>} label="อายุ"        val={age}/>}
        {pet.Weight>0  && <PetRow icon={<Weight size={11}/>}   label="น้ำหนัก"     val={`${pet.Weight} kg`}/>}
        {pet.VaccineDate && <PetRow icon={<Syringe size={11}/>} label="วัคซีนล่าสุด" val={fmtDate(pet.VaccineDate)}/>}
        {pet.NextVaccineDate && <PetRow icon={<Syringe size={11}/>} label="นัดถัดไป" val={fmtDate(pet.NextVaccineDate)} warn/>}
        {pet.Allergies && (
          <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 text-red-700 flex items-start gap-1">
            <AlertTriangle size={11} className="mt-0.5 shrink-0"/><span>{pet.Allergies}</span>
          </div>
        )}
        {pet.MedicalNotes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 text-amber-800 flex items-start gap-1">
            <FileText size={11} className="mt-0.5 shrink-0"/><span>{pet.MedicalNotes}</span>
          </div>
        )}
        {pet.Notes && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-gray-600 flex items-start gap-1">
            <StickyNote size={11} className="mt-0.5 shrink-0"/><span>{pet.Notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PetRow({ icon, label, val, warn }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={warn?"text-orange-400":"text-gray-300"}>{icon}</span>
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className={`font-medium ${warn?"text-orange-600":"text-gray-700"}`}>{val}</span>
    </div>
  );
}

function InfoRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-indigo-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-gray-400 w-24 shrink-0 text-xs">{label}</span>
      <span className={`text-gray-900 font-medium break-words min-w-0 text-sm ${mono?"font-mono text-xs":""}`}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", icon }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
        {icon && <span className="text-gray-400">{icon}</span>}{label}
      </label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"/>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Plus, Tag, Percent, Banknote, Power, Check, X, Loader2, ListPlus, Calendar, CalendarDays } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";

const DAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const DAY_FULL   = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const DAY_COLORS = [
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-purple-100 text-purple-700 border-purple-200",
];

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPromo, setEditPromo] = useState(null);

  // Form State
  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState("MIN_AMOUNT"); // MIN_AMOUNT or COMBO_ITEM
  const [conditionValue1, setConditionValue1] = useState("");
  const [comboItems, setComboItems] = useState(["", ""]); // Array for A + B + C...
  const [discountType, setDiscountType] = useState("FIXED"); // FIXED, PERCENT, or FREE_ITEM
  const [discountValue, setDiscountValue] = useState("");
  // Date & day scheduling
  const [startDate, setStartDate] = useState("");   // "YYYY-MM-DD" or ""
  const [endDate, setEndDate] = useState("");       // "YYYY-MM-DD" or ""
  const [activeDays, setActiveDays] = useState([]); // [] = all days, else [0,1,...] (0=Sun)

  const fetchData = async () => {
    setIsLoading(true);
    const [promoData, prodData] = await Promise.all([
      fetchApi("getPromotions"),
      fetchApi("getProducts")
    ]);
    setPromotions(Array.isArray(promoData) ? promoData : []);
    setProducts(Array.isArray(prodData) ? prodData : []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (promo = null) => {
    if (promo) {
      setEditPromo(promo);
      setName(promo.Name || "");
      setConditionType(promo.ConditionType || "MIN_AMOUNT");
      if (promo.ConditionType === "COMBO_ITEM") {
        if (String(promo.ConditionValue1 || "").includes(",")) {
          setComboItems(String(promo.ConditionValue1).split(","));
        } else if (promo.ConditionValue2) {
          // Backward compatibility
          setComboItems([promo.ConditionValue1, promo.ConditionValue2]);
        } else {
          setComboItems([promo.ConditionValue1 || ""]);
        }
        setConditionValue1("");
      } else {
        setConditionValue1(promo.ConditionValue1 || "");
        setComboItems(["", ""]);
      }
      setDiscountType(promo.DiscountType || "FIXED");
      setDiscountValue(promo.DiscountValue || "");
      setStartDate(promo.StartDate || "");
      setEndDate(promo.EndDate || "");
      setActiveDays(
        promo.ActiveDays && String(promo.ActiveDays).trim()
          ? String(promo.ActiveDays).split(",").map(Number)
          : []
      );
    } else {
      setEditPromo(null);
      setName("");
      setConditionType("MIN_AMOUNT");
      setConditionValue1("");
      setComboItems(["", ""]);
      setDiscountType("FIXED");
      setDiscountValue("");
      setStartDate("");
      setEndDate("");
      setActiveDays([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || (!discountValue && discountValue !== 0)) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    
    let finalCondition1 = conditionValue1;
    if (conditionType === "COMBO_ITEM") {
      const validCombos = comboItems.filter(Boolean);
      if (validCombos.length < 2) return alert("กรุณาเลือกรายการสินค้าซื้อให้ครบอย่างน้อย 2 รายการ");
      finalCondition1 = validCombos.join(",");
    }

    setIsSaving(true);
    const payload = {
      action: "savePromotion",
      payload: {
        promoId: editPromo ? editPromo.PromoID : "",
        name,
        conditionType,
        conditionValue1: finalCondition1,
        conditionValue2: "", // Deprecated, kept empty
        discountType,
        discountValue,
        status: editPromo ? editPromo.Status : "ACTIVE",
        startDate: startDate || "",
        endDate: endDate || "",
        activeDays: activeDays.length > 0 ? activeDays.sort((a, b) => a - b).join(",") : "",
      }
    };

    const res = await postApi(payload);
    setIsSaving(false);

    if (res.success) {
      setIsModalOpen(false);
      fetchData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handleToggleStatus = async (promoId) => {
    // Optimistic UI update
    setPromotions(prev => prev.map(p => p.PromoID === promoId ? { ...p, Status: p.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : p));
    
    await postApi({
      action: "togglePromotionStatus",
      payload: { promoId }
    });
    fetchData();
  };

  const getProductNameByBarcode = (bc) => {
    const found = products.find(p => String(p.Barcode) === String(bc));
    return found ? found.Name : bc;
  };

  // Format date "YYYY-MM-DD" → "1 ม.ค. 68"
  const fmtDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  // Parse activeDays string/array → array of numbers
  const parseDays = (val) => {
    if (!val && val !== 0) return [];
    if (Array.isArray(val)) return val.map(Number);
    return String(val).split(",").map(Number).filter(n => !isNaN(n));
  };

  // Check if a promo is currently in-date (for display hint)
  const getPromoDateStatus = (item) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    const days = parseDays(item.ActiveDays);
    const start = item.StartDate ? new Date(item.StartDate) : null;
    const end   = item.EndDate   ? new Date(item.EndDate)   : null;
    if (end) end.setHours(23, 59, 59, 999);

    const dateOk = (!start || today >= start) && (!end || today <= end);
    const dayOk  = days.length === 0 || days.includes(todayDay);
    if (!dateOk) {
      if (start && today < start) return { type: "future", label: `เริ่ม ${fmtDate(item.StartDate)}` };
      if (end   && today > end)   return { type: "expired", label: `หมดอายุแล้ว ${fmtDate(item.EndDate)}` };
    }
    if (!dayOk) return { type: "offday", label: `ไม่ใช่วันที่กำหนด` };
    return null;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Tag className="text-fuchsia-600" /> การจัดการโปรโมชั่น (Promotions)
          </h2>
          <p className="text-sm text-gray-500 mt-1">ตั้งค่าและจัดการส่วนลดแคมเปญต่างๆ ท้ายบิล</p>
        </div>
        
        <button 
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus size={18} /> สร้างโปรโมชั่นใหม่
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-fuchsia-50/50 sticky top-0 z-10">
              <tr className="border-b border-fuchsia-100 text-sm font-medium text-fuchsia-800">
                <th className="py-3 px-6">ชื่อโปรโมชั่น</th>
                <th className="py-3 px-6">เงื่อนไขการใช้</th>
                <th className="py-3 px-6">ส่วนลดที่ได้รับ</th>
                <th className="py-3 px-6 text-center">สถานะ</th>
                <th className="py-3 px-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="5" className="py-12 text-center text-gray-500 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> กำลังโหลดข้อมูลข้อมูล...</td></tr>
              ) : promotions.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-gray-500 flex flex-col items-center"><ListPlus size={48} className="opacity-20 mb-2"/> ยังไม่มีโปรโมชั่น กดสร้างใหม่ได้เลย!</td></tr>
              ) : promotions.map((item, idx) => (
                <tr key={idx} className={clsx("hover:bg-fuchsia-50/30 transition-colors", item.Status === "INACTIVE" && "opacity-60 bg-gray-50")}>
                  <td className="py-4 px-6 text-sm">
                    <div className="font-bold text-gray-900 text-base">{item.Name || "ไม่มีชื่อ"}</div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-gray-400 mt-0.5">{item.PromoID}</div>
                    {/* Date range */}
                    {(item.StartDate || item.EndDate) && (
                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-indigo-600 font-medium">
                        <Calendar size={11} />
                        {item.StartDate ? fmtDate(item.StartDate) : "ตั้งแต่ต้น"}
                        {" – "}
                        {item.EndDate ? fmtDate(item.EndDate) : "ไม่มีกำหนด"}
                      </div>
                    )}
                    {/* Active days */}
                    {parseDays(item.ActiveDays).length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {parseDays(item.ActiveDays).map(d => (
                          <span key={d} className={clsx("text-[10px] px-1.5 py-0.5 rounded border font-bold", DAY_COLORS[d])}>
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Date status hint */}
                    {(() => {
                      const st = getPromoDateStatus(item);
                      if (!st || item.Status !== "ACTIVE") return null;
                      return (
                        <span className={clsx("inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold",
                          st.type === "expired" ? "bg-red-100 text-red-600"
                          : st.type === "future" ? "bg-blue-100 text-blue-600"
                          : "bg-amber-100 text-amber-600"
                        )}>
                          {st.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    {item.ConditionType === "MIN_AMOUNT" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-500 text-xs">ยอดซื้อรวมขั้นต่ำกว่า:</span>
                        <span className="font-semibold text-emerald-600">฿{parseFloat(item.ConditionValue1 || 0).toLocaleString()}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 text-xs">
                        {(() => {
                           const items = String(item.ConditionValue1 || "").includes(",") 
                             ? String(item.ConditionValue1).split(",") 
                             : [item.ConditionValue1, item.ConditionValue2].filter(Boolean);
                           return items.map((bc, i) => (
                             <div key={i}><span className="text-gray-500">ซื้อชิ้นที่ {i+1}:</span> <span className="font-medium">{getProductNameByBarcode(bc)}</span></div>
                           ));
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-fuchsia-600 bg-fuchsia-50 px-3 py-1.5 rounded-lg w-max border border-fuchsia-100">
                      {item.DiscountType === "PERCENT" ? (
                        <>ลด {item.DiscountValue}% <Percent size={14} /></>
                      ) : item.DiscountType === "FREE_ITEM" ? (
                        <>แถม {getProductNameByBarcode(item.DiscountValue)} <Tag size={14} /></>
                      ) : (
                        <>ลด ฿{parseFloat(item.DiscountValue || 0).toLocaleString()} <Banknote size={14} /></>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleToggleStatus(item.PromoID)}
                      className={clsx(
                        "px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1",
                        item.Status === "ACTIVE" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                      )}
                    >
                      <Power size={12} /> {item.Status === "ACTIVE" ? "กำลังใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition-colors"
                      title="แก้ไข/ดูรายละเอียด"
                    >
                      <ListPlus size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 overflow-hidden transform transition-all flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{editPromo ? "แก้ไขโปรโมชั่น" : "สร้างโปรโมชั่นใหม่"}</h3>
                  <p className="text-xs text-gray-500">กำหนดเงื่อนไขและส่วนลดให้ระบบ POS คำนวณให้อัตโนมัติ</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อโปรโมชั่น (แสดงในบิล) *</label>
                <input
                  type="text" required
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="เช่น ซื้อครบ 1,000 ลด 100 บาท"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-gray-50 focus:bg-white text-sm transition-all"
                />
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 border-b pb-2"><Check size={16} className="text-emerald-500"/> เงื่อนไขที่ลูกค้าต้องทำ</h4>
                
                <div className="flex gap-4">
                  <label className={clsx(
                    "flex-1 border p-3 rounded-xl cursor-pointer transition-all flex items-center gap-2",
                    conditionType === "MIN_AMOUNT" ? "border-fuchsia-500 bg-fuchsia-50 ring-1 ring-fuchsia-500" : "bg-white hover:bg-gray-50 border-gray-200"
                  )}>
                    <input type="radio" className="w-4 h-4 text-fuchsia-600" checked={conditionType === "MIN_AMOUNT"} onChange={() => setConditionType("MIN_AMOUNT")} />
                    <span className="text-sm font-bold text-gray-800">ยอดซื้อขั้นต่ำ</span>
                  </label>
                  <label className={clsx(
                    "flex-1 border p-3 rounded-xl cursor-pointer transition-all flex items-center gap-2",
                    conditionType === "COMBO_ITEM" ? "border-fuchsia-500 bg-fuchsia-50 ring-1 ring-fuchsia-500" : "bg-white hover:bg-gray-50 border-gray-200"
                  )}>
                    <input type="radio" className="w-4 h-4 text-fuchsia-600" checked={conditionType === "COMBO_ITEM"} onChange={() => setConditionType("COMBO_ITEM")} />
                    <span className="text-sm font-bold text-gray-800">ซื้อสินค้าเป็นชุด (Combos)</span>
                  </label>
                </div>

                {conditionType === "MIN_AMOUNT" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">ยอดสั่งซื้อรวม (บาท) *</label>
                    <input
                      type="number" required min="1" step="0.01"
                      value={conditionValue1} onChange={e => setConditionValue1(e.target.value)}
                      placeholder="เช่น 1000"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-white text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comboItems.map((val, idx) => (
                      <div key={idx}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex justify-between">
                          <span>สินค้ารายการที่ {idx + 1} *</span>
                          {idx >= 2 && (
                            <button type="button" onClick={() => setComboItems(prev => prev.filter((_, i) => i !== idx))} className="text-fuchsia-600 hover:text-fuchsia-800 flex items-center gap-1">
                              <X size={12}/> ลบ
                            </button>
                          )}
                        </label>
                        <select
                          required value={val} onChange={e => {
                            const newCombo = [...comboItems];
                            newCombo[idx] = e.target.value;
                            setComboItems(newCombo);
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-white text-sm"
                        >
                          <option value="">-- เลือกสินค้ารายการที่ {idx + 1} --</option>
                          {products.map(p => <option key={p.Barcode} value={p.Barcode}>{p.Name} (บาร์โค้ด: {p.Barcode})</option>)}
                        </select>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setComboItems([...comboItems, ""])}
                      className="w-full py-2.5 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-fuchsia-600 hover:border-fuchsia-200 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> เพิ่มรายการสินค้าร่วมโปร
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-fuchsia-50 border border-fuchsia-100 space-y-4">
                <h4 className="font-bold text-sm text-fuchsia-800 flex items-center gap-1.5 border-b border-fuchsia-200/50 pb-2"><Banknote size={16} className="text-fuchsia-500"/> ส่วนลดที่ลูกค้าได้รับ</h4>
                <div className="flex gap-3">
                  <div className="w-[140px] shrink-0">
                    <label className="block text-xs font-semibold text-fuchsia-700 mb-1.5">รูปแบบการลด</label>
                    <select
                      value={discountType} onChange={e => setDiscountType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-white text-sm text-fuchsia-900 font-bold"
                    >
                      <option value="FIXED">ลดเป็นบาท (฿)</option>
                      <option value="PERCENT">ลดเปอร์เซ็นต์ (%)</option>
                      <option value="FREE_ITEM">ลดค่าของแถมเป็น (0฿)</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-fuchsia-700 mb-1.5">{discountType === "FREE_ITEM" ? "เลือกสินค้าของแถม *" : "มูลค่าส่วนลด *"}</label>
                    {discountType === "FREE_ITEM" ? (
                      <select
                        required value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-white text-sm font-bold text-fuchsia-900"
                      >
                        <option value="">-- เลือกสินค้าแถมฟรี --</option>
                        {products.map(p => <option key={p.Barcode} value={p.Barcode}>{p.Name}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number" required min="1" step="0.01" max={discountType === "PERCENT" ? 100 : undefined}
                        value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                        placeholder={discountType === "PERCENT" ? "เช่น 10" : "เช่น 100"}
                        className="w-full px-4 py-3 rounded-xl border border-fuchsia-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 bg-white text-sm font-bold text-fuchsia-900"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ── DATE RANGE ── */}
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-4">
                <h4 className="font-bold text-sm text-indigo-800 flex items-center gap-1.5 border-b border-indigo-200/50 pb-2">
                  <Calendar size={15} className="text-indigo-500" /> ช่วงวันที่ที่ใช้ได้ <span className="font-normal text-indigo-400 text-xs ml-1">(ไม่กรอก = ไม่จำกัด)</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 mb-1.5">วันเริ่มต้น</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 mb-1.5">วันสิ้นสุด</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 bg-white text-sm"
                    />
                  </div>
                </div>
                {startDate && endDate && new Date(endDate) < new Date(startDate) && (
                  <p className="text-xs text-red-500 font-medium">⚠️ วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น</p>
                )}
              </div>

              {/* ── DAY OF WEEK ── */}
              <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 space-y-3">
                <h4 className="font-bold text-sm text-violet-800 flex items-center gap-1.5 border-b border-violet-200/50 pb-2">
                  <CalendarDays size={15} className="text-violet-500" /> วันที่อนุญาตให้ใช้โปรโมชั่น <span className="font-normal text-violet-400 text-xs ml-1">(ไม่เลือก = ทุกวัน)</span>
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {DAY_LABELS.map((label, d) => {
                    const active = activeDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setActiveDays(prev =>
                          prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                        )}
                        className={clsx(
                          "flex flex-col items-center px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all select-none",
                          active
                            ? clsx("border-transparent ring-2 ring-offset-1", DAY_COLORS[d], "ring-violet-400")
                            : "border-gray-200 bg-white text-gray-400 hover:border-violet-300 hover:text-violet-500"
                        )}
                      >
                        <span className="text-[10px] font-normal mb-0.5">{["อา","จ","อ","พ","พฤ","ศ","ส"][d]}</span>
                        <span>{DAY_FULL[d].slice(0,3)}</span>
                      </button>
                    );
                  })}
                </div>
                {activeDays.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-violet-600 font-medium">
                      ✓ ใช้ได้เฉพาะ: {[...activeDays].sort((a,b)=>a-b).map(d => DAY_FULL[d]).join(", ")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveDays([])}
                      className="text-[11px] text-violet-400 hover:text-violet-600 underline"
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-3.5 bg-fuchsia-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-fuchsia-700 transition-colors shadow-md shadow-fuchsia-200 disabled:opacity-50">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {isSaving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

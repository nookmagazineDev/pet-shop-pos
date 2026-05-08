import { useState, useEffect } from "react";
import { X, Ticket, Loader2, Check, Users, ChevronRight } from "lucide-react";
import { fetchApi, postApi } from "../api";

export default function BuyCouponModal({ isOpen, onClose, customers, onCouponIssued }) {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isBuying, setIsBuying] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchApi("getCoupons").then(data => {
      setCoupons(Array.isArray(data) ? data.filter(c => c.Status === "ACTIVE") : []);
      setIsLoading(false);
    });
  }, [isOpen]);

  const handleClose = () => {
    setSelectedCustomer(null); setCustomerSearch("");
    setSelectedCoupon(null); setSuccessMsg("");
    onClose();
  };

  const handleBuy = async () => {
    if (!selectedCustomer || !selectedCoupon) return;
    setIsBuying(true);
    const res = await postApi({
      action: "issueCoupon",
      payload: { customerName: selectedCustomer.Name, couponId: selectedCoupon.CouponID, price: parseFloat(selectedCoupon.Price) || 0 }
    });
    setIsBuying(false);
    if (res.success) {
      setSuccessMsg(`ออกคูปอง "${selectedCoupon.Name}" ให้ "${selectedCustomer.Name}" สำเร็จ!`);
      onCouponIssued && onCouponIssued(selectedCustomer.Name);
    } else {
      alert(res.error || "เกิดข้อผิดพลาด");
    }
  };

  const filtered = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || String(c.Name || "").toLowerCase().includes(q) || String(c.Phone || "").includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Ticket size={20} className="text-primary" />
            <h3 className="text-lg font-bold text-gray-900">ซื้อคูปอง</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {successMsg ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-green-700 font-semibold">{successMsg}</p>
              <button onClick={handleClose} className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90">ปิด</button>
            </div>
          ) : (
            <>
              {/* Select customer */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                  เลือกลูกค้า
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <Users size={18} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{selectedCustomer.Name}</div>
                      <div className="text-xs text-gray-400">{selectedCustomer.Phone}</div>
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowDrop(true); }}
                      onFocus={() => setShowDrop(true)} placeholder="พิมพ์ชื่อหรือเบอร์โทร..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                    {showDrop && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                        {filtered.length === 0 ? <div className="py-4 text-center text-sm text-gray-400">ไม่พบลูกค้า</div>
                          : filtered.map((c, i) => (
                            <button key={i} type="button" onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.Name); setShowDrop(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 flex items-center justify-between border-b border-gray-50 last:border-0">
                              <div>
                                <div className="font-semibold text-sm">{c.Name}</div>
                                <div className="text-xs text-gray-400">{c.Phone}</div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Select coupon */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                  เลือกคูปอง
                </label>
                {isLoading ? <div className="py-6 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></div>
                  : coupons.length === 0 ? <div className="py-4 text-center text-sm text-gray-400">ยังไม่มีคูปองที่เปิดใช้งาน</div>
                  : (
                    <div className="space-y-2">
                      {coupons.map((cpn, i) => {
                        const isSelected = selectedCoupon?.CouponID === cpn.CouponID;
                        const discLabel = cpn.Type === "PERCENT" ? `ลด ${cpn.Value}%` : `ลด ฿${Number(cpn.Value).toLocaleString()}`;
                        return (
                          <button key={i} onClick={() => setSelectedCoupon(isSelected ? null : cpn)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-200 bg-gray-50"}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{cpn.Name}</div>
                                {cpn.Description && <div className="text-xs text-gray-400 mt-0.5">{cpn.Description}</div>}
                                {parseFloat(cpn.MinOrderAmount) > 0 && <div className="text-xs text-gray-400">ขั้นต่ำ ฿{Number(cpn.MinOrderAmount).toLocaleString()}</div>}
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{discLabel}</div>
                                {parseFloat(cpn.Price) > 0 && <div className="text-xs text-gray-500 mt-1">ราคา ฿{Number(cpn.Price).toLocaleString()}</div>}
                                {parseFloat(cpn.Price) === 0 && <div className="text-xs text-green-600 mt-1 font-semibold">ฟรี</div>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Summary */}
              {selectedCustomer && selectedCoupon && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-semibold text-primary mb-2">สรุปการออกคูปอง</div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">ลูกค้า</span><span className="font-semibold">{selectedCustomer.Name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">คูปอง</span><span className="font-semibold">{selectedCoupon.Name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">ส่วนลด</span><span className="font-semibold text-primary">{selectedCoupon.Type === "PERCENT" ? `${selectedCoupon.Value}%` : `฿${Number(selectedCoupon.Value).toLocaleString()}`}</span></div>
                  {parseFloat(selectedCoupon.Price) > 0 && <div className="flex justify-between text-sm border-t border-primary/10 pt-2 mt-2"><span className="text-gray-600">ลูกค้าต้องชำระ</span><span className="font-bold text-gray-900">฿{Number(selectedCoupon.Price).toLocaleString()}</span></div>}
                </div>
              )}

              <button onClick={handleBuy} disabled={!selectedCustomer || !selectedCoupon || isBuying}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md">
                {isBuying ? <><Loader2 size={16} className="animate-spin" /> กำลังดำเนินการ...</> : <><Check size={16} /> ยืนยันออกคูปอง <ChevronRight size={16} /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

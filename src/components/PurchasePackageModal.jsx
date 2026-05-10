import { useState, useEffect } from "react";
import { X, Star, Gift, Loader2, Check, Users, ChevronRight } from "lucide-react";
import { fetchApi } from "../api";

export default function PurchasePackageModal({ isOpen, onClose, customers, onAddToCart }) {
  const [packages, setPackages] = useState([]);
  const [isLoadingPkgs, setIsLoadingPkgs] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingPkgs(true);
    fetchApi("getPackages").then(data => {
      setPackages(Array.isArray(data) ? data.filter(p => p.Status === "ACTIVE") : []);
      setIsLoadingPkgs(false);
    });
  }, [isOpen]);

  const handleClose = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSelectedPkg(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!selectedCustomer || !selectedPkg) return;
    onAddToCart(selectedCustomer, selectedPkg);
    handleClose();
  };

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || String(c.Name || "").toLowerCase().includes(q) || String(c.Phone || "").includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-900">เลือกแพคเกจสะสมแต้ม</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Step 1: Select customer */}
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
                  <div className="text-xs text-gray-400">{selectedCustomer.Phone} · แต้มปัจจุบัน: <span className="text-yellow-600 font-bold">{Number(selectedCustomer.Points || 0).toLocaleString()} pts</span></div>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }} className="text-gray-400 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustDrop(true); }}
                  onFocus={() => setShowCustDrop(true)}
                  placeholder="พิมพ์ชื่อหรือเบอร์โทรลูกค้า..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
                {showCustDrop && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="py-4 text-center text-sm text-gray-400">ไม่พบลูกค้า</div>
                    ) : filteredCustomers.map((c, i) => (
                      <button key={i} type="button" onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.Name); setShowCustDrop(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary/5 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{c.Name}</div>
                          <div className="text-xs text-gray-400">{c.Phone}</div>
                        </div>
                        <span className="text-xs text-yellow-600 font-semibold flex items-center gap-0.5">
                          <Star size={11} /> {Number(c.Points || 0).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Select package */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
              เลือกแพคเกจ
            </label>
            {isLoadingPkgs ? (
              <div className="py-6 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
            ) : packages.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">ยังไม่มีแพคเกจที่เปิดใช้งาน</div>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg, i) => {
                  const total = (parseFloat(pkg.Points) || 0) + (parseFloat(pkg.BonusPoints) || 0);
                  const isSelected = selectedPkg?.PackageID === pkg.PackageID;
                  return (
                    <button key={i} onClick={() => setSelectedPkg(isSelected ? null : pkg)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-200 bg-gray-50"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{pkg.Name}</div>
                          {pkg.Description && <div className="text-xs text-gray-400 mt-0.5">{pkg.Description}</div>}
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="font-bold text-gray-900">฿{Number(pkg.Price).toLocaleString()}</div>
                          <div className="text-xs text-yellow-600 font-semibold flex items-center gap-1 justify-end mt-0.5">
                            <Star size={11} /> {total.toLocaleString()} pts
                            {parseFloat(pkg.BonusPoints) > 0 && <span className="text-green-600">(+{Number(pkg.BonusPoints).toLocaleString()} โบนัส)</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedCustomer && selectedPkg && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 space-y-1">
              <div className="text-xs font-semibold text-yellow-800 mb-2">สรุปการซื้อแพคเกจ</div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">ลูกค้า</span><span className="font-semibold">{selectedCustomer.Name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">แพคเกจ</span><span className="font-semibold">{selectedPkg.Name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">ราคา</span><span className="font-bold text-gray-900">฿{Number(selectedPkg.Price).toLocaleString()}</span></div>
              <div className="border-t border-yellow-200 my-2 pt-2 flex justify-between text-sm">
                <span className="text-yellow-700 font-semibold">แต้มที่จะได้รับ</span>
                <span className="font-bold text-yellow-700 flex items-center gap-1"><Star size={13} /> {((parseFloat(selectedPkg.Points) || 0) + (parseFloat(selectedPkg.BonusPoints) || 0)).toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>แต้มหลังซื้อ</span>
                <span className="font-semibold">{(Number(selectedCustomer.Points || 0) + (parseFloat(selectedPkg.Points) || 0) + (parseFloat(selectedPkg.BonusPoints) || 0)).toLocaleString()} pts</span>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selectedCustomer || !selectedPkg}
            className="w-full py-3.5 bg-yellow-500 text-white rounded-xl font-bold text-sm hover:bg-yellow-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-yellow-500/20"
          >
            <Check size={16} /> เพิ่มเข้าบิล <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

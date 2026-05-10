import { useState, useEffect } from "react";
import { X, Star, Gift, Loader2, Check, Users, ChevronRight, Printer } from "lucide-react";
import { fetchApi, postApi } from "../api";
import { usePrinter } from "../context/PrinterContext";

export default function PurchasePackageModal({ isOpen, onClose, customers, onPointsUpdated }) {
  const { settings: printerSettings } = usePrinter();
  const [packages, setPackages] = useState([]);
  const [isLoadingPkgs, setIsLoadingPkgs] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [purchaseResult, setPurchaseResult] = useState(null);

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
    setSuccessMsg("");
    setPurchaseResult(null);
    onClose();
  };

  const printPackageReceipt = () => {
    if (!purchaseResult) return;
    const { pkg, customer, earnedPoints, newBalance, purchasedAt } = purchaseResult;
    const s = printerSettings;
    const dateStr = new Date(purchasedAt).toLocaleString("th-TH", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    const totalPoints = (parseFloat(pkg.Points) || 0) + (parseFloat(pkg.BonusPoints) || 0);

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<title>ใบเสร็จซื้อแพคเกจ</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 280px; padding: 10px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .label { color: #555; }
  .large { font-size: 15px; }
  .xlarge { font-size: 18px; }
  .points { font-size: 14px; font-weight: bold; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 100%; }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="bold large">${s.shopName || ""}</div>
    ${s.shopAddress ? `<div style="font-size:10px; margin-top:2px;">${s.shopAddress}</div>` : ""}
    ${s.shopPhone ? `<div>โทร: ${s.shopPhone}</div>` : ""}
    ${s.shopTaxId ? `<div>เลขที่ผู้เสียภาษี: ${s.shopTaxId}</div>` : ""}
    ${s.shopBranch ? `<div>${s.shopBranch}</div>` : ""}
  </div>
  <div class="divider"></div>
  <div class="center bold large">ใบเสร็จซื้อแพคเกจ</div>
  <div class="divider"></div>
  <div class="row"><span class="label">วันที่:</span><span>${dateStr}</span></div>
  <div class="row"><span class="label">ลูกค้า:</span><span class="bold">${customer.Name || ""}</span></div>
  ${customer.Phone ? `<div class="row"><span class="label">โทร:</span><span>${customer.Phone}</span></div>` : ""}
  <div class="divider"></div>
  <div class="row"><span class="label">แพคเกจ:</span><span class="bold">${pkg.Name || ""}</span></div>
  ${pkg.Description ? `<div style="font-size:10px; color:#555; padding-left:4px;">${pkg.Description}</div>` : ""}
  <div class="row">
    <span>แต้มพื้นฐาน</span>
    <span>${Number(pkg.Points || 0).toLocaleString()} pts</span>
  </div>
  ${parseFloat(pkg.BonusPoints) > 0 ? `<div class="row">
    <span>โบนัสแต้ม</span>
    <span>+${Number(pkg.BonusPoints).toLocaleString()} pts</span>
  </div>` : ""}
  <div class="divider"></div>
  <div class="row xlarge bold">
    <span>ยอดชำระ</span>
    <span>฿${Number(pkg.Price).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  </div>
  <div class="divider"></div>
  <div class="center" style="margin: 6px 0;">
    <div class="label" style="font-size:11px;">แต้มที่ได้รับ</div>
    <div class="points" style="font-size:20px;">★ ${totalPoints.toLocaleString()} แต้ม ★</div>
  </div>
  <div class="row" style="margin-top:4px;">
    <span class="label">แต้มสะสมคงเหลือ</span>
    <span class="bold">${Number(newBalance).toLocaleString()} pts</span>
  </div>
  <div class="divider"></div>
  <div class="center" style="margin-top:6px; font-size:11px;">${s.footerNote || ""}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=350,height=600,scrollbars=yes");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const handlePurchase = async () => {
    if (!selectedCustomer || !selectedPkg) return;
    setIsPurchasing(true);
    const res = await postApi({
      action: "purchasePackage",
      payload: {
        customerName: selectedCustomer.Name,
        packageId: selectedPkg.PackageID,
      }
    });
    setIsPurchasing(false);
    if (res.success) {
      const earned = res.earnedPoints;
      const newBal = res.newBalance;
      setPurchaseResult({
        pkg: selectedPkg,
        customer: selectedCustomer,
        earnedPoints: earned,
        newBalance: newBal,
        purchasedAt: new Date().toISOString(),
      });
      setSuccessMsg(`เพิ่ม ${earned.toLocaleString()} แต้มให้ "${selectedCustomer.Name}" สำเร็จ! ยอดคงเหลือ: ${newBal.toLocaleString()} แต้ม`);
      onPointsUpdated(selectedCustomer.Name, newBal);
    } else {
      alert(res.error || "เกิดข้อผิดพลาด");
    }
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
            <h3 className="text-lg font-bold text-gray-900">ซื้อแพคเกจ</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Success state */}
          {successMsg ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-green-700 font-semibold text-base">{successMsg}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={printPackageReceipt} className="px-5 py-2.5 bg-gray-700 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors flex items-center gap-2">
                  <Printer size={15} /> พิมพ์ใบเสร็จ
                </button>
                <button onClick={handleClose} className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                  ปิด
                </button>
              </div>
            </div>
          ) : (
            <>
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
                onClick={handlePurchase}
                disabled={!selectedCustomer || !selectedPkg || isPurchasing}
                className="w-full py-3.5 bg-yellow-500 text-white rounded-xl font-bold text-sm hover:bg-yellow-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-yellow-500/20"
              >
                {isPurchasing ? <><Loader2 size={16} className="animate-spin" /> กำลังดำเนินการ...</> : <><Check size={16} /> ยืนยันซื้อแพคเกจ <ChevronRight size={16} /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

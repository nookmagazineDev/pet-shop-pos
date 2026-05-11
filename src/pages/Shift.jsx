import { useState, useEffect, useCallback } from "react";
import { Clock, DollarSign, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";
import { useShift } from "../context/ShiftContext";
import ShiftSlipModal from "../components/ShiftSlipModal";

export default function Shift() {
  const { markShiftOpen, markShiftClosed } = useShift();
  // Shift state tracking
  const [shiftState, setShiftState] = useState("closed"); // 'closed' or 'open'
  const [initialCash, setInitialCash] = useState("");     // Used for opening shift input
  const [actualCash, setActualCash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Real aggregated data
  const [currentInitialCash, setCurrentInitialCash] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [transferDirect, setTransferDirect] = useState(0);
  const [transferQR, setTransferQR] = useState(0);
  const [creditSales, setCreditSales] = useState(0);  // บัตรเครดิต
  const [creditPts, setCreditPts] = useState(0);       // เครดิต (credit balance)
  const [onlinePaid, setOnlinePaid] = useState({});
  const [onlinePending, setOnlinePending] = useState({});
  const [expectedCash, setExpectedCash] = useState(0); 

  // Modal print
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [shiftSlipData, setShiftSlipData] = useState(null);
  const [currentShiftId, setCurrentShiftId] = useState("");
  const [currentShiftOpenTime, setCurrentShiftOpenTime] = useState("");

  // Parse payment method string into { methodName: amount } map.
  // Supports:
  //   "เงินสด"                          → single method, full amount
  //   "เงินสด:1000 + โอนเข้าบัญชี:650"  → split payment with encoded amounts
  //   "เงินสด + โอนเข้าบัญชี"            → legacy split (equal split fallback)
  const parsePaymentAmounts = (method, totalAmt) => {
    const out = {};
    if (!method) return out;
    const addTo = (m, a) => { out[m] = (out[m] || 0) + a; };
    if (method.includes(":")) {
      // Encoded format: "MethodA:amtA + MethodB:amtB"
      method.split(" + ").forEach(part => {
        const ci = part.lastIndexOf(":");
        if (ci === -1) { addTo(part.trim(), totalAmt); return; }
        addTo(part.slice(0, ci).trim(), parseFloat(part.slice(ci + 1)) || 0);
      });
    } else if (method.includes(" + ")) {
      // Legacy: split equally
      const parts = method.split(" + ").map(p => p.trim()).filter(Boolean);
      const share = totalAmt / parts.length;
      parts.forEach(m => addTo(m, share));
    } else {
      addTo(method.trim(), totalAmt);
    }
    return out;
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadShiftData = useCallback(async (showLoader = false) => {
    if (showLoader) setIsRefreshing(true);
    try {
      const [shiftsData, txData] = await Promise.all([
        fetchApi("getShifts"),
        fetchApi("getTransactions")
      ]);

      if (Array.isArray(shiftsData)) {
        const lastShift = shiftsData.length > 0 ? shiftsData[shiftsData.length - 1] : null;
        if (lastShift && lastShift.Status === "OPEN") {
          setShiftState("open");
          setCurrentShiftId(lastShift.ShiftID);
          setCurrentShiftOpenTime(lastShift.OpenTime);

          const initial = parseFloat(lastShift.ExpectedCash || lastShift.InitialCash) || 0;
          setCurrentInitialCash(initial);

          let cSales = 0;
          let tDirect = 0;
          let tQR = 0;
          let crSales = 0;
          let crPts = 0;
          let oPaid = {};
          let oPending = {};

          const openTime = new Date(lastShift.OpenTime);

          // Aggregate transactions since shift opened
          if (Array.isArray(txData)) {
            txData.forEach(tx => {
              if (tx.Status === "VOID") return;
              const txTime = new Date(tx.Date);
              if (txTime < openTime) return;

              const totalAmt = parseFloat(tx.TotalAmount) || 0;
              const method = tx.PaymentMethod || "";
              const amounts = parsePaymentAmounts(method, totalAmt);

              Object.entries(amounts).forEach(([m, a]) => {
                if (m === "เงินสด")                              cSales  += a;
                else if (m === "เงินโอน" || m === "โอนเข้าบัญชี") tDirect += a;
                else if (m === "สแกน QR")                        tQR     += a;
                else if (m === "บัตรเครดิต")                     crSales += a;
                else if (m === "เครดิต")                         crPts   += a;
                else if (m !== "") {
                  // Online / other platforms
                  if (m.includes("รอชำระ")) {
                    const platform = m.replace("รอชำระ", "").trim() || "ออนไลน์";
                    oPending[platform] = (oPending[platform] || 0) + a;
                  } else {
                    oPaid[m] = (oPaid[m] || 0) + a;
                  }
                }
              });
            });
          }

          setCashSales(cSales);
          setTransferDirect(tDirect);
          setTransferQR(tQR);
          setCreditSales(crSales);
          setCreditPts(crPts);
          setOnlinePaid(oPaid);
          setOnlinePending(oPending);
          setExpectedCash(initial + cSales);

        } else {
          setShiftState("closed");
          setCurrentShiftId("");
          setCurrentShiftOpenTime("");
        }
      }
    } catch {
      setShiftState("closed");
    } finally {
      setIsPageLoading(false);
      if (showLoader) setIsRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadShiftData(false);
  }, [loadShiftData]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!initialCash) return;
    
    setIsSubmitting(true);
    const payload = {
      action: "openShift",
      payload: { initialCash: initialCash }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      setShiftState("open");
      const initial = parseFloat(initialCash);
      setCurrentInitialCash(initial);
      setCashSales(0);
      setTransferDirect(0);
      setTransferQR(0);
      setCreditSales(0);
      setCreditPts(0);
      setExpectedCash(initial);
      setInitialCash(""); 
      setCurrentShiftId(res.shiftId || "");
      setCurrentShiftOpenTime(new Date().toISOString());
      markShiftOpen(); // Instantly update global header status
    } else {
      alert("Error: " + (res.error || "Unknown"));
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!actualCash) return;
    
    // Calculate discrepancy
    const diff = parseFloat(actualCash) - expectedCash;
    
    // Prepare shift details payload
    const details = {
      initialCash: currentInitialCash,
      cashSales,
      transferDirect,
      transferQR,
      creditSales,
      creditPts,
      onlinePaid,
      onlinePending,
      expectedCash,
      actualCash: parseFloat(actualCash),
      discrepancy: diff
    };

    setIsSubmitting(true);
    const payload = {
      action: "closeShift",
      payload: {
        actualCash: actualCash,
        discrepancy: diff,
        shiftDetails: details
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert(`ปิดกะสำเร็จ! ยอดเงินต่าง: ฿${diff.toFixed(2)}`);
      
      // Auto open print modal for just closed shift
      let userObj = {};
      try { userObj = JSON.parse(sessionStorage.getItem("pos_user") || "{}"); } catch (e) {}
      setShiftSlipData({
        shiftId: currentShiftId,
        openTime: currentShiftOpenTime,
        closeTime: new Date().toISOString(),
        actor: userObj.displayName || userObj.username || "พนักงาน",
        ...details
      });
      setIsSlipModalOpen(true);

      setShiftState("closed");
      setActualCash("");
      setCurrentShiftId("");
      markShiftClosed(); // Instantly update global header status
    } else {
      alert("Error: " + (res.error || "Unknown"));
    }
  };

  if (isPageLoading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-32 gap-4 text-gray-500">
        <Loader2 size={36} className="animate-spin text-blue-500" />
        <p className="text-base font-medium">กำลังโหลดข้อมูลกะ...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">จัดการกะ (Shift Management)</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadShiftData(true)}
            disabled={isRefreshing}
            title="รีเฟรชข้อมูลกะ"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            รีเฟรช
          </button>
          <div className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm",
            shiftState === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          )}>
            {shiftState === "open" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            {shiftState === "open" ? "กำลังเปิดกะ" : "กะปิดอยู่"}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Open Shift Panel */}
        <div className={clsx(
          "bg-white rounded-2xl shadow-sm border p-6 transition-all",
          shiftState === "closed" ? "border-primary ring-1 ring-primary/20" : "border-gray-100 opacity-50 pointer-events-none"
        )}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">เปิดกะการขาย</h3>
          </div>
          
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เงินทอนในลิ้นชักเริ่มต้น (THB)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <DollarSign size={18} />
                </div>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white"
                  placeholder="เช่น 1000.00"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              ยืนยันเปิดกะ
            </button>
          </form>
        </div>

        {/* Close Shift Panel */}
        <div className={clsx(
          "bg-white rounded-2xl shadow-sm border p-6 transition-all",
          shiftState === "open" ? "border-red-500 ring-1 ring-red-500/20" : "border-gray-100 opacity-50 pointer-events-none"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">ปิดกะ</h3>
            </div>
            {shiftState === "open" && (
              <div className="flex flex-col items-end gap-2">
                <div className="text-sm text-gray-500">
                  เปิดกะเมื่อ: {new Date(currentShiftOpenTime).toLocaleTimeString('th-TH')}
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    let userObj = {};
                    try { userObj = JSON.parse(sessionStorage.getItem("pos_user") || "{}"); } catch (e) {}
                    setShiftSlipData({
                      shiftId: currentShiftId,
                      openTime: currentShiftOpenTime,
                      closeTime: null,
                      actor: userObj.displayName || userObj.username || "พนักงาน",
                      initialCash: currentInitialCash,
                      cashSales, transferDirect, transferQR, creditSales, creditPts,
                      onlinePaid, onlinePending, expectedCash, actualCash: 0, discrepancy: 0
                    });
                    setIsSlipModalOpen(true);
                  }}
                  className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                >
                  <AlertCircle size={14} className="text-blue-500" />
                  พิมพ์สรุปกะปัจจุบัน
                </button>
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl mb-6 space-y-2 border border-gray-100">
            <div className="flex justify-between text-sm text-gray-600">
              <span>เงินสำรองทอนเริ่มต้น</span>
              <span>฿{currentInitialCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div className="border-t border-gray-200 border-dashed my-2 pt-2 pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">สรุปยอดขายตลอดกะ</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2">
              <span className="flex items-center gap-1.5"><DollarSign size={14} className="text-green-500"/>ยอดขายเงินสด (Cash)</span>
              <span className="font-medium text-green-700">฿{cashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2 opacity-75">
              <span>ยอดขายโอนเข้าบัญชี (Transfer)</span>
              <span>฿{transferDirect.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2 opacity-75">
              <span>ยอดขายสแกน QR (QR Code)</span>
              <span>฿{transferQR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2 opacity-75">
              <span>ยอดขายบัตรเครดิต (Credit Card)</span>
              <span>฿{creditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2 opacity-75 pb-1">
              <span>ยอดขายเครดิต (Credit Balance)</span>
              <span>฿{creditPts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Online Breakdown */}
            {(Object.keys(onlinePaid).length > 0 || Object.keys(onlinePending).length > 0) && (
              <>
                <div className="border-t border-gray-200 border-dashed my-2 pt-2 pb-1">
                  <span className="text-xs font-semibold text-violet-500 uppercase tracking-wider">ยอดขายออนไลน์</span>
                </div>
                {Object.entries(onlinePaid).map(([platform, amt]) => (
                  <div key={`paid-${platform}`} className="flex justify-between text-sm text-gray-600 pl-2 opacity-90 my-0.5">
                    <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500"/>{platform} (ชำระแล้ว)</span>
                    <span className="font-medium text-gray-800">฿{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {Object.entries(onlinePending).map(([platform, amt]) => (
                  <div key={`pending-${platform}`} className="flex justify-between text-sm text-gray-600 pl-2 opacity-80 my-0.5">
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-amber-500"/>{platform} (รอชำระ)</span>
                    <span className="text-amber-600">฿{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </>
            )}

            <div className="border-t border-gray-200 my-3 pt-3 flex justify-between items-center font-bold text-gray-900">
              <span className="text-base">ยอดเงินที่ควรมีในลิ้นชัก<br/><span className="text-xs text-gray-500 font-normal text-sm font-medium mt-1 inline-block">(เงินทอน + ยอดขายเงินสด)</span></span>
              <span className="text-xl text-blue-600">฿{expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <form onSubmit={handleCloseShift} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินจริงในลิ้นชักที่นับได้ (THB)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <DollarSign size={18} />
                </div>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-gray-50 focus:bg-white"
                  placeholder="นับเงินจริงได้เท่าไหร่..."
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
              </div>
              
              {actualCash && (
                <div className={clsx(
                  "mt-2 text-sm font-medium flex items-center justify-between px-1",
                  parseFloat(actualCash) === expectedCash ? "text-green-600" : "text-amber-600"
                )}>
                  <span>ส่วนต่างของเงิน:</span>
                  <span>฿{(parseFloat(actualCash) - expectedCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              ปิดกะและส่งรายงานเงินสด
            </button>
          </form>
        </div>

      </div>

      <ShiftSlipModal 
        isOpen={isSlipModalOpen} 
        onClose={() => setIsSlipModalOpen(false)} 
        shiftData={shiftSlipData}
      />
    </div>
  );
}

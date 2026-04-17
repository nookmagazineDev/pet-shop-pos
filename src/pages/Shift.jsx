import { useState, useEffect } from "react";
import { Clock, DollarSign, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";
import { useShift } from "../context/ShiftContext";

export default function Shift() {
  const { markShiftOpen, markShiftClosed } = useShift();
  // Shift state tracking
  const [shiftState, setShiftState] = useState("closed"); // 'closed' or 'open'
  const [initialCash, setInitialCash] = useState("");     // Used for opening shift input
  const [actualCash, setActualCash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Real aggregated data
  const [currentInitialCash, setCurrentInitialCash] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [transferSales, setTransferSales] = useState(0);
  const [creditSales, setCreditSales] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0); 

  useEffect(() => {
    // Determine shift state and calculate metrics from Google Sheets
    Promise.all([
      fetchApi("getShifts"),
      fetchApi("getTransactions")
    ]).then(([shiftsData, txData]) => {
      if (Array.isArray(shiftsData)) {
        const lastShift = shiftsData.length > 0 ? shiftsData[shiftsData.length - 1] : null;
        if (lastShift && lastShift.Status === "OPEN") {
          setShiftState("open");
          
          const initial = parseFloat(lastShift.ExpectedCash || lastShift.InitialCash) || 0;
          setCurrentInitialCash(initial);
          
          let cSales = 0;
          let tSales = 0;
          let crSales = 0;
          
          const openTime = new Date(lastShift.OpenTime);
          
          // Aggregate transactions since shift opened
          if (Array.isArray(txData)) {
            txData.forEach(tx => {
              const txTime = new Date(tx.Date);
              // Only sum transactions that occurred during this open shift
              if (txTime >= openTime) {
                const amt = parseFloat(tx.TotalAmount) || 0;
                if (tx.PaymentMethod === "เงินสด") cSales += amt;
                else if (tx.PaymentMethod === "เงินโอน") tSales += amt;
                else if (tx.PaymentMethod === "บัตรเครดิต") crSales += amt;
              }
            });
          }
          
          setCashSales(cSales);
          setTransferSales(tSales);
          setCreditSales(crSales);
          setExpectedCash(initial + cSales);

        } else {
          setShiftState("closed");
        }
      }
    });
  }, []);

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
      setTransferSales(0);
      setCreditSales(0);
      setExpectedCash(initial);
      setInitialCash(""); 
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
    
    setIsSubmitting(true);
    const payload = {
      action: "closeShift",
      payload: {
        actualCash: actualCash,
        discrepancy: diff
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert(`ปิดกะสำเร็จ! ยอดเงินต่าง: ฿${diff.toFixed(2)}`);
      setShiftState("closed");
      setActualCash("");
      markShiftClosed(); // Instantly update global header status
    } else {
      alert("Error: " + (res.error || "Unknown"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">จัดการกะ (Shift Management)</h2>
        <div className={clsx(
          "flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm",
          shiftState === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
        )}>
          {shiftState === "open" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
          {shiftState === "open" ? "กำลังเปิดกะ" : "กะปิดอยู่"}
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
              <div className="text-sm text-gray-500">
                เปิดกะเมื่อ: {new Date().toLocaleTimeString('th-TH')}
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
              <span>ยอดขายเงินโอน (Transfer)</span>
              <span>฿{transferSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pl-2 opacity-75">
              <span>ยอดขายบัตรเครดิต (Credit)</span>
              <span>฿{creditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

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
    </div>
  );
}

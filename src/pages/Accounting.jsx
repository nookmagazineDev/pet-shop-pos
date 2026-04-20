import { useState, useEffect } from "react";
import { fetchApi, postApi } from "../api";
import { Wallet, FileText, Printer, CheckCircle, Search, FileUp, Loader2, RefreshCw, X } from "lucide-react";
import clsx from "clsx";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("income");
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Expense form state
  const [expenseData, setExpenseData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    category: "วัตถุดิบ/สินค้า",
    amount: "",
  });
  const [expenseFile, setExpenseFile] = useState(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "", address: "", taxId: "", phone: "" });

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === "income") {
      const data = await fetchApi("getTransactions");
      setTransactions(Array.isArray(data) ? data.reverse() : []);
      const custData = await fetchApi("getCustomers");
      setCustomers(Array.isArray(custData) ? custData : []);
    } else {
      const data = await fetchApi("getExpenses");
      setExpenses(Array.isArray(data) ? data.reverse() : []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleExpenseFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExpenseFile({
          fileName: file.name,
          base64: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setIsSubmittingExpense(true);

    const payload = {
      action: "addExpense",
      payload: {
        date: expenseData.date,
        description: expenseData.description,
        category: expenseData.category,
        amount: expenseData.amount,
        fileName: expenseFile ? expenseFile.fileName : "",
        fileData: expenseFile ? expenseFile.base64 : ""
      }
    };

    const res = await postApi(payload);
    setIsSubmittingExpense(false);

    if (res.success) {
      alert("บันทึกรายจ่ายเรียบร้อยแล้ว!");
      setExpenseData({
        date: new Date().toISOString().split('T')[0],
        description: "",
        category: "วัตถุดิบ/สินค้า",
        amount: "",
      });
      setExpenseFile(null);
      e.target.reset();
      fetchData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
    }
  };

  const handlePrintTaxInvoice = async () => {
    if (customerInfo.name) {
      postApi({
        action: "saveCustomer",
        payload: {
          name: customerInfo.name,
          phone: customerInfo.phone,
          address: customerInfo.address,
          taxId: customerInfo.taxId,
          lastInvoiceId: selectedTx.OrderID || selectedTx[0] || "",
          lastInvoiceDate: new Date().toISOString()
        }
      });
    }
    // Set timeout to allow React to render any UI state, though optional.
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">บัญชี / รายรับ-รายจ่าย</h2>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("income")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
              activeTab === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Wallet size={16} />
            รายรับ (Income)
          </button>
          <button 
            onClick={() => setActiveTab("expense")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
              activeTab === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <FileText size={16} />
            รายจ่าย (Expenses)
          </button>
        </div>
      </div>

      {/* INCOME TAB */}
      {activeTab === "income" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-emerald-50/50 rounded-t-2xl">
            <h3 className="font-semibold text-emerald-800">ประวัติการขาย (รายรับ)</h3>
            <button onClick={fetchData} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm bg-emerald-100 px-3 py-1.5 rounded-lg">
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              รีเฟรช
            </button>
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">วันที่เวลา</th>
                  <th className="py-3 px-6">รหัสออเดอร์</th>
                  <th className="py-3 px-6 text-right">ยอดรับ (บาท)</th>
                  <th className="py-3 px-6 text-center">ช่องทาง</th>
                  <th className="py-3 px-6 text-center">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan="5" className="py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan="5" className="py-8 text-center text-gray-400">ยังไม่มีรายการ</td></tr>
                ) : transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="py-4 px-6 text-sm text-gray-600">{new Date(tx.Timestamp || tx[1]).toLocaleString("th-TH")}</td>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">{tx.OrderID || tx[0]}</td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600">
                      ฿{parseFloat(tx.TotalAmount || tx[2]).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {tx.PaymentMethod || tx[4]}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button 
                        onClick={() => { setSelectedTx(tx); setInvoiceModal(true); }}
                        className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        ออกใบกำกับภาษี
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPENSE TAB */}
      {activeTab === "expense" && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          
          {/* New Expense Form */}
          <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-max shrink-0">
            <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
              <FileUp className="text-rose-500" size={20} /> บันทึกรายจ่ายใหม่
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                <input 
                  type="date" required
                  value={expenseData.date}
                  onChange={e => setExpenseData({...expenseData, date: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                <select 
                  value={expenseData.category}
                  onChange={e => setExpenseData({...expenseData, category: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                >
                  <option>วัตถุดิบ/สินค้า</option>
                  <option>ค่าขนส่ง</option>
                  <option>ค่าสาธารณูปโภค</option>
                  <option>เงินเดือน/ค่าจ้าง</option>
                  <option>อุปกรณ์/สำนักงาน</option>
                  <option>อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายการ (คำอธิบาย)</label>
                <input 
                  type="text" required
                  value={expenseData.description}
                  onChange={e => setExpenseData({...expenseData, description: e.target.value})}
                  placeholder="เช่น ค่าจัดส่ง Kerry"
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงิน (บาท)</label>
                <input 
                  type="number" required min="0" step="0.01"
                  value={expenseData.amount}
                  onChange={e => setExpenseData({...expenseData, amount: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แนบไฟล์แจ้งยอด/บิล (รูปภาพ/PDF) *</label>
                <input 
                  type="file" required accept="image/*,.pdf"
                  onChange={handleExpenseFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />
              </div>
              <button 
                type="submit" disabled={isSubmittingExpense}
                className="w-full mt-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmittingExpense ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {isSubmittingExpense ? "กำลังอัปโหลดและบันทึก..." : "บันทึกรายจ่าย"}
              </button>
            </form>
          </div>

          {/* Expense History Table */}
          <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-rose-50/50 rounded-t-2xl">
              <h3 className="font-semibold text-rose-800">ประวัติรายจ่ายทั้งหมด</h3>
              <button onClick={fetchData} className="text-rose-600 hover:text-rose-700 flex items-center gap-1 text-sm bg-rose-100 px-3 py-1.5 rounded-lg">
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                รีเฟรช
              </button>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                    <th className="py-3 px-6">วันที่ชำระ</th>
                    <th className="py-3 px-6">รายการ</th>
                    <th className="py-3 px-6">หมวดหมู่</th>
                    <th className="py-3 px-6 text-right">ยอดเงิน</th>
                    <th className="py-3 px-6 text-center">เอกสารอ้างอิง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                  ) : expenses.length === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-400">ยังไม่มีประวัติรายจ่าย</td></tr>
                  ) : expenses.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                      {/* Note: Array mapped directly from Sheet row */}
                      <td className="py-4 px-6 text-sm text-gray-600">{new Date(exp[1] || exp[0]).toLocaleDateString("th-TH")}</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900">{exp[2]}</td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">{exp[3]}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-rose-600">
                        ฿{parseFloat(exp[4]).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {exp[5] ? (
                          <a href={exp[5]} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-medium">ดูเอกสาร</a>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceModal && selectedTx && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:block overflow-auto">
          {/* We hide the modal wrapper border and backgrounds in `print:` context. */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] print:max-w-full print:shadow-none print:max-h-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 print:hidden shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Printer size={20} className="text-primary" /> ออกใบกำกับภาษี / ใบเสร็จรับเงิน
              </h3>
              <button onClick={() => { setInvoiceModal(false); setSelectedTx(null); }} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            {/* INVOICE CONTENT */}
            <div className="p-8 overflow-y-auto print:overflow-visible">
              
              {/* Form Input for Customer Details (Hidden while printing) */}
              <div className="mb-6 grid grid-cols-2 gap-4 border-b border-gray-200 pb-6 print:hidden">
                <div className="col-span-2 text-sm text-gray-500 font-medium mb-2">กรอกข้อมูลลูกค้า (ถ้ามี)</div>
                <div className="col-span-2 sm:col-span-1">
                  <input type="text" list="customers-list" placeholder="ชื่อลูกค้า / บริษัท" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.name} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = customers.find(c => c.Name === val);
                      if (match) {
                        setCustomerInfo({ name: match.Name, phone: match.Phone || "", address: match.Address || "", taxId: match.TaxID || "" });
                      } else {
                        setCustomerInfo({...customerInfo, name: val});
                      }
                    }} 
                  />
                  <datalist id="customers-list">
                    {customers.map((c, i) => <option key={i} value={c.Name} />)}
                  </datalist>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <input type="text" placeholder="เบอร์โทรศัพท์" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <textarea placeholder="ที่อยู่..." className="w-full px-3 py-2 border rounded-lg h-16" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})}></textarea>
                </div>
                <div className="col-span-2">
                  <input type="text" placeholder="เลขประจำตัวผู้เสียภาษี (13 หลัก)" className="w-full px-3 py-2 border rounded-lg" value={customerInfo.taxId} onChange={e => setCustomerInfo({...customerInfo, taxId: e.target.value})} />
                </div>
              </div>

              {/* Printable Area below */}
              <div id="printable-tax-invoice" className="font-sans text-gray-900 bg-white">
                <div className="text-center mb-6 border-b pb-4 border-gray-800">
                  <h1 className="text-2xl font-bold mb-1">ใบกำกับภาษี / ใบเสร็จรับเงิน</h1>
                  <p className="text-sm">TAX INVOICE / RECEIPT</p>
                  <p className="text-sm mt-2 font-bold">บริษัท สัตว์เลี้ยงแสนรัก จำกัด</p>
                  <p className="text-xs text-gray-600">123 ถ.สุขุมวิท พระโขนง กรุงเทพฯ 10110</p>
                  <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี: 0105555555555</p>
                </div>

                <div className="flex justify-between items-start mb-6 text-sm">
                  <div className="w-1/2 pr-4 space-y-1">
                    <p><span className="font-semibold">ชื่อลูกค้า:</span> {customerInfo.name || "-"}</p>
                    <p><span className="font-semibold">เบอร์โทรศัพท์:</span> {customerInfo.phone || "-"}</p>
                    <p><span className="font-semibold">ที่อยู่:</span> {customerInfo.address || "-"}</p>
                    <p><span className="font-semibold">เลขประจำตัวผู้เสียภาษี:</span> {customerInfo.taxId || "-"}</p>
                  </div>
                  <div className="w-1/2 pl-4 text-right space-y-1">
                    <p><span className="font-semibold">เลขที่อ้างอิง:</span> {selectedTx.OrderID || selectedTx[0]}</p>
                    <p><span className="font-semibold">วันที่:</span> {new Date(selectedTx.Timestamp || selectedTx[1]).toLocaleString("th-TH")}</p>
                    <p><span className="font-semibold">ช่องทางชำระ:</span> {selectedTx.PaymentMethod || selectedTx[4]}</p>
                  </div>
                </div>

                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="border-y border-gray-800 bg-gray-50/50">
                      <th className="py-2 px-2">ลำดับ</th>
                      <th className="py-2 px-2">รายการสินค้า</th>
                      <th className="py-2 px-2 text-center">จำนวน</th>
                      <th className="py-2 px-2 text-right">ราคาต่อหน่วย</th>
                      <th className="py-2 px-2 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-gray-200">
                    {(() => {
                      try {
                        const cart = JSON.parse(selectedTx.CartDetails || selectedTx[5]);
                        return cart.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 px-2">{i+1}</td>
                            <td className="py-2 px-2">{item.name || item.Name}</td>
                            <td className="py-2 px-2 text-center">{item.qty || item.quantity}</td>
                            <td className="py-2 px-2 text-right">{(item.price || item.Price).toLocaleString("th-TH")}</td>
                            <td className="py-2 px-2 text-right">{((item.price || item.Price) * (item.qty || item.quantity)).toLocaleString("th-TH")}</td>
                          </tr>
                        ));
                      } catch(e) {
                        return <tr><td colSpan="5" className="text-center py-2">เกิดข้อผิดพลาดในการดึงรายการสินค้า</td></tr>;
                      }
                    })()}
                  </tbody>
                </table>

                <div className="ml-auto w-1/2 border-t border-gray-800 pt-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>มูลค่าสินค้ายกเว้นภาษี (บาท)</span>
                    <span>0.00</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>มูลค่าสินค้าที่ต้องเสียภาษี (บาท)</span>
                    {/* Reverse Calculate VAT for Demo */}
                    <span>{(parseFloat(selectedTx.TotalAmount || selectedTx[2]) * 100 / 107).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                    <span>{(parseFloat(selectedTx.TotalAmount || selectedTx[2]) * 7 / 107).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-800">
                    <span>จำนวนเงินรวมทั้งสิ้น (บาท)</span>
                    <span>{parseFloat(selectedTx.TotalAmount || selectedTx[2]).toLocaleString("th-TH", {minimumFractionDigits:2})}</span>
                  </div>
                </div>

                <div className="mt-12 text-center text-xs text-gray-500">
                  <p>....................................................................</p>
                  <p className="mt-2 text-sm">(ผู้รับเงิน / Authorized Signature)</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 print:hidden shrink-0">
              <button 
                onClick={() => { setInvoiceModal(false); setSelectedTx(null); }}
                className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50"
              >
                ปิดหน้าต่าง
              </button>
              <button 
                onClick={handlePrintTaxInvoice}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex items-center gap-2"
              >
                <Printer size={18} /> ปริ้นต์ / เซฟเป็น PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

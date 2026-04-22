import { X, Printer } from "lucide-react";

export default function TaxInvoiceModal({ isOpen, onClose, cart, paymentMethod, subtotal, tax, total, receiptType, customerInfo }) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Modal Container -- print:shadow-none print:bg-white */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden print:w-full print:max-w-none print:shadow-none print:rounded-none">
        
        {/* Header (Hidden when printing) */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 print:hidden">
          <h2 className="text-xl font-bold">ตัวอย่างใบกำกับภาษี</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-auto p-8 print:p-0">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-widest text-primary">PetShop Next</h1>
            <p className="text-gray-500 mt-1">123 ถนนเพ็ทช็อป เมทืองสัตว์เลี้ยง 10100</p>
            <p className="text-gray-500">เลขประจำตัวผู้เสียภาษี: 01055xxxxxxxx</p>
            <h2 className="text-xl font-bold mt-4">
               {receiptType === "ใบกำกับภาษี" ? "ใบกำกับภาษีเต็มรูป / Tax Invoice" : "ใบกำกับภาษีอย่างย่อ / ABB Tax Invoice"}
            </h2>
          </div>

          <div className="flex justify-between items-end mb-4 text-sm text-gray-600 border-b border-gray-100 pb-4">
            <div>
              <p>วันที่: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH')}</p>
              <p>พนักงาน: พนักงานหน้าร้าน (Staff User)</p>
            </div>
            <div className="text-right">
              <p>เลขที่เอกสาร: #{(Math.random()*100000).toFixed(0).padStart(6, '0')}</p>
              <p>ชำระโดย: {paymentMethod}</p>
            </div>
          </div>

          {receiptType === "ใบกำกับภาษี" && customerInfo && (
            <div className="mb-6 text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3">
               <span className="font-bold">ลูกค้า: </span>{customerInfo.customerName || "สด"}<br/>
               <span className="font-bold">ที่อยู่: </span>{customerInfo.customerAddress || "-"}<br/>
               <span className="font-bold">เลขประจำตัวผู้เสียภาษี: </span>{customerInfo.customerTaxId || "-"}
            </div>
          )}

          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-2">รายการ</th>
                <th className="py-2 text-center w-16">จำนวน</th>
                <th className="py-2 text-right w-24">ราคา</th>
                <th className="py-2 text-right w-24">รวม</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 text-sm">{item.name}<br/><span className="text-xs text-gray-400">{item.barcode}</span></td>
                  <td className="py-3 text-center text-sm">{item.qty}</td>
                  <td className="py-3 text-right text-sm">{(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right text-sm">{(item.price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end space-y-2 mb-8">
            <div className="w-64 flex justify-between text-sm text-gray-500">
              <span>ราคาสินค้า</span>
              <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-64 flex justify-between text-sm text-gray-500">
              <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
              <span>{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-64 flex justify-between text-lg font-bold border-t border-gray-900 pt-2 mt-2">
              <span>รวมทั้งสิ้น (THB)</span>
              <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="text-center text-gray-500 text-sm mt-8 border-t border-gray-200 pt-4">
            <p>ขอขอบคุณที่ใช้บริการร้านตของเรา</p>
            <p>โอกาสหน้าเชิญใหม่ค่ะ/ครับ</p>
          </div>
        </div>

        {/* Footer (Hidden when printing) */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 print:hidden">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors">
            <Printer size={18} />
            พิมพ์ใบเสร็จ
          </button>
        </div>

      </div>
    </div>
  );
}

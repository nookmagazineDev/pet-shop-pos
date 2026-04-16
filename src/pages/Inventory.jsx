import { useState, useEffect } from "react";
import { Search, Plus, MapPin, PackagePlus, Calendar, Box, Loader2 } from "lucide-react";
import clsx from "clsx";
import { fetchApi, postApi } from "../api";

export default function Inventory() {
  const [activeTab, setActiveTab] = useState("stock"); // 'stock' or 'receive'
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryStock, setInventoryStock] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventory = () => {
    setIsLoading(true);
    fetchApi("getInventory").then(data => {
      setInventoryStock(Array.isArray(data) ? data : []);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (activeTab === "stock") {
      fetchInventory();
    }
  }, [activeTab]);

  const filteredStock = inventoryStock.filter(item => 
    item.ProductID?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.Location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReceiveGoods = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.target);
    const payload = {
      action: "receiveGoods",
      payload: {
        productName: formData.get("productName"),
        quantity: formData.get("quantity"),
        location: formData.get("location"),
        lotNumber: formData.get("lotNumber"),
        expiryDate: formData.get("expiryDate") || "N/A",
        receivingDate: formData.get("receivingDate")
      }
    };

    const res = await postApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      alert("บันทึกสินค้านำเข้าลงคลังเรียบร้อยแล้ว!");
      e.target.reset();
      setActiveTab("stock");
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (res.error || "Unknown"));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">การจัดการคลังสินค้า</h2>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("stock")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "stock" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            รายการสต็อกสินค้า (Real-time)
          </button>
          <button 
            onClick={() => setActiveTab("receive")}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "receive" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
            )}
          >
            ใบรับของเข้าคลัง (Receive Goods)
          </button>
        </div>
      </div>

      {activeTab === "stock" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="relative max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="ค้นหาสินค้าหรือตำแหน่งจัดเก็บ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                  <th className="py-3 px-6">ข้อมูลสินค้า</th>
                  <th className="py-3 px-6">เลข Lot Number</th>
                  <th className="py-3 px-6">ตำแหน่งจัดเก็บ (Location)</th>
                  <th className="py-3 px-6">วันหมดอายุ</th>
                  <th className="py-3 px-6 text-right">จำนวนหน้าร้าน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan="5" className="py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td></tr>
                ) : filteredStock.length === 0 ? (
                  <tr><td colSpan="5" className="py-8 text-center text-gray-500">ไม่พบรายการสินค้า</td></tr>
                ) : filteredStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm">
                      <div className="font-semibold text-gray-900">{item.ProductID}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{item.LotNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 align-middle">
                        <MapPin size={14} className="text-primary" />
                        <span className="font-medium">{item.Location}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5 align-middle">
                        <Calendar size={14} className="text-amber-500" />
                        <span className={clsx(
                          item.ExpiryDate && new Date(item.ExpiryDate) < new Date() ? "text-red-600 font-bold" : ""
                        )}>{item.ExpiryDate || "N/A"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-lg text-primary">
                      {item.Quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "receive" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex p-6 lg:p-8 shrink-0 max-w-3xl">
          <div className="w-full">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <PackagePlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">บันทึกใบรับของ (นำเข้าสินค้า)</h3>
                <p className="text-sm text-gray-500">กรอกรายละเอียดเพื่อบันทึกของเข้าสู่ระบบรายการสต็อกเรียลไทม์</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleReceiveGoods}>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า / สแกนบาร์โค้ด</label>
                  <input type="text" name="productName" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="พิมพ์ชื่อสินค้า หรือ สแกนบาร์โค้ด..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนรับเข้า</label>
                  <input type="number" name="quantity" required min="1" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="0" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โลเคชั่นจัดเก็บ</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <MapPin size={16} />
                    </div>
                    <input type="text" name="location" required className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="เช่น ชั้นวาง A1" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลข Lot (Lot Number)</label>
                  <input type="text" name="lotNumber" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" placeholder="เช่น L-202310-01" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุของไอเทม</label>
                  <input type="date" name="expiryDate" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเข้า</label>
                  <input type="date" name="receivingDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-gray-50 focus:bg-white" />
                </div>

              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none">
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                  {isSubmitting ? "กำลังส่งข้อมูล..." : "ยืนยันนำเข้าระบบสต็อก"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import { useState, useEffect } from "react";
import { TrendingUp, Package, Users, DollarSign, Activity, Loader2, RefreshCcw, AlertTriangle, Search } from "lucide-react";
import clsx from "clsx";
import { fetchApi } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState([
    { id: "sales", name: "ยอดขายวันนี้", value: "฿0", change: "กำลังโหลด...", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600 border-blue-200" },
    { id: "orders", name: "จำนวนออเดอร์", value: "0", change: "กำลังโหลด...", icon: <Activity size={24} />, color: "bg-green-50 text-green-600 border-green-200" },
    { id: "attention", name: "รายการที่ต้องความสนใจ", value: "0", change: "กำลังโหลด...", icon: <Package size={24} />, color: "bg-red-50 text-red-600 border-red-200" },
    { id: "products", name: "สินค้าทั้งหมด", value: "0", change: "กำลังโหลด...", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600 border-purple-200" }
  ]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Detailed Views State
  const [selectedCard, setSelectedCard] = useState(null);
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [attentionProducts, setAttentionProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txsData, prodsData] = await Promise.all([
        fetchApi("getTransactions"),
        fetchApi("getProducts")
      ]);

      const transactions = Array.isArray(txsData) ? txsData : [];
      const products = Array.isArray(prodsData) ? prodsData : [];
      setAllProducts(products);

      const todayStr = new Date().toDateString();
      let todaySales = 0;
      let todayOrders = 0;
      const todayTxs = [];
      
      const sortedTxs = transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
      sortedTxs.forEach(tx => {
        if (new Date(tx.Date).toDateString() === todayStr) {
          todaySales += parseFloat(tx.TotalAmount) || 0;
          todayOrders++;
          todayTxs.push(tx);
        }
      });
      setTodayTransactions(todayTxs);

      const attentionList = [];
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      products.forEach(p => {
        const qty = parseFloat(p.Quantity) || 0;
        let isExpiringSoon = false;
        let reason = "";
        if (p.ExpiryDate && p.ExpiryDate !== "-" && p.ExpiryDate !== "") {
           const expDate = new Date(p.ExpiryDate);
           if (expDate <= thirtyDaysFromNow) {
             isExpiringSoon = true;
             reason = "ใกล้หมดอายุ (" + p.ExpiryDate + ")";
           }
        }
        if (qty <= 5) {
          reason = reason ? reason + " และ " : "";
          reason += "สต๊อกเหลือน้อย (" + qty + " ชิ้น)";
        }
        if (qty <= 5 || isExpiringSoon) {
          attentionList.push({ ...p, attentionReason: reason });
        }
      });
      setAttentionProducts(attentionList);

      setRecentOrders(sortedTxs.slice(0, 5));
      setStats([
        { id: "sales", name: "ยอดขายวันนี้", value: `฿${todaySales.toLocaleString()}`, change: "ยอดรวมวันนี้", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600 border-blue-200" },
        { id: "orders", name: "จำนวนออเดอร์", value: todayOrders.toString(), change: "ออเดอร์ของวันนี้", icon: <Activity size={24} />, color: "bg-green-50 text-green-600 border-green-200" },
        { id: "attention", name: "สินค้าใกล้หมดอายุ/หมดสต๊อก", value: attentionList.length.toString(), change: "รายการที่ต้องตรวจสอบ", icon: <Package size={24} />, color: "bg-red-50 text-red-600 border-red-200" },
        { id: "products", name: "จำนวนสินค้าในระบบ", value: products.length.toString(), change: "พร้อมขาย", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600 border-purple-200" }
      ]);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">ภาพรวมระบบ (Dashboard)</h2>
        <button 
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm text-gray-500 font-medium hover:text-primary transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          {isLoading ? "กำลังอัปเดต..." : "อัปเดตล่าสุด: เมื่อสักครู่"}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => setSelectedCard(selectedCard === stat.id ? null : stat.id)}
            className={clsx(
              "text-left bg-white p-6 rounded-2xl shadow-sm transition-all group duration-200 border-2 outline-none",
              selectedCard === stat.id ? stat.color + " ring-4 ring-opacity-20 ring-offset-1 scale-[1.02]" : "border-transparent hover:border-gray-200 hover:shadow-md"
            )}
            title="คลิกเพื่อดูรายละเอียด"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className={clsx("text-sm font-semibold", selectedCard === stat.id ? "text-gray-900" : "text-gray-500")}>{stat.name}</p>
                <h3 className={clsx("text-3xl font-bold mt-2 tracking-tight transition-colors", selectedCard === stat.id ? "" : "text-gray-900")}>{stat.value}</h3>
              </div>
              <div className={clsx("p-3 rounded-xl transition-transform", selectedCard === stat.id ? "bg-white/50" : stat.color, "group-hover:scale-110")}>
                {stat.icon}
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm font-medium">
              <span className={selectedCard === stat.id ? "text-gray-800" : "text-gray-400"}>{stat.change}</span>
              <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity">ดูรายละเอียด →</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Area */}
      {selectedCard ? (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {selectedCard === "sales" || selectedCard === "orders" ? "รายการออเดอร์ของวันนี้" : 
               selectedCard === "attention" ? "สินค้ารอการตรวจสอบด่วน (สต๊อกต่ำ/ใกล้หมดอายุ)" : "รายการสินค้าทั้งหมดในระบบ"}
            </h3>
            <button onClick={() => setSelectedCard(null)} className="text-sm font-medium text-gray-500 hover:text-gray-900">
              ปิดรายละเอียด ✕
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[600px]">
              
              {/* === TABLE FOR SALES/ORDERS === */}
              {(selectedCard === "sales" || selectedCard === "orders") && (
                <>
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium sticky top-0">
                    <tr>
                      <th className="py-4 px-6">รหัสออเดอร์</th>
                      <th className="py-4 px-6">เวลา</th>
                      <th className="py-4 px-6">ช่องทางจ่าย</th>
                      <th className="py-4 px-6 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {todayTransactions.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400">ไม่มีรายการขายวันนี้</td></tr>
                    ) : todayTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-3 px-6 font-semibold text-gray-900">{tx.OrderID}</td>
                        <td className="py-3 px-6 text-gray-600">{new Date(tx.Date).toLocaleTimeString()}</td>
                        <td className="py-3 px-6 text-gray-600">{tx.PaymentMethod}</td>
                        <td className="py-3 px-6 text-right font-bold text-primary">฿{parseFloat(tx.TotalAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* === TABLE FOR ATTENTION === */}
              {selectedCard === "attention" && (
                <>
                  <thead className="bg-red-50 border-b border-red-100 text-red-600 font-medium sticky top-0">
                    <tr>
                      <th className="py-4 px-6">ชื่อสินค้า</th>
                      <th className="py-4 px-6">รายการที่ต้องระวัง</th>
                      <th className="py-4 px-6 text-right">จำนวนเหลือ</th>
                      <th className="py-4 px-6 text-right">ราคา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attentionProducts.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400">ไม่มีสินค้าที่ต้องกังวล ปกติดี! 🎉</td></tr>
                    ) : attentionProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-red-50/30">
                        <td className="py-3 px-6">
                          <div className="font-semibold text-gray-900">{p.Name}</div>
                          <div className="text-xs text-gray-500">{p.Barcode}</div>
                        </td>
                        <td className="py-3 px-6 text-red-600 flex items-center gap-2 font-medium">
                          <AlertTriangle size={16} /> {p.attentionReason}
                        </td>
                        <td className="py-3 px-6 text-right font-bold text-gray-900">{p.Quantity}</td>
                        <td className="py-3 px-6 text-right text-gray-600">฿{parseFloat(p.Price || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* === TABLE FOR ALL PRODUCTS === */}
              {selectedCard === "products" && (
                <>
                  <thead className="bg-purple-50 border-b border-purple-100 text-purple-700 font-medium sticky top-0">
                    <tr>
                      <th className="py-4 px-6">ชื่อสินค้า</th>
                      <th className="py-4 px-6">บาร์โค้ด</th>
                      <th className="py-4 px-6">โลเคชั่น</th>
                      <th className="py-4 px-6 text-right">จำนวนคลัง</th>
                      <th className="py-4 px-6 text-right">ราคา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allProducts.length === 0 ? (
                      <tr><td colSpan="5" className="py-10 text-center text-gray-400">ไม่มีสินค้าในระบบ</td></tr>
                    ) : allProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/30">
                        <td className="py-3 px-6 font-semibold text-gray-900">{p.Name}</td>
                        <td className="py-3 px-6 text-gray-500 font-mono text-xs">{p.Barcode}</td>
                        <td className="py-3 px-6 text-gray-600">{p.Location || "-"}</td>
                        <td className="py-3 px-6 text-right font-bold text-gray-900">{p.Quantity || 0}</td>
                        <td className="py-3 px-6 text-right text-primary font-medium">฿{parseFloat(p.Price || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* Default Charts / Activity Area when no card is selected */
        <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">กราฟยอดขาย (ตัวอย่าง)</h3>
            <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/50">
              <p className="text-gray-400 font-medium">(คลิกที่การ์ดด้านบนเพื่อดูข้อมูลรายละเอียดแบบตาราง)</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
            <h3 className="text-lg font-bold text-gray-900 mb-6">รายการล่าสุด</h3>
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8 text-gray-400"><Loader2 className="animate-spin" /></div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">ยังไม่มีรายการขายล่าสุด</div>
              ) : (
                recentOrders.map((tx, idx) => {
                  const diffMs = new Date() - new Date(tx.Date);
                  const diffMins = Math.floor(diffMs / 60000);
                  let timeStr = diffMins < 60 ? `${diffMins} นาทีที่แล้ว` : `${Math.floor(diffMins/60)} ชั่วโมงที่แล้ว`;
                  if (diffMins === 0) timeStr = "เมื่อสักครู่";

                  return (
                    <div key={idx} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{tx.OrderID}</p>
                        <p className="text-xs text-gray-500">{timeStr} &bull; {tx.PaymentMethod}</p>
                      </div>
                      <div className="text-sm font-bold text-primary">
                        +฿{parseFloat(tx.TotalAmount).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

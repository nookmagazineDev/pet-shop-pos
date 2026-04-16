import { useState, useEffect } from "react";
import { TrendingUp, Package, Users, DollarSign, Activity, Loader2, RefreshCcw } from "lucide-react";
import { fetchApi } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState([
    { name: "ยอดขายวันนี้", value: "฿0", change: "กำลังโหลด...", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600" },
    { name: "จำนวนออเดอร์", value: "0", change: "กำลังโหลด...", icon: <Activity size={24} />, color: "bg-green-50 text-green-600" },
    { name: "รายการที่ต้องความสนใจ", value: "0", change: "กำลังโหลด...", icon: <Package size={24} />, color: "bg-red-50 text-red-600" },
    { name: "สินค้าทั้งหมด", value: "0", change: "กำลังโหลด...", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600" }
  ]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txsData, prodsData] = await Promise.all([
        fetchApi("getTransactions"),
        fetchApi("getProducts")
      ]);

      const transactions = Array.isArray(txsData) ? txsData : [];
      const products = Array.isArray(prodsData) ? prodsData : [];

      const todayStr = new Date().toDateString();
      let todaySales = 0;
      let todayOrders = 0;
      
      const sortedTxs = transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
      sortedTxs.forEach(tx => {
        if (new Date(tx.Date).toDateString() === todayStr) {
          todaySales += parseFloat(tx.TotalAmount) || 0;
          todayOrders++;
        }
      });

      let attentionCount = 0;
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      products.forEach(p => {
        const qty = parseFloat(p.Quantity) || 0;
        let isExpiringSoon = false;
        if (p.ExpiryDate && p.ExpiryDate !== "-" && p.ExpiryDate !== "") {
           const expDate = new Date(p.ExpiryDate);
           if (expDate <= thirtyDaysFromNow) {
             isExpiringSoon = true;
           }
        }
        if (qty <= 5 || isExpiringSoon) {
          attentionCount++;
        }
      });

      setRecentOrders(sortedTxs.slice(0, 5));
      setStats([
        { name: "ยอดขายวันนี้", value: `฿${todaySales.toLocaleString()}`, change: "วันนี้ทั้งหมด", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600" },
        { name: "จำนวนออเดอร์", value: todayOrders.toString(), change: "ออเดอร์วันนี้", icon: <Activity size={24} />, color: "bg-green-50 text-green-600" },
        { name: "สินค้าใกล้หมดอายุ/หมดสต๊อก", value: attentionCount.toString(), change: "รายการที่ต้องตรวจสอบ", icon: <Package size={24} />, color: "bg-red-50 text-red-600" },
        { name: "จำนวนสินค้าในระบบ", value: products.length.toString(), change: "รายการทั้งหมด", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600" }
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
    <div className="space-y-6 max-w-7xl mx-auto">
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
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-gray-500">{stat.name}</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                {stat.icon}
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm font-medium">
              <span className="text-gray-400">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts / Activity Area */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-6">กราฟยอดขาย (ตัวอย่าง)</h3>
          <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/50">
            <p className="text-gray-400 font-medium">(พื้นที่สำหรับแสดงกราฟยอดขายเพิ่มเติมในอนาคต)</p>
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
    </div>
  );
}

import { useState, useEffect } from "react";
import { TrendingUp, Package, Users, DollarSign, Activity, Loader2, RefreshCcw, AlertTriangle, Store } from "lucide-react";
import clsx from "clsx";
import { fetchApi } from "../api";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

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
  const [todaySalesBreakdown, setTodaySalesBreakdown] = useState({ cash: 0, transfer: 0, credit: 0 });
  const [lowStoreStock, setLowStoreStock] = useState([]);

  // Chart Data State
  const [chartDataDaily, setChartDataDaily] = useState([]);
  const [chartDataPayment, setChartDataPayment] = useState([]);
  const [chartDataCategory, setChartDataCategory] = useState([]);
  
  // Date Range State
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultEndDate.getDate() - 13);
  const [startDateStr, setStartDateStr] = useState(defaultStartDate.toISOString().split('T')[0]);
  const [endDateStr, setEndDateStr] = useState(defaultEndDate.toISOString().split('T')[0]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txsData, prodsData, storeData] = await Promise.all([
        fetchApi("getTransactions"),
        fetchApi("getProducts"),
        fetchApi("getStoreStock")
      ]);

      const transactions = Array.isArray(txsData) ? txsData : [];
      const products = Array.isArray(prodsData) ? prodsData : [];
      const storeStock = Array.isArray(storeData) ? storeData : [];
      setAllProducts(products);

      const todayStr = new Date().toDateString();
      let todaySales = 0;
      let todayOrders = 0;
      const todayTxs = [];
      let cashTotal = 0;
      let transferTotal = 0;
      let creditTotal = 0;
      
      // Dynamic Date Range for Charts
      const sDate = new Date(startDateStr);
      sDate.setHours(0,0,0,0);
      const eDate = new Date(endDateStr);
      eDate.setHours(23,59,59,999);
      
      const dayDiff = Math.max(1, Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)));
      const dateRangeArr = Array.from({length: dayDiff}, (_, i) => {
        const d = new Date(sDate);
        d.setDate(d.getDate() + i);
        return {
          date: d.toLocaleDateString("th-TH", { day: 'numeric', month: 'short' }),
          fullDate: d.toDateString(),
          sales: 0
        };
      });

      const paymentStats = { "เงินสด": 0, "เงินโอน": 0, "บัตรเครดิต": 0 };
      const categoryStats = {};

      const sortedTxs = transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));
      sortedTxs.forEach(tx => {
        const txDate = new Date(tx.Date);
        const txAmt = parseFloat(tx.TotalAmount) || 0;

        // Check if transaction is within the selected date range
        if (txDate >= sDate && txDate <= eDate) {
          // Chart 1 Match
          const dayMatch = dateRangeArr.find(d => d.fullDate === txDate.toDateString());
          if (dayMatch) {
            dayMatch.sales += txAmt;
          }

          // Chart 2 Payment Match
          if (paymentStats[tx.PaymentMethod] !== undefined) {
             paymentStats[tx.PaymentMethod] += txAmt;
          } else if (tx.PaymentMethod) {
             paymentStats[tx.PaymentMethod] = txAmt;
          }

          // Chart 3 Category Match
          try {
             const items = JSON.parse(tx.CartDetails || "[]");
             items.forEach(item => {
               const cat = item.Category || item.category || "อื่นๆ";
               const itemTotal = (parseFloat(item.Price || item.price) * parseFloat(item.qty)) || 0;
               categoryStats[cat] = (categoryStats[cat] || 0) + itemTotal;
             });
          } catch(e) {}
        }

        // Today metrics
        if (txDate.toDateString() === todayStr) {
          todaySales += txAmt;
          todayOrders++;
          todayTxs.push(tx);
          
          if (tx.PaymentMethod === "เงินสด") cashTotal += txAmt;
          else if (tx.PaymentMethod === "เงินโอน") transferTotal += txAmt;
          else if (tx.PaymentMethod === "บัตรเครดิต") creditTotal += txAmt;
        }
      });
      
      setChartDataDaily(dateRangeArr);
      setChartDataPayment(
        Object.entries(paymentStats)
          .filter(([_, v]) => v > 0)
          .map(([name, value]) => ({ name, value }))
      );
      setChartDataCategory(
        Object.entries(categoryStats)
          .filter(([_, v]) => v > 0)
          .sort((a, b) => b[1] - a[1]) // highest first
          .slice(0, 7) // top 7 categories to avoid clutter
          .map(([name, value]) => ({ name, value }))
      );

      setTodayTransactions(todayTxs);
      setTodaySalesBreakdown({ cash: cashTotal, transfer: transferTotal, credit: creditTotal });

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

      const lowStore = storeStock.filter(s => parseFloat(s.Quantity) <= 3);
      setLowStoreStock(lowStore);

      setRecentOrders(sortedTxs.slice(0, 5));
      setStats([
        { id: "sales", name: "ยอดขายวันนี้", value: `฿${todaySales.toLocaleString()}`, change: "ยอดรวมวันนี้", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600 border-blue-200" },
        { id: "orders", name: "จำนวนออเดอร์", value: todayOrders.toString(), change: "ออเดอร์ของวันนี้", icon: <Activity size={24} />, color: "bg-green-50 text-green-600 border-green-200" },
        { id: "attention", name: "สินค้าใกล้หมดอายุ/หมดสต๊อก", value: attentionList.length.toString(), change: "รายการที่ต้องตรวจสอบ", icon: <Package size={24} />, color: "bg-red-50 text-red-600 border-red-200" },
        { id: "products", name: "จำนวนสินค้าในระบบ", value: products.length.toString(), change: "พร้อมขาย", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600 border-purple-200" },
        { id: "storestock", name: "สินค้าหน้าร้านใกล้หมด", value: lowStore.length.toString(), change: "คงเหลือ ≤ 3 ชิ้น", icon: <Store size={24} />, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
      ]);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [startDateStr, endDateStr]);

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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
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
              
              {/* === TABLE FOR SALES === */}
              {selectedCard === "sales" && (
                <>
                  <thead className="bg-blue-50 border-b border-blue-100 text-blue-700 font-medium sticky top-0">
                    <tr>
                      <th colSpan="4" className="py-3 px-6 bg-blue-100/50 border-b border-blue-100">
                        <div className="flex gap-8 text-sm">
                          <div><span className="text-gray-500">เงินสด:</span> <span className="font-bold text-gray-900">฿{todaySalesBreakdown.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                          <div><span className="text-gray-500">เงินโอน:</span> <span className="font-bold text-gray-900">฿{todaySalesBreakdown.transfer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                          <div><span className="text-gray-500">บัตรเครดิต:</span> <span className="font-bold text-gray-900">฿{todaySalesBreakdown.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        </div>
                      </th>
                    </tr>
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
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="py-3 px-6 font-semibold text-gray-900">{tx.OrderID}</td>
                        <td className="py-3 px-6 text-gray-600">{new Date(tx.Date).toLocaleTimeString()}</td>
                        <td className="py-3 px-6 text-gray-600">{tx.PaymentMethod}</td>
                        <td className="py-3 px-6 text-right font-bold text-primary">฿{parseFloat(tx.TotalAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* === TABLE FOR ORDERS === */}
              {selectedCard === "orders" && (
                <>
                  <thead className="bg-green-50 border-b border-green-100 text-green-700 font-medium sticky top-0">
                    <tr>
                      <th className="py-4 px-6 w-1/4">รหัสออเดอร์ & เวลา</th>
                      <th className="py-4 px-6">รายละเอียดสินค้าที่ขายออกไป</th>
                      <th className="py-4 px-6 text-right w-1/4">ยอดซื้อรวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {todayTransactions.length === 0 ? (
                      <tr><td colSpan="3" className="py-10 text-center text-gray-400">ยังไม่มีออเดอร์ของวันนี้</td></tr>
                    ) : todayTransactions.map((tx, idx) => {
                      let cartItems = [];
                      try {
                        cartItems = JSON.parse(tx.CartDetails || "[]");
                      } catch(e) {}
                      
                      return (
                        <tr key={idx} className="hover:bg-green-50/30">
                          <td className="py-4 px-6 align-top">
                            <div className="font-semibold text-gray-900">{tx.OrderID}</div>
                            <div className="text-xs text-gray-500 mt-1">{new Date(tx.Date).toLocaleTimeString()}</div>
                          </td>
                          <td className="py-4 px-6">
                            <ul className="space-y-2">
                              {cartItems.map((item, i) => (
                                <li key={i} className="flex justify-between items-start text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                  <div>
                                    <div className="font-semibold text-gray-800">{item.Name || item.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{item.Barcode || "-"}</div>
                                  </div>
                                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md font-bold text-xs shrink-0 shadow-sm border border-green-200">
                                    ออก {item.qty} ชิ้น
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-gray-900 align-top">฿{parseFloat(tx.TotalAmount).toLocaleString()}</td>
                        </tr>
                      );
                    })}
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

              {/* === TABLE FOR STORE STOCK LOW === */}
              {selectedCard === "storestock" && (
                <>
                  <thead className="bg-emerald-50 border-b border-emerald-100 text-emerald-700 font-medium sticky top-0">
                    <tr>
                      <th className="py-4 px-6">ชื่อสินค้า</th>
                      <th className="py-4 px-6">ตำแหน่งหน้าร้าน</th>
                      <th className="py-4 px-6">อัปเดตล่าสุด</th>
                      <th className="py-4 px-6 text-right">คงเหลือหน้าร้าน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lowStoreStock.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400">สินค้าหน้าร้านยังมีเพียงพอ 🎉</td></tr>
                    ) : lowStoreStock.map((s, idx) => (
                      <tr key={idx} className="hover:bg-emerald-50/30">
                        <td className="py-3 px-6">
                          <div className="font-semibold text-gray-900">{s.Name}</div>
                          <div className="text-xs text-gray-500 font-mono">{s.Barcode}</div>
                        </td>
                        <td className="py-3 px-6 text-gray-600">{s.StoreLocation || "-"}</td>
                        <td className="py-3 px-6 text-gray-500 text-sm">{s.UpdatedAt ? new Date(s.UpdatedAt).toLocaleString("th-TH") : "-"}</td>
                        <td className="py-3 px-6 text-right">
                          <span className="font-bold text-lg text-red-600">{s.Quantity}</span>
                          <div className="text-xs text-red-500 font-medium">ต้องเติมด่วน!</div>
                        </td>
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
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <span className="font-semibold text-gray-700">ช่วงเวลาของข้อมูลกราฟ:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
              />
            </div>
            {isLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Chart 1: Daily Sales (Line Chart) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">ยอดขายรายวัน (ตามช่วงเวลาที่เลือก)</h3>
            <div className="flex-1 w-full h-[300px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataDaily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `฿${value}`} />
                    <Tooltip 
                      formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']}
                      labelStyle={{ color: '#111827', fontWeight: 'bold' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          
          {/* Recent Orders List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">รายการล่าสุด</h3>
            <div className="space-y-4 flex-1 overflow-auto">
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

          {/* Chart 2: Payment Methods (Pie Chart) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[350px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ช่องทางชำระเงิน</h3>
            <div className="flex-1 w-full h-[250px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : chartDataPayment.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDataPayment}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartDataPayment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Sales by Category (Bar Chart) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[350px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">ยอดขายตามหมวดหมู่</h3>
            <div className="flex-1 w-full h-[250px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : chartDataCategory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataCategory} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `฿${value}`} />
                    <Tooltip 
                      formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']}
                      cursor={{ fill: '#F3F4F6' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                      {chartDataCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          </div>

        </div>
      )}
    </div>
  );
}

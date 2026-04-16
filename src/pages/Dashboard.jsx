import { TrendingUp, Package, Users, DollarSign, Activity } from "lucide-react";

export default function Dashboard() {
  const stats = [
    { name: "ยอดขายวันนี้", value: "฿12,450", change: "+14%", icon: <DollarSign size={24} />, color: "bg-blue-50 text-blue-600" },
    { name: "จำนวนออเดอร์", value: "45", change: "+5%", icon: <Activity size={24} />, color: "bg-green-50 text-green-600" },
    { name: "สินค้าใกล้หมดอายุ/หมดสต๊อก", value: "8", change: "-2", icon: <Package size={24} />, color: "bg-red-50 text-red-600" },
    { name: "ลูกค้าสมาชิก", value: "112", change: "+12%", icon: <Users size={24} />, color: "bg-purple-50 text-purple-600" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">ภาพรวมระบบ (Dashboard)</h2>
        <div className="text-sm text-gray-500 font-medium">อัปเดตล่าสุด: เมื่อสักครู่</div>
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
              <TrendingUp size={16} className="text-green-500 mr-1" />
              <span className="text-green-500">{stat.change}</span>
              <span className="text-gray-400 ml-2">เทียบกับสัปดาห์ที่แล้ว</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts / Activity Area */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-6">กราฟยอดขาย</h3>
          <div className="flex-1 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/50">
            <p className="text-gray-400 font-medium">(พื้นที่สำหรับแสดงกราฟยอดขาย)</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
          <h3 className="text-lg font-bold text-gray-900 mb-6">รายการล่าสุด</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-gray-900">ออเดอร์ #ORD-{3492 + i}</p>
                  <p className="text-xs text-gray-500">2 นาทีที่แล้ว</p>
                </div>
                <div className="text-sm font-bold text-primary">
                  +฿{(Math.random() * 2000 + 100).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Clock, LogOut } from "lucide-react";

export default function Layout() {
  const menuItems = [
    { name: "แดชบอร์ด (Dashboard)", path: "/", icon: <LayoutDashboard size={20} /> },
    { name: "ระบบขายหน้าร้าน (POS)", path: "/pos", icon: <ShoppingCart size={20} /> },
    { name: "คลังสินค้า (Inventory)", path: "/inventory", icon: <Package size={20} /> },
    { name: "จัดการกะ (Shift)", path: "/shift", icon: <Clock size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary">PetShop Next</h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center gap-3 px-3 py-2.5 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
            <LogOut size={20} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <div className="text-sm text-gray-500">
            สถานะกะ: <span className="font-semibold text-green-600">เปิดอยู่</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">พนักงานหน้าร้าน</div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              พ
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

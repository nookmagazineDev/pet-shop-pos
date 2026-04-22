
import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Clock, Globe, LogOut, Wallet, FileText, Tag } from "lucide-react";
import { useShift } from "../context/ShiftContext";

export default function Layout() {
  const { isShiftOpen, shiftState } = useShift();

  const menuItems = [
    { name: "แดชบอร์ด", fullName: "แดชบอร์ด (Dashboard)", path: "/", icon: <LayoutDashboard size={20} /> },
    { name: "POS", fullName: "ระบบขายหน้าร้าน (POS)", path: "/pos", icon: <ShoppingCart size={20} /> },
    { name: "ออนไลน์", fullName: "ขายออนไลน์ (Online)", path: "/online", icon: <Globe size={20} /> },
    { name: "คลังสินค้า", fullName: "คลังสินค้า (Inventory)", path: "/inventory", icon: <Package size={20} /> },
    { name: "จัดการกะ", fullName: "จัดการกะ (Shift)", path: "/shift", icon: <Clock size={20} /> },
    { name: "บัญชี", fullName: "รายรับ-รายจ่าย (Ledger)", path: "/accounting", icon: <Wallet size={20} /> },
    { name: "รายงาน", fullName: "รายงาน (Reports)", path: "/reports", icon: <FileText size={20} /> },
    { name: "โปรโมชั่น", fullName: "โปรโมชั่น (Promotions)", path: "/promotions", icon: <Tag size={20} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col shadow-sm hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <h1 className="text-lg font-bold text-primary">บริษัทมะมามี (1989) จำกัด</h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
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
              {item.fullName}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button className="flex items-center gap-3 px-3 py-2.5 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
            <LogOut size={20} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2">
            <div className="md:hidden w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold mr-2 text-xs">PS</div>
            <div className="text-xs md:text-sm text-gray-500">
              สถานะกะ: <span className={isShiftOpen ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{shiftState}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-xs md:text-sm font-medium hidden sm:block">พนักงานหน้าร้าน</div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary-foreground font-bold">
              พ
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around px-2 py-1.5 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center p-1.5 rounded-lg transition-colors min-w-[64px] ${
                isActive
                  ? "text-primary font-bold"
                  : "text-gray-500 hover:text-gray-900"
              }`
            }
          >
            {item.icon}
            <span className="text-[10px] mt-1">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

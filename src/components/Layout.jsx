
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Clock, Globe, LogOut, Wallet, FileText, Tag, ShieldCheck, Printer, Star, Users, Ticket, Truck } from "lucide-react";
import { useShift } from "../context/ShiftContext";
import { useAuth } from "../context/AuthContext";
import clsx from "clsx";

const ALL_MENU = [
  { name: "แดชบอร์ด", fullName: "แดชบอร์ด (Dashboard)", path: "/", icon: <LayoutDashboard size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "POS", fullName: "ระบบขายหน้าร้าน (POS)", path: "/pos", icon: <ShoppingCart size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "ออนไลน์", fullName: "ขายออนไลน์ (Online)", path: "/online", icon: <Globe size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "คลังสินค้า", fullName: "คลังสินค้า (Inventory)", path: "/inventory", icon: <Package size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "จัดการกะ", fullName: "จัดการกะ (Shift)", path: "/shift", icon: <Clock size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "บัญชี", fullName: "รายรับ-รายจ่าย (Ledger)", path: "/accounting", icon: <Wallet size={20} />, roles: ["admin", "manager", "staff", "cashier"] },
  { name: "รายงาน", fullName: "รายงาน (Reports)", path: "/reports", icon: <FileText size={20} />, roles: ["admin", "manager"] },
  { name: "โปรโมชั่น", fullName: "โปรโมชั่น (Promotions)", path: "/promotions", icon: <Tag size={20} />, roles: ["admin", "manager"] },
  { name: "เครดิต", fullName: "เครดิต & แพคเกจ (Credit)", path: "/packages", icon: <Star size={20} />, roles: ["admin", "manager"] },
  { name: "สมาชิก", fullName: "สมาชิก (Members)", path: "/members", icon: <Users size={20} />, roles: ["admin", "manager"] },
  { name: "คูปอง", fullName: "คูปอง (Coupons)", path: "/coupons", icon: <Ticket size={20} />, roles: ["admin", "manager"] },
  { name: "ซัพพลาย", fullName: "ซัพพลายเออร์ (Suppliers)", path: "/suppliers", icon: <Truck size={20} />, roles: ["admin", "manager"] },
  { name: "ปริ้นเตอร์", fullName: "ตั้งค่าปริ้นเตอร์", path: "/settings/printer", icon: <Printer size={20} />, roles: ["admin", "manager"] },
  { name: "พนักงาน", fullName: "จัดการพนักงาน (Admin)", path: "/admin/users", icon: <ShieldCheck size={20} />, roles: ["admin"], adminOnly: true },
];

export default function Layout() {
  const { isShiftOpen, shiftState } = useShift();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const role = currentUser?.role || "staff";
  const menuItems = ALL_MENU.filter(item => item.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const roleLabels = { admin: "ผู้ดูแลระบบ", manager: "ผู้จัดการ", staff: "พนักงาน", cashier: "แคชเชียร์" };
  const roleLabel = roleLabels[role] || role;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col shadow-sm hidden md:flex shrink-0">
        <div className="h-20 flex items-center px-4 border-b border-gray-200 shrink-0 gap-3">
          <img src="/logo.png" alt="mamaa ME'" className="h-14 w-auto object-contain shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-primary leading-tight text-sm">mamaa ME'</div>
            <div className="text-[10px] text-gray-400 leading-tight">บริษัทมะมามี (1989) จำกัด</div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium",
                  item.adminOnly && "border border-dashed border-purple-200",
                  isActive
                    ? item.adminOnly ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-primary text-primary-foreground"
                    : item.adminOnly ? "text-purple-600 hover:bg-purple-50" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )
              }
            >
              {item.icon}
              {item.fullName}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 shrink-0 space-y-2">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {(currentUser?.displayName || "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{currentUser?.displayName || "ผู้ใช้งาน"}</div>
              <div className="text-xs text-gray-500">{roleLabel}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
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
            <div className="text-xs md:text-sm font-medium hidden sm:block text-gray-700">
              {currentUser?.displayName || ""} <span className="text-gray-400 text-xs">({roleLabel})</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">ออก</span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around px-2 py-1.5 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {menuItems.slice(0, 6).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              clsx("flex flex-col items-center p-1.5 rounded-lg transition-colors min-w-[48px]",
                isActive ? "text-primary font-bold" : "text-gray-500 hover:text-gray-900"
              )
            }
          >
            {item.icon}
            <span className="text-[9px] mt-1">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

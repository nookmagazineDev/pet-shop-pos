import { useState, useEffect } from "react";
import { fetchApi, postApi } from "../api";
import { Users, Plus, Power, Trash2, Edit, X, Check, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const ROLES = [
  { value: "admin", label: "Admin (ผู้ดูแลระบบ)", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "manager", label: "Manager (ผู้จัดการ)", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "staff", label: "Staff (พนักงานทั่วไป)", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cashier", label: "Cashier (แคชเชียร์)", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

function RoleBadge({ role }) {
  const found = ROLES.find(r => r.value === role);
  if (!found) return <span className="px-2 py-0.5 rounded-full border text-xs font-medium bg-gray-100 text-gray-600">{role}</span>;
  return <span className={clsx("px-2 py-0.5 rounded-full border text-xs font-semibold", found.color)}>{found.label}</span>;
}

const emptyForm = { userId: "", username: "", password: "", displayName: "", role: "staff" };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchUsers = async () => {
    setIsLoading(true);
    const data = await fetchApi("getUsers");
    setUsers(Array.isArray(data) ? data : []);
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => { setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (user) => {
    setForm({ userId: user.UserID, username: user.Username, password: "", displayName: user.DisplayName, role: user.Role });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.username || !form.displayName || !form.role) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    if (!form.userId && !form.password) return alert("กรุณากำหนดรหัสผ่านสำหรับผู้ใช้ใหม่");
    setIsSaving(true);
    const res = await postApi({ action: "saveUser", payload: form });
    setIsSaving(false);
    if (res.success) { setIsModalOpen(false); fetchUsers(); }
    else alert("เกิดข้อผิดพลาด: " + (res.error || "Unknown"));
  };

  const handleToggle = async (userId) => {
    await postApi({ action: "toggleUserStatus", payload: { userId } });
    fetchUsers();
  };

  const handleDelete = async (userId, displayName) => {
    if (!confirm(`ต้องการลบบัญชี "${displayName}" ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    await postApi({ action: "deleteUser", payload: { userId } });
    fetchUsers();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-purple-600" /> จัดการพนักงานและสิทธิ์ (Admin)
          </h2>
          <p className="text-sm text-gray-500 mt-1">เพิ่ม แก้ไข หรือจัดการบัญชีพนักงาน และกำหนดระดับสิทธิ์การเข้าถึง</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus size={18} /> เพิ่มพนักงานใหม่
        </button>
      </div>

      {/* Role permissions info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map(r => (
          <div key={r.value} className={clsx("rounded-xl border px-4 py-3 text-xs", r.color)}>
            <div className="font-bold mb-1">{r.label}</div>
            <div className="opacity-80">
              {r.value === "admin" && "เข้าถึงได้ทุกเมนู รวมถึงจัดการพนักงาน"}
              {r.value === "manager" && "ทุกเมนูหลัก ยกเว้นจัดการพนักงาน"}
              {r.value === "staff" && "Dashboard, POS, Online, คลังสินค้า"}
              {r.value === "cashier" && "Dashboard และ POS เท่านั้น"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-purple-50/50 sticky top-0 z-10">
              <tr className="border-b border-purple-100 text-sm font-medium text-purple-800">
                <th className="py-3 px-6">ชื่อ-นามสกุล</th>
                <th className="py-3 px-6">Username</th>
                <th className="py-3 px-6">บทบาท (Role)</th>
                <th className="py-3 px-6 text-center">สถานะ</th>
                <th className="py-3 px-6 text-center">เข้าสู่ระบบล่าสุด</th>
                <th className="py-3 px-6 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan="6" className="py-10 text-center text-gray-400"><Loader2 className="animate-spin inline mr-2" />กำลังโหลด...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="6" className="py-10 text-center text-gray-400"><Users size={40} className="opacity-20 mx-auto mb-2" />ยังไม่มีบัญชีพนักงาน</td></tr>
              ) : users.map((user, idx) => (
                <tr key={idx} className={clsx("hover:bg-purple-50/20 transition-colors", String(user.IsActive).toUpperCase() !== "TRUE" && "opacity-50 bg-gray-50")}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shrink-0">
                        {(user.DisplayName || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{user.DisplayName}</div>
                        <div className="text-xs text-gray-400 font-mono">{user.UserID}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-gray-700">{user.Username}</td>
                  <td className="py-4 px-6"><RoleBadge role={user.Role} /></td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => handleToggle(user.UserID)}
                      className={clsx("px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 transition-all", String(user.IsActive).toUpperCase() === "TRUE" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200")}
                    >
                      <Power size={11} /> {String(user.IsActive).toUpperCase() === "TRUE" ? "ใช้งาน" : "ระงับ"}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-center text-xs text-gray-500">
                    {user.LastLogin ? new Date(user.LastLogin).toLocaleString("th-TH") : "-"}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(user)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="แก้ไข"><Edit size={16} /></button>
                      {user.Role !== "admin" && (
                        <button onClick={() => handleDelete(user.UserID, user.DisplayName)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="ลบ"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center"><Users size={20} /></div>
                <h3 className="font-bold text-gray-900">{form.userId ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อ-นามสกุล (แสดงในระบบ) *</label>
                <input type="text" required value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})}
                  placeholder="เช่น สมชาย ใจดี" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username *</label>
                <input type="text" required value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  autoCapitalize="none" placeholder="เช่น somchai" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{form.userId ? "รหัสผ่านใหม่ (เว้นว่างไว้ถ้าไม่เปลี่ยน)" : "รหัสผ่าน *"}</label>
                <input type="password" required={!form.userId} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="รหัสผ่าน" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">บทบาท (Role) *</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-semibold">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="pt-4 flex gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

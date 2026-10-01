import { createContext, useContext, useState, useEffect } from "react";
import { postApi } from "../api";
import { supabase, USE_SUPABASE, staffEmail } from "../lib/supabase";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const stored = sessionStorage.getItem("pos_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const authErrorMessage = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("banned")) return "บัญชีนี้ถูกระงับการใช้งาน";
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  if (msg.includes("fetch") || msg.includes("network")) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
  return error?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
};

// Supabase Auth: staff type a username, which maps to a staff e-mail
async function supabaseLogin(username, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: staffEmail(username), password });
  if (error) return { success: false, error: authErrorMessage(error) };

  const { data, error: meError } = await supabase.rpc("api_me", { payload: {} });
  if (meError || !data?.success) {
    await supabase.auth.signOut();
    return { success: false, error: meError?.message || data?.error || "ไม่พบบัญชีผู้ใช้ในระบบ" };
  }
  return { success: true, user: data.user };
}

// Old Google Sheets login (VITE_BACKEND=sheets)
async function sheetsLogin(username, password) {
  // Fallback local admin account — works even without backend deployment
  const LOCAL_ADMIN = { username: "admin", password: "admin1234" };
  const isLocalAdmin =
    username.trim().toLowerCase() === LOCAL_ADMIN.username &&
    password.trim() === LOCAL_ADMIN.password;

  try {
    const res = await postApi({ action: "login", payload: { username, password } });
    if (res && res.success) return { success: true, user: res.user };
    // If backend returned an explicit error (e.g. wrong password), respect it
    if (res && res.error && !isLocalAdmin) return { success: false, error: res.error };
  } catch (err) {
    console.warn("Backend login failed, trying local fallback:", err);
  }

  // Backend not deployed yet OR returned error but we match local admin fallback
  if (isLocalAdmin) {
    return { success: true, user: { userId: "LOCAL-ADMIN", username: "admin", displayName: "ผู้ดูแลระบบ (Local)", role: "admin", isActive: true } };
  }
  return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(readStoredUser);

  const clearUser = () => {
    sessionStorage.removeItem("pos_user");
    setCurrentUser(null);
  };

  // The stored profile is only valid while there is a Supabase session behind it
  // (e.g. a profile saved by the old Sheets login has none).
  useEffect(() => {
    if (!USE_SUPABASE) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) clearUser();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearUser();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (username, password) => {
    const res = USE_SUPABASE ? await supabaseLogin(username, password) : await sheetsLogin(username, password);
    if (res.success) {
      sessionStorage.setItem("pos_user", JSON.stringify(res.user));
      setCurrentUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const logout = () => {
    clearUser();
    if (USE_SUPABASE) supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

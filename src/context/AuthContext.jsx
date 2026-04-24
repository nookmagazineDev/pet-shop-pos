import { createContext, useContext, useState, useEffect } from "react";
import { postApi } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("pos_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    // Fallback local admin account — works even without backend deployment
    const LOCAL_ADMIN = { username: "admin", password: "admin1234" };
    const isLocalAdmin =
      username.trim().toLowerCase() === LOCAL_ADMIN.username &&
      password.trim() === LOCAL_ADMIN.password;

    try {
      const res = await postApi({ action: "login", payload: { username, password } });
      if (res && res.success) {
        const user = res.user;
        sessionStorage.setItem("pos_user", JSON.stringify(user));
        setCurrentUser(user);
        return { success: true };
      }
      // If backend returned an explicit error (e.g. wrong password), respect it
      if (res && res.error && !isLocalAdmin) {
        return { success: false, error: res.error };
      }
    } catch (err) {
      console.warn("Backend login failed, trying local fallback:", err);
    }

    // Backend not deployed yet OR returned error but we match local admin fallback
    if (isLocalAdmin) {
      const user = { userId: "LOCAL-ADMIN", username: "admin", displayName: "ผู้ดูแลระบบ (Local)", role: "admin", isActive: true };
      sessionStorage.setItem("pos_user", JSON.stringify(user));
      setCurrentUser(user);
      return { success: true };
    }

    return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  };

  const logout = () => {
    sessionStorage.removeItem("pos_user");
    setCurrentUser(null);
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

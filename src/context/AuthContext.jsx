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
    const res = await postApi({ action: "login", payload: { username, password } });
    if (res.success) {
      const user = res.user;
      sessionStorage.setItem("pos_user", JSON.stringify(user));
      setCurrentUser(user);
      return { success: true };
    }
    return { success: false, error: res.error || "เกิดข้อผิดพลาด" };
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

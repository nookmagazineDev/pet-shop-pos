import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(username.trim(), password.trim());
    setIsLoading(false);
    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt="mamaa ME' Logo" className="h-36 w-auto drop-shadow-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">mamaa ME'</h1>
          <p className="text-white/70 text-sm">บริษัทมะมามี (1989) จำกัด</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <h2 className="text-xl font-bold text-white mb-6">เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                autoCapitalize="none"
                autoComplete="username"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-200 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-white text-purple-700 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-lg shadow-black/20 disabled:opacity-60 mt-2"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="text-center text-white/40 text-xs mt-6">
            ติดต่อผู้ดูแลระบบหากลืมรหัสผ่าน
          </p>
        </div>
      </div>
    </div>
  );
}

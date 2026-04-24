import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a route and checks if the current user has permission.
 * @param {string[]} allowedRoles - List of roles allowed to access this route.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 text-gray-500">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-700">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="text-sm">บทบาทของคุณ (<span className="font-semibold text-primary">{currentUser.role}</span>) ไม่ได้รับอนุญาต</p>
      </div>
    );
  }

  return children;
}

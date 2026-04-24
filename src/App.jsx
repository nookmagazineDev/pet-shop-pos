import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Shift from "./pages/Shift";
import OnlineSales from "./pages/OnlineSales";
import Accounting from "./pages/Accounting";
import Reports from "./pages/Reports";
import Promotions from "./pages/Promotions";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import { ShiftProvider } from "./context/ShiftContext";
import { AuthProvider } from "./context/AuthContext";

// Role definitions
const ALL = ["admin", "manager", "staff", "cashier"];
const MANAGEMENT = ["admin", "manager"];
const STORE = ["admin", "manager", "staff"];

function App() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<ProtectedRoute allowedRoles={ALL}><Dashboard /></ProtectedRoute>} />
              <Route path="pos" element={<ProtectedRoute allowedRoles={ALL}><POS /></ProtectedRoute>} />
              <Route path="online" element={<ProtectedRoute allowedRoles={STORE}><OnlineSales /></ProtectedRoute>} />
              <Route path="inventory" element={<ProtectedRoute allowedRoles={STORE}><Inventory /></ProtectedRoute>} />
              <Route path="shift" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Shift /></ProtectedRoute>} />
              <Route path="accounting" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Accounting /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Reports /></ProtectedRoute>} />
              <Route path="promotions" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Promotions /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ShiftProvider>
    </AuthProvider>
  );
}

export default App;

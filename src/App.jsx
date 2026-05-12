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
import Packages from "./pages/Packages";
import Members from "./pages/Members";
import Coupons from "./pages/Coupons";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import PrinterSettings from "./pages/PrinterSettings";
import Suppliers from "./pages/Suppliers";
import { ShiftProvider } from "./context/ShiftContext";
import { AuthProvider } from "./context/AuthContext";
import { PrinterProvider } from "./context/PrinterContext";
import { Toaster } from "react-hot-toast";

// Role definitions
const ALL = ["admin", "manager", "staff", "cashier"];
const MANAGEMENT = ["admin", "manager"];
const STORE_ALL = ["admin", "manager", "staff", "cashier"]; // same as ALL

function App() {
  return (
    <AuthProvider>
      <PrinterProvider>
        <ShiftProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<ProtectedRoute allowedRoles={ALL}><Dashboard /></ProtectedRoute>} />
              <Route path="pos" element={<ProtectedRoute allowedRoles={ALL}><POS /></ProtectedRoute>} />
              <Route path="online" element={<ProtectedRoute allowedRoles={STORE_ALL}><OnlineSales /></ProtectedRoute>} />
              <Route path="inventory" element={<ProtectedRoute allowedRoles={STORE_ALL}><Inventory /></ProtectedRoute>} />
              <Route path="shift" element={<ProtectedRoute allowedRoles={STORE_ALL}><Shift /></ProtectedRoute>} />
              <Route path="accounting" element={<ProtectedRoute allowedRoles={STORE_ALL}><Accounting /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Reports /></ProtectedRoute>} />
              <Route path="promotions" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Promotions /></ProtectedRoute>} />
              <Route path="packages" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Packages /></ProtectedRoute>} />
              <Route path="members" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Members /></ProtectedRoute>} />
              <Route path="coupons" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Coupons /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
              <Route path="settings/printer" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><PrinterSettings /></ProtectedRoute>} />
              <Route path="suppliers" element={<ProtectedRoute allowedRoles={MANAGEMENT}><Suppliers /></ProtectedRoute>} />
            </Route>
          </Routes>
          <Toaster position="top-right" />
        </BrowserRouter>
        </ShiftProvider>
      </PrinterProvider>
    </AuthProvider>
  );
}

export default App;

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import { ShiftProvider } from "./context/ShiftContext";
import { AuthProvider } from "./context/AuthContext";
import { PrinterProvider } from "./context/PrinterContext";
import { Toaster } from "react-hot-toast";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Shift = lazy(() => import("./pages/Shift"));
const OnlineSales = lazy(() => import("./pages/OnlineSales"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Reports = lazy(() => import("./pages/Reports"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Packages = lazy(() => import("./pages/Packages"));
const Members = lazy(() => import("./pages/Members"));
const Coupons = lazy(() => import("./pages/Coupons"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const PrinterSettings = lazy(() => import("./pages/PrinterSettings"));
const Suppliers = lazy(() => import("./pages/Suppliers"));

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
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">กำลังโหลด...</div>}>
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
          </Suspense>
        </BrowserRouter>
        </ShiftProvider>
      </PrinterProvider>
    </AuthProvider>
  );
}

export default App;

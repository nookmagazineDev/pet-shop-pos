import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Shift from "./pages/Shift";
import OnlineSales from "./pages/OnlineSales";
import Accounting from "./pages/Accounting";
import { ShiftProvider } from "./context/ShiftContext";

function App() {
  return (
    <ShiftProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="shift" element={<Shift />} />
            <Route path="online" element={<OnlineSales />} />
            <Route path="accounting" element={<Accounting />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ShiftProvider>
  );
}

export default App;

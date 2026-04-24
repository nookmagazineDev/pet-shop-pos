import { createContext, useContext, useState, useEffect } from "react";

const PrinterContext = createContext(null);

const DEFAULTS = {
  printerIp: "",
  paperWidth: "80",  // mm
  enableDirectPrint: false, // true = use node bridge
  shopName: "บริษัทมะมามี (1989) จำกัด",
  shopAddress: "100/116 พุทธมณฑลสาย 2 ซอย 24 แขวงศาลาธรรมสพน์ เขตทวีวัฒนา กรุงเทพมหานคร 10170",
  shopPhone: "085-363-8383",
  shopTaxId: "0105565009021",
  shopBranch: "สาขา 00001",
  footerNote: "ขอบคุณที่ใช้บริการค่ะ / ครับ",
};

export function PrinterProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("printer_settings");
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem("printer_settings", JSON.stringify(merged));
  };

  const resetSettings = () => {
    setSettings(DEFAULTS);
    localStorage.setItem("printer_settings", JSON.stringify(DEFAULTS));
  };

  return (
    <PrinterContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  return useContext(PrinterContext);
}

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchApi } from "../api";

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [shiftState, setShiftState] = useState("กำลังตรวจสอบ...");
  const [isChecking, setIsChecking] = useState(true);

  const refreshShiftStatus = useCallback(() => {
    setIsChecking(true);
    return fetchApi("getShifts").then(data => {
      if (Array.isArray(data)) {
        const lastShift = data.length > 0 ? data[data.length - 1] : null;
        if (lastShift && lastShift.Status === "OPEN") {
          setIsShiftOpen(true);
          setShiftState("เปิดอยู่");
        } else {
          setIsShiftOpen(false);
          setShiftState("ปิดอยู่");
        }
      } else {
        setIsShiftOpen(false);
        setShiftState("ปิดอยู่");
      }
      setIsChecking(false);
    }).catch(() => {
      setIsShiftOpen(false);
      setShiftState("ปิดอยู่");
      setIsChecking(false);
    });
  }, []);

  // Instant setter so Shift.jsx can update without waiting for API
  const markShiftOpen = () => {
    setIsShiftOpen(true);
    setShiftState("เปิดอยู่");
  };
  const markShiftClosed = () => {
    setIsShiftOpen(false);
    setShiftState("ปิดอยู่");
  };

  useEffect(() => {
    refreshShiftStatus();
  }, [refreshShiftStatus]);

  return (
    <ShiftContext.Provider value={{ isShiftOpen, shiftState, isChecking, refreshShiftStatus, markShiftOpen, markShiftClosed }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  return useContext(ShiftContext);
}

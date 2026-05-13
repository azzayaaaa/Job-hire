"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { AlertDialog } from "./AlertDialog";

export type AlertType = "success" | "error" | "info" | "warning";

export interface Alert {
  id: string;
  message: string;
  type: AlertType;
  title?: string;
  autoClose?: boolean;
}

interface AlertContextType {
  alerts: Alert[];
  showAlert: (message: string, type?: AlertType, title?: string) => void;
  removeAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const showAlert = useCallback((message: string, type: AlertType = "info", title?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newAlert: Alert = {
      id,
      message,
      type,
      title,
      autoClose: true,
    };

    setAlerts((prev) => [...prev, newAlert]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      removeAlert(id);
    }, 3000);

    return id;
  }, [removeAlert]);

  return (
    <AlertContext.Provider value={{ alerts, showAlert, removeAlert }}>
      {children}
      <AlertDialog alerts={alerts} onRemove={removeAlert} />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within AlertProvider");
  }
  return context;
}

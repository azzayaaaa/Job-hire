"use client";

import React from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import { Alert, AlertType } from "./AlertProvider";

interface AlertDialogProps {
  alerts: Alert[];
  onRemove: (id: string) => void;
}

const alertConfig: Record<AlertType, { bgColor: string; borderColor: string; icon: React.ReactNode; textColor: string }> = {
  error: {
    bgColor: "bg-red-500/15",
    borderColor: "border-red-500/40",
    icon: <AlertCircle size={20} className="text-red-400" />,
    textColor: "text-red-300",
  },
  success: {
    bgColor: "bg-emerald-500/15",
    borderColor: "border-emerald-500/40",
    icon: <CheckCircle size={20} className="text-emerald-400" />,
    textColor: "text-emerald-300",
  },
  warning: {
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/40",
    icon: <AlertTriangle size={20} className="text-amber-400" />,
    textColor: "text-amber-300",
  },
  info: {
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/40",
    icon: <Info size={20} className="text-blue-400" />,
    textColor: "text-blue-300",
  },
};

export function AlertDialog({ alerts, onRemove }: AlertDialogProps) {
  if (!alerts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
      {alerts.map((alert) => {
        const config = alertConfig[alert.type];
        return (
          <div
            key={alert.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300`}
            role="alert"
          >
            <div className="mt-0.5">{config.icon}</div>
            <div className="flex-1 min-w-0">
              {alert.title && (
                <h3 className={`font-semibold ${config.textColor} text-sm`}>{alert.title}</h3>
              )}
              <p className="text-sm text-slate-300 mt-1">{alert.message}</p>
            </div>
            <button
              onClick={() => onRemove(alert.id)}
              className="mt-0.5 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close alert"
            >
              <X size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

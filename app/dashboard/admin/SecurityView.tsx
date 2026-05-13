"use client";

import React, { useEffect, useState } from "react";
import { Shield, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";

interface SecurityAlert {
  id: number;
  level: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
}

export function SecurityView() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [scanResults, setScanResults] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    // Load initial security data
    fetchSecurityAlerts();
  }, []);

  const fetchSecurityAlerts = async () => {
    try {
      // Simulated data - replace with actual API call
      setAlerts([
        {
          id: 1,
          level: "critical",
          title: "SSL Certificate нийлүүлэлт 30 өдрийн дотор",
          description: "SSL сертификат 30 өдрийн дотор нийлүүлэгдэх хэрэгтэй",
          timestamp: new Date().toISOString(),
        },
        {
          id: 2,
          level: "warning",
          title: "Сул нууцлал илэрсэн",
          description: "Администратор нууцлалыг өөрчлөхийг зөвлөж байна",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 3,
          level: "info",
          title: "Системийн шинэчлэлт хийгдсэн",
          description: "Аюулгүй байдлын сүүлийн хэмжээсүүд автоматаар хэрэглэгдсэн",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch security alerts:", error);
    }
  };

  const handleSecurityScan = async () => {
    setScanning(true);
    try {
      // Simulated scan
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setScanResults({
        status: "completed",
        threats: 0,
        warnings: 2,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Security scan failed:", error);
    } finally {
      setScanning(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500/15 text-red-300 border-red-500/25";
      case "warning":
        return "bg-amber-500/15 text-amber-300 border-amber-500/25";
      case "info":
        return "bg-blue-500/15 text-blue-300 border-blue-500/25";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/25";
    }
  };

  const getStatusIcon = (level: string) => {
    switch (level) {
      case "critical":
        return <AlertCircle size={20} className="text-red-400" />;
      case "warning":
        return <AlertCircle size={20} className="text-amber-400" />;
      case "info":
        return <CheckCircle2 size={20} className="text-blue-400" />;
      default:
        return <Shield size={20} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Scan */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-500/20 text-blue-300">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Системийн Сканнер</h2>
              <p className="text-sm text-slate-400">Аюулгүй байдлын сүүлийн шалгалт</p>
            </div>
          </div>
        </div>

        {scanResults ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-green-500/25 bg-green-500/10 p-4 text-center">
                <p className="text-2xl font-black text-green-300">{scanResults.threats}</p>
                <p className="text-xs text-green-300/70">Найдвартай</p>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-center">
                <p className="text-2xl font-black text-amber-300">{scanResults.warnings}</p>
                <p className="text-xs text-amber-300/70">Анхаруулалт</p>
              </div>
              <div className="rounded-lg border border-slate-500/25 bg-slate-500/10 p-4 text-center">
                <p className="text-2xl font-black text-slate-300">
                  {new Date(scanResults.timestamp).toLocaleTimeString("mn-MN")}
                </p>
                <p className="text-xs text-slate-300/70">Сүүлийн сканнер</p>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSecurityScan}
            disabled={scanning}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {scanning ? "Сканнер ажиллаж байна..." : "Сканнер эхлүүлэх"}
          </button>
        )}
      </section>

      {/* Security Alerts */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-white">
          <AlertCircle size={22} className="text-slate-300" />
          Аюулгүй байдлын Сэнс
        </h2>

        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border px-4 py-3 ${getLevelColor(alert.level)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(alert.level)}
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{alert.title}</p>
                  <p className="text-sm opacity-90">{alert.description}</p>
                  <p className="text-xs mt-1 opacity-75">
                    {new Date(alert.timestamp).toLocaleString("mn-MN")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* API Keys Management */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-white">
          <Lock size={22} className="text-slate-300" />
          API Түлхүүр Удирдлага
        </h2>

        <div className="space-y-3">
          {[
            { name: "Admin API Key", created: "2 сарын өмнө", lastUsed: "5 минутын өмнө" },
            { name: "Payment Service Key", created: "1 сарын өмнө", lastUsed: "1 цагийн өмнө" },
            { name: "Email Service Key", created: "3 сарын өмнө", lastUsed: "10 минутын өмнө" },
          ].map((key, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold text-white">{key.name}</p>
                <p className="text-xs text-slate-400">
                  Үүссэн: {key.created} · Сүүлд ашигласан: {key.lastUsed}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20">
                  🔄
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

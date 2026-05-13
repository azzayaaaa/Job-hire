"use client";

import React, { useEffect, useState } from "react";
import { FileText, Download, Trash2, Filter, Search } from "lucide-react";

interface SystemLog {
  id: number;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  timestamp: string;
  source: string;
}

export function LogsView() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, filterLevel, searchTerm]);

  const fetchLogs = async () => {
    try {
      // Simulated logs - replace with actual API
      const newLogs: SystemLog[] = [
        {
          id: 1,
          level: "error",
          message: "Database connection timeout",
          timestamp: new Date().toISOString(),
          source: "DatabaseService",
        },
        {
          id: 2,
          level: "warning",
          message: "High memory usage detected (85%)",
          timestamp: new Date(Date.now() - 60000).toISOString(),
          source: "SystemMonitor",
        },
        {
          id: 3,
          level: "info",
          message: "User registration completed",
          timestamp: new Date(Date.now() - 120000).toISOString(),
          source: "AuthService",
        },
        {
          id: 4,
          level: "debug",
          message: "Cache invalidated for user 123",
          timestamp: new Date(Date.now() - 180000).toISOString(),
          source: "CacheService",
        },
      ];
      setLogs(newLogs);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (filterLevel) {
      filtered = filtered.filter((log) => log.level === filterLevel);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(q) ||
          log.source.toLowerCase().includes(q)
      );
    }

    setFilteredLogs(filtered);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/15 text-red-300 border-red-500/25";
      case "warning":
        return "bg-amber-500/15 text-amber-300 border-amber-500/25";
      case "info":
        return "bg-blue-500/15 text-blue-300 border-blue-500/25";
      case "debug":
        return "bg-purple-500/15 text-purple-300 border-purple-500/25";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/25";
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const logContent = filteredLogs
        .map(
          (log) =>
            `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
        )
        .join("\n");

      const element = document.createElement("a");
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(logContent));
      element.setAttribute("download", `system-logs-${new Date().toISOString().split("T")[0]}.txt`);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error("Failed to download logs:", error);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Бүх логуудыг устгаж хайрцагтай болгох уу?")) return;
    try {
      setLogs([]);
      setFilteredLogs([]);
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_150px_150px_150px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Логийн текст хайх..."
              className="h-12 w-full rounded-xl border border-white/10 bg-[#07101d] pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-red-500/50"
            />
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-[#07101d] px-4 text-sm font-bold text-slate-300"
          >
            <option value="">Бүх түвшин</option>
            <option value="error">Алдаа</option>
            <option value="warning">Анхаруулалт</option>
            <option value="info">Мэдээлэл</option>
            <option value="debug">Debug</option>
          </select>

          <button
            onClick={handleDownloadLogs}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300 hover:bg-white/[0.08]"
          >
            <Download size={16} />
            Татах
          </button>

          <button
            onClick={handleClearLogs}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-black text-red-300 hover:bg-red-500/20"
          >
            <Trash2 size={16} />
            Цэвэрлэх
          </button>
        </div>
      </section>

      {/* Logs Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424]/85">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-4">Цаг</th>
                <th className="px-6 py-4">Түвшин</th>
                <th className="px-6 py-4">Эх</th>
                <th className="px-6 py-4">Мессеж</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Логуудыг ачаалж байна...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.025]">
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {new Date(log.timestamp).toLocaleTimeString("mn-MN")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{log.source}</td>
                    <td className="px-6 py-4 text-slate-300">{log.message}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Логууд олдсонгүй
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Нийт логуудын тоо", value: logs.length, color: "#3B82F6" },
          {
            label: "Алдаа",
            value: logs.filter((l) => l.level === "error").length,
            color: "#EF4444",
          },
          {
            label: "Анхаруулалт",
            value: logs.filter((l) => l.level === "warning").length,
            color: "#F59E0B",
          },
          {
            label: "Мэдээлэл",
            value: logs.filter((l) => l.level === "info").length,
            color: "#22C55E",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
            <div
              className="mt-3 h-1 rounded-full"
              style={{ backgroundColor: stat.color, width: "30%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

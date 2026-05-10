"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  ChevronDown,
  Cpu,
  Database,
  Download,
  Edit2,
  FileText,
  Gauge,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { io } from "socket.io-client";
import DashboardLayout from "../DashboardLayout";
import {
  authenticatedDelete,
  authenticatedFetch,
  authenticatedPost,
} from "@/lib/axiosClient";

type AdminView = "dashboard" | "users";

type AdminUser = {
  id: number;
  email: string;
  userType: string;
  credits?: number;
  fullName?: string | null;
  company?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const navItems = [
  { key: "dashboard", label: "Систем төлөв", Icon: LayoutDashboard },
  { key: "users", label: "Odoo хэрэглэгчид", Icon: Users },
  { key: "users", label: "Хэрэглэгчид", Icon: Users },
  { key: "security", label: "Аюулгүй байдал", Icon: Shield },
  { key: "logs", label: "Системийн лог", Icon: FileText },
  { key: "settings", label: "Тохиргоо", Icon: Settings },
];

const quickActions = [
  { label: "Лог файл татах", Icon: Download },
  { label: "Database Backup", Icon: Database },
  { label: "System Scan", Icon: Search },
];

const activityLogs = [
  { tone: "green", msg: "Admin login successful", ip: "192.168.1.1", time: "2 минутын өмнө" },
  { tone: "blue", msg: "User registration attempted", ip: "103.21.164.2", time: "15 минутын өмнө" },
  { tone: "amber", msg: "Credit update performed", ip: "192.168.1.1", time: "1 цагийн өмнө" },
  { tone: "purple", msg: "Role permission changed", ip: "172.16.0.5", time: "2 цагийн өмнө" },
  { tone: "red", msg: "Failed login attempt", ip: "45.33.32.156", time: "3 цагийн өмнө" },
];

const toneClasses: Record<string, string> = {
  green: "bg-emerald-500 shadow-emerald-500/30",
  blue: "bg-blue-500 shadow-blue-500/30",
  amber: "bg-amber-500 shadow-amber-500/30",
  purple: "bg-purple-500 shadow-purple-500/30",
  red: "bg-red-500 shadow-red-500/30",
};

function roleClass(role?: string) {
  switch (role) {
    case "ADMIN":
      return "bg-red-500/15 text-red-300 border-red-500/25";
    case "EMPLOYER":
      return "bg-blue-500/15 text-blue-300 border-blue-500/25";
    case "CANDIDATE":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/25";
  }
}

function userInitial(user: AdminUser) {
  return (user.fullName?.[0] || user.email?.[0] || "U").toUpperCase();
}

function userName(user: AdminUser) {
  return user.fullName || user.email?.split("@")[0] || "Unknown user";
}

function relativeUserTime(user: AdminUser, index: number) {
  if (!user.updatedAt && !user.createdAt) {
    const fallback = ["2 минутын өмнө", "15 минутын өмнө", "1 цагийн өмнө", "2 цагийн өмнө"];
    return fallback[index % fallback.length];
  }

  const raw = user.updatedAt || user.createdAt;
  const ms = raw ? Date.now() - new Date(raw).getTime() : 0;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  return `${Math.floor(hours / 24)} өдрийн өмнө`;
}

function SparkLine({ color = "#3B82F6" }: { color?: string }) {
  const gradientId = `g-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox="0 0 170 62" className="h-14 w-28 shrink-0 opacity-95">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M3 50 L22 45 L38 31 L56 45 L74 38 L91 18 L110 27 L127 14 L148 22 L167 12 L167 62 L3 62 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M3 50 L22 45 L38 31 L56 45 L74 38 L91 18 L110 27 L127 14 L148 22 L167 12"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
}) {
  if (!open) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1424]/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-full"
            style={{ background: `${color}1f`, color }}
          >
            {icon}
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-black text-white">{value}</p>
            <p className="text-xs font-semibold text-slate-300">
              <span className="text-emerald-400">{sub.split(" ")[0]}</span>{" "}
              {sub.split(" ").slice(1).join(" ")}
            </p>
          </div>
        </div>
        <SparkLine color={accent} />
      </div>
    </div>
  );
}

function ResourceRow({
  icon,
  label,
  value,
  detailsLeft,
  detailsRight,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detailsLeft: string;
  detailsRight: string;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[44px_1fr] gap-4">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04]" style={{ color }}>
        {icon}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-white">{label}</span>
          <span className="text-sm font-black text-white">{value}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{detailsLeft}</span>
          <span>{detailsRight}</span>
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({
  view,
  onViewChange,
}: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
}) {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#050b14]/95 px-5 py-6 lg:flex lg:flex-col">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-red-500 text-red-400">
          <ShieldCheck size={30} />
        </div>
        <div>
          <p className="text-lg font-black text-white">ADMIN PANEL</p>
          <p className="text-sm text-slate-400">System Control</p>
        </div>
      </div>

      <nav className="mt-5 space-y-2">
        {navItems.map(({ key, label, Icon }, index) => {
          const active =
            (view === "dashboard" && key === "dashboard") ||
            (view === "users" && key === "users" && index === 1);

          return (
            <button
              key={`${key}-${label}`}
              onClick={() => {
                if (key === "dashboard" || key === "users") onViewChange(key);
              }}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-bold transition-all ${
                active
                  ? "border-red-500/60 bg-red-600/25 text-white shadow-[0_0_34px_rgba(220,38,38,0.18)]"
                  : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-white/10 pt-6">
        <p className="mb-4 px-3 text-xs font-black uppercase tracking-widest text-slate-600">
          Шуурхай үйлдэл
        </p>
        <div className="space-y-2">
          {quickActions.map(({ label, Icon }) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <button className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-red-500/25 text-lg font-black text-red-200">
          A
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">Admin User</p>
          <p className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            ONLINE
          </p>
        </div>
        <ChevronDown size={18} className="text-slate-400" />
      </button>
    </aside>
  );
}

function AdminMobileDrawer({
  view,
  onViewChange,
  open,
  onClose,
}: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close admin menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside className="relative z-10 flex h-full w-[min(86vw,340px)] flex-col border-r border-white/10 bg-[#050b14] px-5 py-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-base font-black text-white">ADMIN PANEL</p>
            <p className="text-xs text-slate-400">System Control</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      <div className="space-y-2">
        {[
          { key: "dashboard" as AdminView, label: "Самбар", Icon: LayoutDashboard },
          { key: "users" as AdminView, label: "Хэрэглэгч", Icon: Users },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onViewChange(key);
              onClose();
            }}
            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-bold transition ${
              view === key ? "text-red-300" : "text-slate-500 hover:text-white"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        {navItems.slice(2).map(({ key, label, Icon }) => (
          <button
            key={`${key}-${label}`}
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-4 py-3 text-left text-sm font-bold text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="mt-7 border-t border-white/10 pt-5">
        <p className="mb-3 px-3 text-xs font-black uppercase tracking-widest text-slate-600">
          Ð¨ÑƒÑƒÑ€Ñ…Ð°Ð¹ Ò¯Ð¹Ð»Ð´ÑÐ»
        </p>
        <div className="space-y-2">
          {quickActions.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
      </div>
      </aside>
    </div>
  );
}

function AdminDashboardContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const refreshInFlightRef = useRef(false);

  const view: AdminView = searchParams.get("tab") === "users" ? "users" : "dashboard";

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        authenticatedFetch("http://localhost:5001/api/auth/admin/stats"),
        authenticatedFetch("http://localhost:5001/api/auth/admin/users"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated") {
      const s = session as any;
      const isAdmin =
        s?.user?.userType === "ADMIN" || s?.user?.email === "azzayabayartai07@gmail.com";
      const token = s?.user?.accessToken || s?.accessToken;

      if (isAdmin && token) fetchData();
      else setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const s = session as any;
    const isAdminNow =
      !!s?.user &&
      (s.user.userType === "ADMIN" || s.user.email === "azzayabayartai07@gmail.com");
    const token = s?.user?.accessToken || s?.accessToken;
    if (!isAdminNow || !token) return;

    const id = window.setInterval(() => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      fetchData(true).finally(() => {
        refreshInFlightRef.current = false;
      });
    }, 3000);

    return () => window.clearInterval(id);
  }, [status, session]);

  useEffect(() => {
    const s = session as any;
    const isAdmin =
      s?.user?.userType === "ADMIN" || s?.user?.email === "azzayabayartai07@gmail.com";
    if (!isAdmin) return;

    const socket = io("http://localhost:5001");
    socket.on("connect", () => socket.emit("join-admin"));
    socket.on("admin-data-updated", () => fetchData(true));
    return () => {
      socket.disconnect();
    };
  }, [session]);

  const handleViewChange = (nextView: AdminView) => {
    router.push(`/dashboard/admin${nextView === "users" ? "?tab=users" : ""}`);
  };

  const handleUpdateCredits = async (userId: number, currentCredits = 0) => {
    const newCredits = prompt("Шинэ кредит оруулна уу:", String(currentCredits));
    if (newCredits === null) return;

    try {
      await authenticatedPost("http://localhost:5001/api/auth/admin/update-credits", {
        userId,
        credits: parseInt(newCredits, 10),
      });
      await fetchData();
    } catch {
      alert("Кредит шинэчлэхэд алдаа гарлаа");
    }
  };

  const handleUpdateRole = async (userId: number, currentRole: string) => {
    const newRole = prompt("Шинэ эрх оруулна уу (ADMIN, EMPLOYER, CANDIDATE):", currentRole);
    if (!newRole || newRole === currentRole) return;

    try {
      await authenticatedPost("http://localhost:5001/api/auth/admin/update-role", {
        userId,
        userType: newRole.toUpperCase(),
      });
      await fetchData();
    } catch {
      alert("Эрх шинэчлэхэд алдаа гарлаа");
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!confirm(`${email} хэрэглэгчийг устгах уу?`)) return;

    try {
      await authenticatedDelete(`http://localhost:5001/api/auth/admin/users/${userId}`);
      await fetchData();
    } catch {
      alert("Устгахад алдаа гарлаа");
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const q = searchTerm.toLowerCase();
        return (
          user.email?.toLowerCase().includes(q) ||
          user.fullName?.toLowerCase().includes(q) ||
          user.userType?.toLowerCase().includes(q)
        );
      }),
    [users, searchTerm],
  );

  const activeUsers = users.filter((user) => user.userType !== "INACTIVE").length;
  const adminUsers = users.filter((user) => user.userType === "ADMIN").length;
  const totalCredits = users.reduce((sum, user) => sum + Number(user.credits || 0), 0);
  const recentUsers = users.slice(0, 4);

  if (status === "loading" || loading) {
    return (
      <div className="grid h-screen place-items-center bg-[#050b14]">
        <Loader2 className="animate-spin text-red-500" size={34} />
      </div>
    );
  }

  const isAdmin =
    session?.user &&
    ((session.user as any).userType === "ADMIN" ||
      session.user.email === "azzayabayartai07@gmail.com");

  if (!isAdmin && status === "authenticated") return notFound();

  return (
    <DashboardLayout role="admin">
      <div className="flex h-screen overflow-hidden bg-[#020713] text-white">
        <AdminSidebar view={view} onViewChange={handleViewChange} />
        <AdminMobileDrawer
          view={view}
          onViewChange={handleViewChange}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.14),transparent_34%),linear-gradient(180deg,#07101f_0%,#030813_100%)]">
          <div className="mx-auto max-w-[1500px] px-3 py-4 pb-6 sm:px-4 md:px-8 md:py-7">
            <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  System Administrator
                </div>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl md:text-5xl">
                  {view === "dashboard" ? "Систем Удирдлага" : "Odoo хэрэглэгчид"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-400 md:text-base">
                  {view === "dashboard"
                    ? "Системийн нөөц ашиглалт болон аюулгүй байдлын төлөвийг хянах самбар"
                    : "Odoo системд бүртгэлтэй бүх хэрэглэгчдийн жагсаалт, эрх, төлөв байдлыг удирдана."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] lg:hidden"
                  aria-label="Admin menu"
                >
                  <Menu size={20} />
                </button>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/15">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-sm font-bold">System Stable</span>
                </div>
                <button className="relative grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-red-300">
                  <Bell size={20} />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-black">
                    3
                  </span>
                </button>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-bold sm:px-5 sm:text-sm">
                  <p>{now.toLocaleDateString("mn-MN")}</p>
                  <p>{now.toLocaleTimeString("mn-MN")}</p>
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap justify-start gap-3 sm:justify-end">
              <button
                onClick={() => fetchData(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-slate-200 hover:border-white/20 hover:bg-white/[0.08]"
              >
                <RefreshCcw size={17} />
                Өгөгдөл шинэчлэх
              </button>
              <button
                onClick={() => handleViewChange(view === "dashboard" ? "users" : "dashboard")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(220,38,38,0.25)] hover:bg-red-500"
              >
                <Users size={17} />
                {view === "dashboard" ? "Хэрэглэгчид үзэх" : "Систем төлөв"}
              </button>
              {view === "users" && (
                <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-slate-200 hover:border-white/20">
                  <Download size={17} />
                  Экспорт
                </button>
              )}
            </div>

            {view === "dashboard" ? (
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-3">
                  <MetricCard
                    label="Нийт хэрэглэгчид"
                    value={stats?.totalUsers || users.length || 0}
                    sub="+12% энэ сарын өсөлт"
                    icon={<Users size={28} />}
                    color="#3B82F6"
                    accent="#3B82F6"
                  />
                  <MetricCard
                    label="Идэвхтэй зар"
                    value={stats?.activeJobs || 0}
                    sub="+8% энэ сарын өсөлт"
                    icon={<Briefcase size={28} />}
                    color="#22C55E"
                    accent="#22C55E"
                  />
                  <MetricCard
                    label="Нийт ашигласан кредит"
                    value={totalCredits.toLocaleString("mn-MN")}
                    sub="+23% энэ сарын өсөлт"
                    icon={<Activity size={28} />}
                    color="#F59E0B"
                    accent="#F59E0B"
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.1fr_0.62fr_0.76fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
                    <h2 className="mb-7 flex items-center gap-3 text-lg font-black uppercase">
                      <Cpu size={22} className="text-slate-300" />
                      Системийн нөөц ашиглалт
                    </h2>
                    <div className="space-y-7">
                      <ResourceRow
                        icon={<Cpu size={20} />}
                        label="CPU Usage"
                        value={32}
                        detailsLeft="4 cores / 12 threads"
                        detailsRight="2.1 GHz / 6.6 GHz"
                        color="#EF4444"
                      />
                      <ResourceRow
                        icon={<HardDrive size={20} />}
                        label="RAM Usage"
                        value={58}
                        detailsLeft="9.3 GB / 16 GB"
                        detailsRight="DDR4 3200MHz"
                        color="#22C55E"
                      />
                      <ResourceRow
                        icon={<Database size={20} />}
                        label="Disk Storage"
                        value={45}
                        detailsLeft="225 GB / 500 GB"
                        detailsRight="SSD NVMe"
                        color="#3B82F6"
                      />
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {[
                        ["42°C", "CPU Temp", "#EF4444", <Gauge key="g" size={18} />],
                        ["99.9%", "Uptime", "#22C55E", <Zap key="z" size={18} />],
                        ["1.2 Gbps", "Network", "#F59E0B", <Activity key="a" size={18} />],
                        ["Healthy", "Database", "#3B82F6", <Database key="d" size={18} />],
                      ].map(([value, label, color, icon]) => (
                        <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                          <div className="mb-1 flex justify-center" style={{ color: String(color) }}>
                            {icon as React.ReactNode}
                          </div>
                          <p className="text-lg font-black text-white">{value as string}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{label as string}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6 text-center">
                    <h2 className="mb-5 flex items-center gap-3 text-left text-lg font-black uppercase">
                      <Shield size={22} className="text-slate-300" />
                      Аюулгүй байдлын шалгалт
                    </h2>
                    <div className="mx-auto grid h-36 w-36 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.18)]">
                      <div className="grid h-24 w-24 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/20">
                        <ShieldCheck size={56} className="text-emerald-300" />
                      </div>
                    </div>
                    <h3 className="mt-5 text-xl font-black">Бүх систем хэвийн байна</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Сүүлийн шалгалт: 12 минутын өмнө. Алдаа олдсонгүй
                    </p>
                    <button className="mt-7 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/[0.08]">
                      Scan Database
                    </button>
                  </section>

                  <div className="space-y-4">
                    <section className="relative overflow-hidden rounded-2xl border border-red-500/50 bg-red-950/45 p-6">
                      <div className="relative z-10 max-w-full sm:max-w-[70%]">
                        <h2 className="mb-4 flex items-center gap-3 text-lg font-black uppercase">
                          <ShieldCheck size={22} className="text-red-300" />
                          Аюулгүй байдал
                        </h2>
                        <p className="text-sm leading-6 text-red-100/80">
                          Системийн бүх логгуудыг шалгаж, сэжигтэй үйлдлүүдийг хянах боломжтой.
                        </p>
                        <button className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-black text-red-600">
                          <Download size={17} />
                          Лог файл татах
                        </button>
                      </div>
                      <Lock className="absolute bottom-0 right-2 h-28 w-28 text-red-900/45 sm:right-7 sm:h-44 sm:w-44 sm:text-red-900/70" />
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase">Шуурхай үйл ажиллагаа</h2>
                        <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                          Дэлгэрэнгүй
                        </button>
                      </div>
                      {[
                        ["Шинэ хэрэглэгч бүртгүүлсэн", "24", "up", "blue"],
                        ["Кредит шинэчлэгдсэн", "7", "up", "amber"],
                        ["Нэвтрэх оролдлого", "3", "down", "red"],
                      ].map(([label, count, trend, tone]) => (
                        <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                          <div className="flex items-center gap-3 text-slate-400">
                            <span className={`h-3 w-3 rounded-full ${toneClasses[tone]}`} />
                            {label}
                          </div>
                          <span className="font-black text-white">
                            {count} <span className={trend === "up" ? "text-emerald-400" : "text-red-400"}>{trend === "up" ? "↑" : "↓"}</span>
                          </span>
                        </div>
                      ))}
                    </section>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
                    <h2 className="mb-5 text-lg font-black uppercase">Аюулгүй байдлын лог</h2>
                    <div className="space-y-1">
                      {activityLogs.map((log) => (
                        <div key={`${log.msg}-${log.time}`} className="grid gap-2 border-b border-white/5 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_120px_120px] sm:items-center sm:gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`h-3 w-3 rounded-full shadow-lg ${toneClasses[log.tone]}`} />
                            <span className="font-bold text-white">{log.msg}</span>
                          </div>
                          <span className="pl-6 text-xs text-slate-400 sm:pl-0 sm:text-sm">{log.ip}</span>
                          <span className="pl-6 text-xs text-slate-400 sm:pl-0 sm:text-right sm:text-sm">{log.time}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
                    <h2 className="mb-5 text-lg font-black uppercase">Сүүлийн хэрэглэгчид</h2>
                    <div className="space-y-1">
                      {(recentUsers.length ? recentUsers : users).slice(0, 4).map((user, index) => (
                        <div key={user.id} className="grid gap-2 border-b border-white/5 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_100px_90px_120px] sm:items-center sm:gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-black">
                              {userInitial(user)}
                            </div>
                            <span className="truncate font-semibold text-white">{user.email}</span>
                          </div>
                          <span className={`w-max rounded-md border px-2 py-1 text-[10px] font-black ${roleClass(user.userType)}`}>
                            {user.userType}
                          </span>
                          <span className="font-black text-white">{Number(user.credits || 0).toLocaleString("mn-MN")} <span className="text-amber-400">★</span></span>
                          <span className="text-right text-slate-400">{relativeUserTime(user, index)}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleViewChange("users")}
                      className="mt-5 w-full rounded-lg border border-white/10 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.05]"
                    >
                      Бүгдийг харах →
                    </button>
                  </section>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-4">
                  <MetricCard
                    label="Нийт хэрэглэгчид"
                    value={users.length || stats?.totalUsers || 0}
                    sub="+12% энэ сартай харьцуулахад"
                    icon={<Users size={28} />}
                    color="#3B82F6"
                    accent="#3B82F6"
                  />
                  <MetricCard
                    label="Идэвхтэй хэрэглэгч"
                    value={activeUsers}
                    sub="72% нийтээс"
                    icon={<Briefcase size={28} />}
                    color="#22C55E"
                    accent="#22C55E"
                  />
                  <MetricCard
                    label="Идэвхгүй хэрэглэгч"
                    value={Math.max(users.length - activeUsers, 0)}
                    sub="28% нийтээс"
                    icon={<Activity size={28} />}
                    color="#F59E0B"
                    accent="#F59E0B"
                  />
                  <MetricCard
                    label="Админ хэрэглэгч"
                    value={adminUsers}
                    sub="6% нийтээс"
                    icon={<Users size={28} />}
                    color="#EF4444"
                    accent="#EF4444"
                  />
                </div>

                <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-4">
                  <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_180px_180px]">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Хэрэглэгч хайх..."
                        className="h-12 w-full rounded-xl border border-white/10 bg-[#07101d] pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-red-500/50"
                      />
                    </div>
                    {["Бүх эрх", "Бүх төлөв", "Бүх компани"].map((label) => (
                      <button key={label} className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-[#07101d] px-4 text-sm font-bold text-slate-300">
                        {label}
                        <ChevronDown size={16} />
                      </button>
                    ))}
                    <button
                      onClick={() => setSearchTerm("")}
                      className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300 hover:bg-white/[0.07]"
                    >
                      Шүүлтүүр цэвэрлэх
                    </button>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424]/85">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="w-16 px-6 py-5">
                            <span className="block h-5 w-5 rounded border border-slate-600" />
                          </th>
                          <th className="px-6 py-5">Хэрэглэгч</th>
                          <th className="px-6 py-5">Имэйл</th>
                          <th className="px-6 py-5">Эрх</th>
                          <th className="px-6 py-5">Компани</th>
                          <th className="px-6 py-5">Төлөв</th>
                          <th className="px-6 py-5">Сүүлд ашигласан</th>
                          <th className="px-6 py-5 text-right">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredUsers.map((user, index) => (
                          <tr key={user.id} className="hover:bg-white/[0.025]">
                            <td className="px-6 py-4">
                              <span className="block h-5 w-5 rounded border border-slate-600" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-black">
                                  {userInitial(user)}
                                </div>
                                <div>
                                  <p className="font-black text-white">{userName(user)}</p>
                                  <p className="text-xs text-slate-400">(ID: {user.id})</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{user.email}</td>
                            <td className="px-6 py-4">
                              <span className={`rounded-md border px-3 py-1.5 text-[10px] font-black ${roleClass(user.userType)}`}>
                                {user.userType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{user.company || "My Company"}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2 text-slate-200">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                Идэвхтэй
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">{relativeUserTime(user, index)}</td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleUpdateRole(user.id, user.userType)}
                                  className="grid h-10 w-10 place-items-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                                  title="Эрх засах"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleUpdateCredits(user.id, user.credits)}
                                  className="grid h-10 w-10 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                  title="Кредит засах"
                                >
                                  <KeyRound size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  className="grid h-10 w-10 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                  title="Устгах"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
                    <span>Нийт {filteredUsers.length} хэрэглэгчээс 1-8 харуулж байна</span>
                    <div className="flex items-center gap-2">
                      {["‹", "1", "2", "3", "...", "11", "›"].map((item) => (
                        <button
                          key={item}
                          className={`h-9 min-w-9 rounded-lg border px-3 font-bold ${
                            item === "1"
                              ? "border-red-500 bg-red-500/20 text-red-200"
                              : "border-white/10 text-slate-400 hover:bg-white/[0.05]"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center bg-[#050b14]">
          <Loader2 className="animate-spin text-red-500" />
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

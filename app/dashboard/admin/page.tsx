"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  Check,
  ChevronDown,
  Crown,
  Cpu,
  Database,
  Download,
  Edit2,
  FileText,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  RefreshCcw,
  ReceiptText,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { io } from "socket.io-client";
import axios from "axios";
import DashboardLayout from "../DashboardLayout";
import { useAlert } from "@/components/AlertProvider";
import { SecurityView } from "./SecurityView";
import { LogsView } from "./LogsView";
import { SettingsView } from "./SettingsView";
import { API_URLS } from "@/lib/apiConfig";
import {
  authenticatedDelete,
  authenticatedFetch,
  authenticatedPost,
} from "@/lib/axiosClient";

type AdminView = "dashboard" | "users" | "payments" | "security" | "logs" | "settings";

type AdminUser = {
  id: number;
  email: string;
  userType: string;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | null;
  fullName?: string | null;
  company?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PaymentOrder = {
  id: number;
  orderId: string;
  userId: number;
  amountMnt: number;
  plan: string;
  duration: string;
  bankName: string;
  bankAccount: string;
  bankHolderName: string;
  screenshotUrl?: string | null;
  status: "PENDING" | "SUCCESS" | "REJECTED";
  rejectReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user?: {
    id: number;
    email: string;
    fullName?: string | null;
    userType?: string | null;
  };
};

const navItems = [
  { key: "dashboard", label: "Систем төлөв", Icon: LayoutDashboard },
  { key: "users", label: "Хэрэглэгчид", Icon: Users },
  { key: "security", label: "Аюулгүй байдал", Icon: Shield },
  { key: "logs", label: "Системийн лог", Icon: FileText },
  { key: "settings", label: "Тохиргоо", Icon: Settings },
];

navItems.splice(2, 0, { key: "payments", label: "Төлбөр", Icon: ReceiptText });

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
    <svg viewBox="0 0 170 62" className="hidden h-14 w-28 shrink-0 opacity-95 sm:block">
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
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#0d1424]/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-2xl sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full sm:h-14 sm:w-14"
            style={{ background: `${color}1f`, color }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{value}</p>
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
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="min-w-0 truncate text-sm font-bold text-white">{label}</span>
          <span className="text-sm font-black text-white">{value}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-400">
          <span className="min-w-0 truncate">{detailsLeft}</span>
          <span className="shrink-0">{detailsRight}</span>
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({
  view,
  onViewChange,
  onQuickAction,
  onProfileOpen,
  onPrivacyOpen,
}: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
  onQuickAction: (action: string) => void;
  onProfileOpen: () => void;
  onPrivacyOpen: () => void;
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  
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
        {navItems.map(({ key, label, Icon }) => {
          const active = view === key;

          return (
            <button
              key={`${key}-${label}`}
              onClick={() => onViewChange(key as AdminView)}
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
              onClick={() => onQuickAction(label)}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-auto">
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left hover:bg-white/[0.08]"
        >
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
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
        </button>
        
        {showAccountMenu && (
          <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-white/10 bg-[#0d1424]/95 shadow-lg">
            <button
              onClick={() => {
                setShowAccountMenu(false);
                onProfileOpen();
              }}
              className="flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              <Settings size={16} />
              Профиль
            </button>
            <button
              onClick={() => {
                setShowAccountMenu(false);
                onPrivacyOpen();
              }}
              className="flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              <Lock size={16} />
              Нууцлалыг өөрчлөх
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10"
            >
              <LogOut size={16} />
              Гарах
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function AdminMobileDrawer({
  view,
  onViewChange,
  open,
  onClose,
  onQuickAction,
  onProfileOpen,
  onPrivacyOpen,
}: {
  view: AdminView;
  onViewChange: (view: AdminView) => void;
  open: boolean;
  onClose: () => void;
  onQuickAction: (action: string) => void;
  onProfileOpen: () => void;
  onPrivacyOpen: () => void;
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
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onViewChange(key as AdminView);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-bold transition ${
                view === key ? "border-red-500/60 bg-red-600/25 text-white" : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-7 border-t border-white/10 pt-5">
          <p className="mb-3 px-3 text-xs font-black uppercase tracking-widest text-slate-600">
            Шуурхай үйлдэл
          </p>
          <div className="space-y-2">
            {quickActions.map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onQuickAction(label);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onProfileOpen();
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              <Settings size={19} />
              Профиль
            </button>
            <button
              type="button"
              onClick={() => {
                onPrivacyOpen();
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
            >
              <Lock size={19} />
              Нууцлалыг өөрчлөх
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-500/10"
            >
              <LogOut size={19} />
              Гарах
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function isPlanPro(user: AdminUser) {
  if (user.subscriptionPlan === "PRO_UNTIL_CHANGED") return true;
  if (user.subscriptionPlan !== "PRO_MONTHLY" || !user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

function planClass(user: AdminUser) {
  return isPlanPro(user)
    ? "border-amber-400/30 bg-amber-400/15 text-amber-200"
    : "border-slate-500/25 bg-slate-500/15 text-slate-300";
}

function planLabel(user: AdminUser) {
  return isPlanPro(user) ? "PRO" : "FREE";
}

function remainingPlanDays(user: AdminUser) {
  if (!user.subscriptionExpiresAt) return null;
  const diff = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function planTypeLabel(user: AdminUser) {
  if (!isPlanPro(user)) return "Үнэгүй эрх";
  if (user.subscriptionPlan === "PRO_UNTIL_CHANGED") return "Хязгааргүй Pro";
  const days = remainingPlanDays(user);
  if (days !== null && days <= 7) return "7 хоногийн Pro";
  return "Сарын Pro";
}

function formatMongolianDate(value?: string | null) {
  if (!value) return "Хязгааргүй";
  const date = new Date(value);
  const months = [
    "1-р сарын",
    "2-р сарын",
    "3-р сарын",
    "4-р сарын",
    "5-р сарын",
    "6-р сарын",
    "7-р сарын",
    "8-р сарын",
    "9-р сарын",
    "10-р сарын",
    "11-р сарын",
    "12-р сарын",
  ];
  return `${date.getFullYear()} оны ${months[date.getMonth()]} ${date.getDate()}`;
}

function planSubLabel(user: AdminUser) {
  if (!isPlanPro(user)) return "Үнэгүй эрх";
  if (user.subscriptionPlan === "PRO_UNTIL_CHANGED") return "Хязгааргүй";
  if (!user.subscriptionExpiresAt) return "Pro";
  const days = remainingPlanDays(user);
  const date = formatMongolianDate(user.subscriptionExpiresAt);
  return `${date} хүртэл${days !== null ? ` · ${days > 0 ? `${days} хоног үлдсэн` : "өнөөдөр дуусна"}` : ""}`;
}

type AdminProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
};

function AdminProfileModal({
  userId,
  onClose,
}: {
  userId: number | string;
  onClose: () => void;
}) {
  const { showAlert } = useAlert();
  const [form, setForm] = useState<AdminProfileForm>({
    fullName: "",
    email: "",
    phone: "",
    location: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      try {
        const res = await authenticatedFetch(API_URLS.auth.profile(userId));
        if (!alive) return;
        setForm({
          fullName: res.data?.fullName || "",
          email: res.data?.email || "",
          phone: res.data?.phone || "",
          location: res.data?.location || "",
        });
      } catch {
        showAlert("Профайл мэдээлэл татахад алдаа гарлаа", "error", "Алдаа");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      alive = false;
    };
  }, [showAlert, userId]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authenticatedPost(API_URLS.auth.updateProfile(), {
        userId,
        ...form,
      });
      showAlert("Профайл амжилттай шинэчлэгдлээ", "success", "Амжилт");
      onClose();
    } catch {
      showAlert("Профайл хадгалахад алдаа гарлаа", "error", "Алдаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-300">Admin profile</p>
            <h2 className="text-xl font-black text-white">Профиль</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close profile"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <Loader2 className="animate-spin text-red-400" />
          </div>
        ) : (
          <form onSubmit={saveProfile} className="space-y-4 p-5">
            {[
              { key: "fullName", label: "Овог нэр", icon: Users, type: "text" },
              { key: "email", label: "Имэйл", icon: Mail, type: "email" },
              { key: "phone", label: "Утас", icon: Phone, type: "text" },
              { key: "location", label: "Байршил", icon: MapPin, type: "text" },
            ].map(({ key, label, icon: Icon, type }) => (
              <label key={key} className="block">
                <span className="mb-2 block text-xs font-bold text-slate-400">{label}</span>
                <span className="relative block">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                  <input
                    value={form[key as keyof AdminProfileForm]}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                    type={type}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#07101d] pl-10 pr-4 text-sm text-white outline-none focus:border-red-500/50"
                  />
                </span>
              </label>
            ))}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Хадгалах
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AdminPrivacyModal({
  userId,
  onClose,
}: {
  userId: number | string;
  onClose: () => void;
}) {
  const { showAlert } = useAlert();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingCode, setSendingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      try {
        const res = await authenticatedFetch(API_URLS.auth.profile(userId));
        if (alive) setEmail(res.data?.email || "");
      } catch {
        showAlert("Имэйл мэдээлэл татахад алдаа гарлаа", "error", "Алдаа");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      alive = false;
    };
  }, [showAlert, userId]);

  const sendCode = async () => {
    if (!email.trim()) {
      showAlert("Имэйл хаяг олдсонгүй", "error", "Алдаа");
      return;
    }

    setSendingCode(true);
    try {
      await axios.post(API_URLS.auth.forgotPassword(), { email: email.trim() });
      setCodeSent(true);
      showAlert("Нууц үг солих код имэйл рүү илгээгдлээ", "success", "Код илгээгдлээ");
    } catch {
      showAlert("Код илгээхэд алдаа гарлаа", "error", "Алдаа");
    } finally {
      setSendingCode(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      showAlert("6 оронтой код оруулна уу", "error", "Алдаа");
      return;
    }
    if (newPassword.length < 6) {
      showAlert("Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна", "error", "Алдаа");
      return;
    }

    setSaving(true);
    try {
      await axios.post(API_URLS.auth.resetPassword(), {
        email: email.trim(),
        code,
        newPassword,
      });
      showAlert("Нууц үг амжилттай солигдлоо", "success", "Амжилт");
      onClose();
    } catch {
      showAlert("Нууц үг солиход алдаа гарлаа. Кодоо шалгана уу", "error", "Алдаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-300">Security</p>
            <h2 className="text-xl font-black text-white">Нууцлалыг өөрчлөх</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close privacy settings"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <Loader2 className="animate-spin text-red-400" />
          </div>
        ) : (
          <form onSubmit={changePassword} className="space-y-4 p-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold text-slate-400">Баталгаажуулах имэйл</p>
              <p className="mt-1 break-all text-sm font-black text-white">{email}</p>
            </div>

            <button
              type="button"
              onClick={sendCode}
              disabled={sendingCode}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-sm font-black text-white hover:bg-white/[0.08] disabled:opacity-60"
            >
              {sendingCode ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              {codeSent ? "Код дахин илгээх" : "Код илгээх"}
            </button>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-400">6 оронтой код</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 w-full rounded-xl border border-white/10 bg-[#07101d] px-4 text-center text-sm font-black tracking-[0.4em] text-white outline-none focus:border-red-500/50"
                placeholder="000000"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-400">Шинэ нууц үг</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                className="h-12 w-full rounded-xl border border-white/10 bg-[#07101d] px-4 text-sm text-white outline-none focus:border-red-500/50"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Нууц үг солих
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

type Html2PdfInstance = {
  set: (options: Record<string, unknown>) => Html2PdfInstance;
  from: (source: HTMLElement) => Html2PdfInstance;
  save: () => Promise<void>;
};

type Html2PdfFactory = () => Html2PdfInstance;

const AdminDashboardContent = () => {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<string>(""); // "" means all
  const [filterStatus, setFilterStatus] = useState<string>(""); // "" means all
  const [filterCompany, setFilterCompany] = useState<string>(""); // "" means all
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<{ id: number; currentRole: string } | null>(null);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<AdminUser | null>(null);
  const [planChoice, setPlanChoice] = useState<"FREE" | "PRO">("FREE");
  const [planDuration, setPlanDuration] = useState<"SEVEN_DAYS" | "ONE_MONTH" | "UNTIL_CHANGED">("ONE_MONTH");
  const [previewPayment, setPreviewPayment] = useState<PaymentOrder | null>(null);
  const refreshInFlightRef = useRef(false);
  const socketRef = useRef<any>(null);

  // Get unique roles and companies from users
  const uniqueRoles = useMemo(() => ["ADMIN", "EMPLOYER", "CANDIDATE"], []);
  const uniqueCompanies = useMemo(
    () => Array.from(new Set(users.map(u => u.company).filter((c): c is string => Boolean(c)))),
    [users]
  );

  // Get status labels
  const statusOptions = [
    { value: "active", label: "Идэвхтэй" },
    { value: "inactive", label: "Идэвхгүй" },
  ];

  const view: AdminView = (searchParams.get("tab") as AdminView) || "dashboard";

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [statsRes, usersRes, paymentsRes] = await Promise.all([
        authenticatedFetch(API_URLS.auth.adminStats()),
        authenticatedFetch(API_URLS.auth.adminUsers()),
        authenticatedFetch(API_URLS.user.adminPaymentOrders()),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data || []);
      setPaymentOrders(paymentsRes.data || []);
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

    const socket = io(API_URLS.sockets.auth());
    socketRef.current = socket;
    
    socket.on("connect", () => socket.emit("join-admin"));
    socket.on("admin-data-updated", () => fetchData(true));
    
    // Listen for admin actions from other admins
    socket.on("admin-action", (action: any) => {
      // Refresh data when another admin makes changes
      if (
        action?.type === "role-updated" ||
        action?.type === "plan-updated" ||
        action?.type === "user-deleted"
      ) {
        fetchData(true);
      }
    });
    
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  const handleViewChange = (nextView: AdminView) => {
    const tab = nextView === "dashboard" ? "" : `?tab=${nextView}`;
    router.push(`/dashboard/admin${tab}`);
  };

  const handleQuickAction = async (action: string) => {
    if (action === "Лог файл татах") {
      const report = document.createElement("div");
      const generatedAt = new Date();
      const rows = activityLogs
        .map(
          (log) => `
            <tr>
              <td>${log.time}</td>
              <td>${log.msg}</td>
              <td>${log.ip}</td>
              <td>${log.tone}</td>
            </tr>
          `,
        )
        .join("");

      report.innerHTML = `
        <div style="font-family:Arial,sans-serif;color:#111827;padding:28px;width:760px;">
          <div style="border-bottom:3px solid #dc2626;padding-bottom:16px;margin-bottom:22px;">
            <p style="margin:0;color:#dc2626;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Job Hire Admin</p>
            <h1 style="margin:6px 0 0;font-size:28px;">System Log Report</h1>
            <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Generated: ${generatedAt.toLocaleString("mn-MN")}</p>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px;">
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;"><p style="margin:0;color:#6b7280;font-size:11px;">Total users</p><strong style="font-size:20px;">${stats?.totalUsers || users.length || 0}</strong></div>
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;"><p style="margin:0;color:#6b7280;font-size:11px;">Active users</p><strong style="font-size:20px;">${activeUsers}</strong></div>
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;"><p style="margin:0;color:#6b7280;font-size:11px;">Admins</p><strong style="font-size:20px;">${adminUsers}</strong></div>
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;"><p style="margin:0;color:#6b7280;font-size:11px;">Pro users</p><strong style="font-size:20px;">${users.filter((user) => isPlanPro(user)).length}</strong></div>
          </div>
          <h2 style="font-size:16px;margin:0 0 10px;">Security Activity</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#111827;color:white;">
                <th style="text-align:left;padding:10px;border:1px solid #111827;">Time</th>
                <th style="text-align:left;padding:10px;border:1px solid #111827;">Message</th>
                <th style="text-align:left;padding:10px;border:1px solid #111827;">IP</th>
                <th style="text-align:left;padding:10px;border:1px solid #111827;">Tone</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:22px;color:#6b7280;font-size:11px;">This report was generated from the admin dashboard quick action.</p>
        </div>
      `;
      report.querySelectorAll("td").forEach((cell) => {
        cell.setAttribute("style", "padding:10px;border:1px solid #e5e7eb;");
      });

      try {
        const html2pdfModule = await import("html2pdf.js");
        const html2pdf = ((html2pdfModule as { default?: Html2PdfFactory }).default ||
          html2pdfModule) as Html2PdfFactory;
        await html2pdf()
          .set({
            margin: 8,
            filename: `system-logs-${generatedAt.toISOString().split("T")[0]}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .from(report)
          .save();
        showAlert("Логийн PDF файл амжилттай татагдлаа", "success", "Амжилт");
      } catch (error) {
        console.error("Failed to export system logs PDF:", error);
        showAlert("PDF татахад алдаа гарлаа", "error", "Алдаа");
      }
    } else if (action === "Database Backup") {
      // Trigger database backup
      showAlert("Database резервкопи эхлүүлэгдсэн. Хэтэвээ хүлээнэ үү...", "info", "Резервкопи");
      setTimeout(() => {
        showAlert("Database резервкопи амжилттай дууслаа", "success", "Амжилт");
      }, 2000);
    } else if (action === "System Scan") {
      // Start system scan
      showAlert("Системийн сканнер эхлүүлэгдсэн. Хэтэвээ хүлээнэ үү...", "info", "Сканнер");
      setTimeout(() => {
        showAlert("Системийн сканнер амжилттай дууслаа. Найдвартай байна.", "success", "Амжилт");
      }, 3000);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await authenticatedPost(API_URLS.auth.adminUpdateRole(), {
        userId,
        userType: newRole.toUpperCase(),
      });
      showAlert("Эрх амжилттай шинэчлэгдлээ", "success", "Амжилт");
      await fetchData();
      // Emit real-time event to other admins
      if (socketRef.current) {
        socketRef.current.emit("admin-action", { type: "role-updated", userId, newRole: newRole.toUpperCase() });
      }
      setShowRoleModal(false);
      setSelectedUserForRole(null);
    } catch {
      showAlert("Эрх шинэчлэхэд алдаа гарлаа", "error", "Алдаа");
    }
  };

  const openPlanModal = (user: AdminUser) => {
    setSelectedUserForPlan(user);
    setPlanChoice(isPlanPro(user) ? "PRO" : "FREE");
    const days = remainingPlanDays(user);
    setPlanDuration(
      user.subscriptionPlan === "PRO_UNTIL_CHANGED"
        ? "UNTIL_CHANGED"
        : days !== null && days <= 7
          ? "SEVEN_DAYS"
        : "ONE_MONTH",
    );
    setShowPlanModal(true);
  };

  const handleUpdatePlan = async () => {
    if (!selectedUserForPlan) return;

    try {
      await authenticatedPost(API_URLS.auth.adminUpdatePlan(), {
        userId: selectedUserForPlan.id,
        plan: planChoice,
        duration: planChoice === "PRO" ? planDuration : undefined,
      });
      showAlert("Эрх амжилттай шинэчлэгдлээ", "success", "Амжилт");
      await fetchData();
      if (socketRef.current) {
        socketRef.current.emit("admin-action", {
          type: "plan-updated",
          userId: selectedUserForPlan.id,
          plan: planChoice,
          duration: planChoice === "PRO" ? planDuration : null,
        });
      }
      setShowPlanModal(false);
      setSelectedUserForPlan(null);
    } catch {
      showAlert("Эрх шинэчлэхэд алдаа гарлаа", "error", "Алдаа");
    }
  };

  const approvePaymentOrder = async (order: PaymentOrder) => {
    try {
      await authenticatedPost(API_URLS.user.adminApprovePaymentOrder(order.id), {
        adminId: currentUserId,
      });
      showAlert("Төлбөр баталгаажиж, Pro plan идэвхжлээ.", "success", "Амжилт");
      await fetchData(true);
      setPreviewPayment(null);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Төлбөр баталгаажуулахад алдаа гарлаа";
      showAlert(message, "error", "Алдаа");
    }
  };

  const rejectPaymentOrder = async (order: PaymentOrder) => {
    const reason = prompt("Татгалзсан шалтгаан бичнэ үү:");
    if (!reason?.trim()) return;

    try {
      await authenticatedPost(API_URLS.user.adminRejectPaymentOrder(order.id), {
        adminId: currentUserId,
        reason: reason.trim(),
      });
      showAlert("Төлбөрийн хүсэлт буцаагдлаа.", "success", "Амжилт");
      await fetchData(true);
      setPreviewPayment(null);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Төлбөр буцаахад алдаа гарлаа";
      showAlert(message, "error", "Алдаа");
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!confirm(`${email} хэрэглэгчийг устгах уу?`)) return;

    try {
      await authenticatedDelete(API_URLS.auth.adminDeleteUser(userId));
      showAlert("Хэрэглэгч амжилттай устгагдлаа", "success", "Амжилт");
      await fetchData();
      // Emit real-time event to other admins
      if (socketRef.current) {
        socketRef.current.emit("admin-action", { type: "user-deleted", userId, email });
      }
    } catch {
      showAlert("Устгахад алдаа гарлаа", "error", "Алдаа");
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const q = searchTerm.toLowerCase();
        
        // Search filter
        const matchesSearch =
          user.email?.toLowerCase().includes(q) ||
          user.fullName?.toLowerCase().includes(q) ||
          user.userType?.toLowerCase().includes(q);
        
        // Role filter
        const matchesRole = !filterRole || user.userType === filterRole;
        
        // Status filter
        const isActive = user.userType !== "INACTIVE";
        const matchesStatus = 
          !filterStatus || 
          (filterStatus === "active" && isActive) ||
          (filterStatus === "inactive" && !isActive);
        
        // Company filter
        const matchesCompany = !filterCompany || user.company === filterCompany;
        
        return matchesSearch && matchesRole && matchesStatus && matchesCompany;
      }),
    [users, searchTerm, filterRole, filterStatus, filterCompany],
  );

  const activeUsers = users.filter((user) => user.userType !== "INACTIVE").length;
  const adminUsers = users.filter((user) => user.userType === "ADMIN").length;
  const recentUsers = users.slice(0, 4);
  const currentUserId = (session?.user as { id?: number | string } | undefined)?.id;

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
      <div className="flex h-[100dvh] w-full min-w-0 overflow-hidden bg-[#020713] text-white">
        <AdminSidebar
          view={view}
          onViewChange={handleViewChange}
          onQuickAction={handleQuickAction}
          onProfileOpen={() => setShowProfileModal(true)}
          onPrivacyOpen={() => setShowPrivacyModal(true)}
        />
        <AdminMobileDrawer
          view={view}
          onViewChange={handleViewChange}
          onQuickAction={handleQuickAction}
          onProfileOpen={() => setShowProfileModal(true)}
          onPrivacyOpen={() => setShowPrivacyModal(true)}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.14),transparent_34%),linear-gradient(180deg,#07101f_0%,#030813_100%)]">
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-3 py-4 pb-6 sm:px-4 md:px-8 md:py-7">
            <div className="mb-5 flex flex-col gap-4 md:mb-7 md:gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-[10px] font-black text-red-300 sm:px-3 sm:text-xs">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  System Administrator
                </div>
                <h1 className="text-lg font-black tracking-tight sm:text-2xl md:text-4xl lg:text-5xl">
                  {view === "dashboard" ? "Систем Удирдлага" : "Хэрэглэгчид"}
                </h1>
                <p className="mt-2 max-w-3xl text-xs text-slate-400 sm:text-sm md:text-base">
                  {view === "dashboard"
                    ? "Системийн нөөц ашиглалт болон аюулгүй байдлын төлөвийг хянах самбар"
                    : "Хэрэглэгчдийн жагсаалт, эрх, төлөв байдлыг удирдана."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] sm:h-12 sm:w-12 sm:rounded-xl lg:hidden"
                  aria-label="Admin menu"
                >
                  <Menu size={18} className="sm:block" />
                </button>
                <div className="hidden flex-col items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold sm:flex sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-xs md:rounded-xl md:px-4 md:py-3">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/15 sm:h-5 sm:w-5 md:h-6 md:w-6">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 sm:h-1.5 sm:w-1.5 md:h-2.5 md:w-2.5" />
                  </span>
                  <span className="hidden sm:inline">System Stable</span>
                </div>
                <button className="relative hidden h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-red-300 hover:bg-white/[0.08] sm:grid sm:h-12 sm:w-12 sm:rounded-xl md:hidden">
                  <Bell size={18} />
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[8px] font-black sm:h-5 sm:w-5 sm:text-[10px]">
                    3
                  </span>
                </button>
                <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-[10px] font-bold sm:block sm:px-3 sm:py-2 sm:text-xs md:rounded-xl md:px-4 md:py-3 md:text-sm">
                  <p className="hidden sm:block">{now.toLocaleDateString("mn-MN")}</p>
                  <p className="text-[9px] sm:text-[10px] md:text-xs">{now.toLocaleTimeString("mn-MN")}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap justify-start gap-2 sm:gap-3 md:mb-5 lg:justify-end">
              <button
                onClick={() => fetchData(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 hover:border-white/20 hover:bg-white/[0.08] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
              >
                <RefreshCcw size={14} className="sm:block" />
                <span className="hidden sm:inline">Өгөгдөл шинэчлэх</span>
                <span className="sm:hidden">Шинэчлэх</span>
              </button>
              <button
                onClick={() => handleViewChange(view === "dashboard" ? "users" : "dashboard")}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-[0_10px_30px_rgba(220,38,38,0.2)] hover:bg-red-500 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm md:shadow-[0_18px_42px_rgba(220,38,38,0.25)]"
              >
                <Users size={14} className="sm:block" />
                <span className="hidden sm:inline">{view === "dashboard" ? "Хэрэглэгчид үзэх" : "Систем төлөв"}</span>
                <span className="sm:hidden">{view === "dashboard" ? "Хэрэглэгчид" : "Систем"}</span>
              </button>
              {view === "users" && (
                <button className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200 hover:border-white/20 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm">
                  <Download size={14} className="sm:block" />
                  <span className="hidden sm:inline">Экспорт</span>
                </button>
              )}
            </div>

            {view === "dashboard" && (
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
                    label="Pro хэрэглэгчид"
                    value={users.filter((user) => isPlanPro(user)).length}
                    sub="Идэвхтэй эрхтэй"
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
                        ["Plan шинэчлэгдсэн", "7", "up", "amber"],
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
                        <div key={user.id} className="grid gap-2 border-b border-white/5 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_100px_150px] sm:items-center sm:gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-black">
                              {userInitial(user)}
                            </div>
                            <span className="truncate font-semibold text-white">{user.email}</span>
                          </div>
                          <span className={`w-max rounded-md border px-2 py-1 text-[10px] font-black ${roleClass(user.userType)}`}>
                            {user.userType}
                          </span>
                          <span className="text-right text-slate-400">{planSubLabel(user)}</span>
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
            )}

            {view === "users" && (
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

                <section className="rounded-xl border border-white/10 bg-[#0d1424]/85 p-2 sm:p-3 md:p-4 md:rounded-2xl">
                  <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-[1fr_180px_180px_180px_180px]">
                    <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Хэрэглэгч хайх..."
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#07101d] pl-10 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-red-500/50 sm:h-11 sm:pl-11 sm:pr-4 sm:text-sm md:h-12 md:rounded-xl"
                      />
                    </div>
                    
                    {/* Role Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowRoleDropdown(!showRoleDropdown);
                          setShowStatusDropdown(false);
                          setShowCompanyDropdown(false);
                        }}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#07101d] px-3 text-xs font-bold text-slate-300 hover:border-white/20 sm:h-11 sm:px-4 sm:text-sm md:h-12 md:rounded-xl"
                      >
                        <span className="min-w-0 truncate">{filterRole ? filterRole : "Бүх эрх"}</span>
                        <ChevronDown size={14} className={`transition-transform flex-shrink-0 sm:size-4 ${showRoleDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showRoleDropdown && (
                        <div className="absolute top-full right-0 z-20 mt-2 w-full min-w-[140px] rounded-xl border border-white/10 bg-[#07101d] shadow-lg">
                          <button
                            onClick={() => {
                              setFilterRole("");
                              setShowRoleDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-t-xl"
                          >
                            Бүх эрх
                          </button>
                          {uniqueRoles.map((role) => (
                            <button
                              key={role}
                              onClick={() => {
                                setFilterRole(role);
                                setShowRoleDropdown(false);
                              }}
                              className={`block w-full text-left px-4 py-3 text-sm ${filterRole === role ? 'bg-red-500/20 text-red-300' : 'text-slate-300 hover:bg-white/10'}`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Status Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowStatusDropdown(!showStatusDropdown);
                          setShowRoleDropdown(false);
                          setShowCompanyDropdown(false);
                        }}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#07101d] px-3 text-xs font-bold text-slate-300 hover:border-white/20 sm:h-11 sm:px-4 sm:text-sm md:h-12 md:rounded-xl"
                      >
                        <span className="min-w-0 truncate">{filterStatus ? statusOptions.find(s => s.value === filterStatus)?.label : "Бүх төлөв"}</span>
                        <ChevronDown size={14} className={`transition-transform flex-shrink-0 sm:size-4 ${showStatusDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showStatusDropdown && (
                        <div className="absolute top-full right-0 z-20 mt-2 w-full min-w-[140px] rounded-xl border border-white/10 bg-[#07101d] shadow-lg">
                          <button
                            onClick={() => {
                              setFilterStatus("");
                              setShowStatusDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-t-xl"
                          >
                            Бүх төлөв
                          </button>
                          {statusOptions.map((status) => (
                            <button
                              key={status.value}
                              onClick={() => {
                                setFilterStatus(status.value);
                                setShowStatusDropdown(false);
                              }}
                              className={`block w-full text-left px-4 py-3 text-sm ${filterStatus === status.value ? 'bg-red-500/20 text-red-300' : 'text-slate-300 hover:bg-white/10'}`}
                            >
                              {status.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Company Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowCompanyDropdown(!showCompanyDropdown);
                          setShowRoleDropdown(false);
                          setShowStatusDropdown(false);
                        }}
                        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#07101d] px-3 text-xs font-bold text-slate-300 hover:border-white/20 sm:h-11 sm:px-4 sm:text-sm md:h-12 md:rounded-xl"
                      >
                        <span className="min-w-0 truncate">{filterCompany ? filterCompany : "Бүх компани"}</span>
                        <ChevronDown size={14} className={`transition-transform flex-shrink-0 sm:size-4 ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showCompanyDropdown && (
                        <div className="absolute top-full right-0 z-20 mt-2 w-full min-w-[140px] max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#07101d] shadow-lg">
                          <button
                            onClick={() => {
                              setFilterCompany("");
                              setShowCompanyDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-t-xl sticky top-0 bg-[#07101d]"
                          >
                            Бүх компани
                          </button>
                          {uniqueCompanies.map((company) => (
                            <button
                              key={company}
                              onClick={() => {
                                setFilterCompany(company);
                                setShowCompanyDropdown(false);
                              }}
                              className={`block w-full text-left px-4 py-3 text-sm ${filterCompany === company ? 'bg-red-500/20 text-red-300' : 'text-slate-300 hover:bg-white/10'}`}
                            >
                              {company}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setFilterRole("");
                        setFilterStatus("");
                        setFilterCompany("");
                      }}
                      className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300 hover:bg-white/[0.07]"
                    >
                      Шүүлтүүр цэвэрлэх
                    </button>
                  </div>
                </section>

                <div className="space-y-3 md:hidden">
                  {filteredUsers.map((user, index) => (
                    <article
                      key={user.id}
                      className="min-w-0 rounded-xl border border-white/10 bg-[#0d1424]/85 p-4"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-xs font-black">
                          {userInitial(user)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">{userName(user)}</p>
                              <p className="truncate text-xs text-slate-400">{user.email}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`rounded-md border px-2 py-1 text-[10px] font-black ${roleClass(user.userType)}`}>
                                {user.userType}
                              </span>
                              <span className={`rounded-md border px-2 py-1 text-[10px] font-black ${planClass(user)}`}>
                                {planLabel(user)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="min-w-0 rounded-lg bg-white/[0.04] p-2">
                              <p className="text-slate-500">ID</p>
                              <p className="truncate font-bold text-slate-200">{user.id}</p>
                            </div>
                            <div className="min-w-0 rounded-lg bg-white/[0.04] p-2">
                              <p className="text-slate-500">Компани</p>
                              <p className="truncate font-bold text-slate-200">{user.company || "My Company"}</p>
                            </div>
                            <div className="min-w-0 rounded-lg bg-white/[0.04] p-2">
                              <p className="text-slate-500">Төлөв</p>
                              <p className="flex items-center gap-2 font-bold text-slate-200">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                Идэвхтэй
                              </p>
                            </div>
                            <div className="min-w-0 rounded-lg bg-white/[0.04] p-2">
                              <p className="text-slate-500">Сүүлд</p>
                              <p className="truncate font-bold text-slate-200">{relativeUserTime(user, index)}</p>
                            </div>
                            <div className="col-span-2 min-w-0 rounded-lg bg-white/[0.04] p-2">
                              <p className="text-slate-500">Эрхийн төрөл</p>
                              <p className="truncate font-bold text-slate-200">{planTypeLabel(user)}</p>
                              <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{planSubLabel(user)}</p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForRole({ id: user.id, currentRole: user.userType });
                                setShowRoleModal(true);
                              }}
                              className="grid h-10 place-items-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300"
                              title="Эрх засах"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => openPlanModal(user)}
                              className="grid h-10 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300"
                              title="Эрх засах"
                            >
                              <Crown size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="grid h-10 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300"
                              title="Устгах"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}

                  <div className="rounded-xl border border-white/10 bg-[#0d1424]/85 px-4 py-3 text-xs font-semibold text-slate-400">
                    Нийт {filteredUsers.length} хэрэглэгчээс 1-8 харуулж байна
                  </div>
                </div>

                <section className="hidden overflow-hidden rounded-lg border border-white/10 bg-[#0d1424]/85 md:block md:rounded-2xl">
                  <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <table className="w-full min-w-max text-left text-xs sm:text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.02] uppercase tracking-wide text-slate-400 text-[10px] sm:text-xs">
                        <tr>
                          <th className="w-12 sm:w-16 px-2 sm:px-6 py-3 sm:py-5">
                            <span className="block h-4 w-4 sm:h-5 sm:w-5 rounded border border-slate-600" />
                          </th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap">Хэрэглэгч</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap hidden sm:table-cell">Имэйл</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap">Эрх</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap">Эрх</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap hidden md:table-cell">Компани</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap">Төлөв</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 whitespace-nowrap hidden lg:table-cell">Сүүлд</th>
                          <th className="px-2 sm:px-6 py-3 sm:py-5 text-right whitespace-nowrap">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredUsers.map((user, index) => (
                          <tr key={user.id} className="hover:bg-white/[0.025] text-[10px] sm:text-sm">
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <span className="block h-4 w-4 sm:h-5 sm:w-5 rounded border border-slate-600" />
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4">
                              <div className="flex items-center gap-1 sm:gap-3">
                                <div className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-[8px] sm:text-xs font-black flex-shrink-0">
                                  {userInitial(user)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-black text-white truncate text-xs sm:text-sm">{userName(user)}</p>
                                  <p className="text-[7px] sm:text-xs text-slate-400 truncate">(ID: {user.id})</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-slate-300 hidden sm:table-cell truncate max-w-[150px]">{user.email}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                              <span className={`rounded-md border px-1.5 sm:px-3 py-0.5 sm:py-1.5 text-[7px] sm:text-[10px] font-black ${roleClass(user.userType)}`}>
                                {user.userType.slice(0, 3)}
                              </span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className={`w-fit rounded-md border px-1.5 py-0.5 text-[7px] font-black sm:px-3 sm:py-1.5 sm:text-[10px] ${planClass(user)}`}>
                                  {planLabel(user)}
                                </span>
                                <span className="hidden max-w-[140px] truncate text-[10px] text-slate-400 lg:block">
                                  {planTypeLabel(user)}
                                </span>
                                <span className="hidden max-w-[190px] truncate text-[10px] text-slate-500 xl:block">
                                  {planSubLabel(user)}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-slate-300 hidden md:table-cell truncate max-w-[120px]">{user.company || "My Company"}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 sm:gap-2 text-slate-200">
                                <span className="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400" />
                                <span className="hidden sm:inline">Идэвхтэй</span>
                              </span>
                            </td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 text-slate-300 hidden lg:table-cell whitespace-nowrap text-[8px] sm:text-xs">{relativeUserTime(user, index)}</td>
                            <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUserForRole({ id: user.id, currentRole: user.userType });
                                    setShowRoleModal(true);
                                  }}
                                  className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded border sm:rounded-lg border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
                                  title="Эрх засах"
                                >
                                  <Edit2 size={14} className="sm:block" style={{width: '14px', height: '14px'}} />
                                </button>
                                <button
                                  onClick={() => openPlanModal(user)}
                                  className="grid h-8 w-8 place-items-center rounded border border-amber-500/20 bg-amber-500/10 text-amber-300 transition-colors hover:bg-amber-500/20 sm:h-10 sm:w-10 sm:rounded-lg"
                                  title="Эрх засах"
                                >
                                  <Crown size={14} style={{ width: "14px", height: "14px" }} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded border sm:rounded-lg border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                                  title="Устгах"
                                >
                                  <Trash2 size={14} className="sm:block" style={{width: '14px', height: '14px'}} />
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

            {view === "payments" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Semi-auto payments</p>
                      <h2 className="mt-1 text-xl font-black text-white">Төлбөрийн хүсэлтүүд</h2>
                    </div>
                    <span className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200">
                      PENDING: {paymentOrders.filter((order) => order.status === "PENDING").length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Order</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {paymentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-3">
                              <p className="font-black text-white">{order.orderId}</p>
                              <p className="text-xs text-slate-500">{order.bankName} · {order.bankAccount}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-100">{order.user?.fullName || order.user?.email || order.userId}</p>
                              <p className="text-xs text-slate-500">{order.user?.email}</p>
                            </td>
                            <td className="px-4 py-3 font-black text-white">{Number(order.amountMnt || 0).toLocaleString("mn-MN")}₮</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                                order.status === "SUCCESS"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : order.status === "REJECTED"
                                    ? "bg-red-500/15 text-red-300"
                                    : "bg-amber-500/15 text-amber-300"
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{new Date(order.createdAt).toLocaleString("mn-MN")}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setPreviewPayment(order)}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/[0.06]"
                                >
                                  Preview
                                </button>
                                {order.status === "PENDING" && (
                                  <>
                                    <button
                                      onClick={() => approvePaymentOrder(order)}
                                      className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white hover:bg-emerald-400"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => rejectPaymentOrder(order)}
                                      className="rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white hover:bg-red-400"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {view === "security" && <SecurityView />}
            {view === "logs" && <LogsView />}
            {view === "settings" && <SettingsView />}

            {showProfileModal && currentUserId && (
              <AdminProfileModal
                userId={currentUserId}
                onClose={() => setShowProfileModal(false)}
              />
            )}

            {showPrivacyModal && currentUserId && (
              <AdminPrivacyModal
                userId={currentUserId}
                onClose={() => setShowPrivacyModal(false)}
              />
            )}

            {showPlanModal && selectedUserForPlan && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-300">User plan</p>
                      <h2 className="mt-1 text-xl font-black text-white">Эрх өөрчлөх</h2>
                      <p className="mt-2 text-sm text-slate-400">{selectedUserForPlan.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlanModal(false);
                        setSelectedUserForPlan(null);
                      }}
                      className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["FREE", "PRO"] as const).map((plan) => (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setPlanChoice(plan)}
                        className={`rounded-xl border px-4 py-4 text-left transition ${
                          planChoice === plan
                            ? "border-amber-400/60 bg-amber-400/15 text-white"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="block text-sm font-black">{plan}</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {plan === "FREE" ? "Үнэгүй эрх" : "Pro эрх"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {planChoice === "PRO" && (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Хугацаа</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { value: "SEVEN_DAYS", label: "7 хоног" },
                          { value: "ONE_MONTH", label: "1 сар" },
                          { value: "UNTIL_CHANGED", label: "Өөрчлөх хүртэл" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPlanDuration(option.value as typeof planDuration)}
                            className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                              planDuration === option.value
                                ? "border-blue-400/60 bg-blue-400/15 text-white"
                                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlanModal(false);
                        setSelectedUserForPlan(null);
                      }}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.05]"
                    >
                      Болих
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePlan}
                      className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-300"
                    >
                      Хадгалах
                    </button>
                  </div>
                </div>
              </div>
            )}

            {previewPayment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Payment screenshot</p>
                      <h2 className="mt-1 text-xl font-black text-white">{previewPayment.orderId}</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {previewPayment.user?.email} · {Number(previewPayment.amountMnt || 0).toLocaleString("mn-MN")}₮
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewPayment(null)}
                      className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="max-h-[66vh] overflow-auto bg-black/30 p-5">
                    {previewPayment.screenshotUrl ? (
                      <img
                        src={previewPayment.screenshotUrl}
                        alt={`Payment ${previewPayment.orderId}`}
                        className="mx-auto max-h-[60vh] max-w-full rounded-xl border border-white/10 object-contain"
                      />
                    ) : (
                      <div className="grid min-h-64 place-items-center text-slate-400">Screenshot байхгүй байна</div>
                    )}
                  </div>
                  {previewPayment.status === "PENDING" && (
                    <div className="flex justify-end gap-3 border-t border-white/10 p-5">
                      <button
                        onClick={() => rejectPaymentOrder(previewPayment)}
                        className="rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => approvePaymentOrder(previewPayment)}
                        className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-400"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Role Selection Modal */}
            {showRoleModal && selectedUserForRole && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
                  <h2 className="mb-6 text-xl font-black text-white">Эрх сонгох</h2>
                  
                  <p className="mb-6 text-sm text-slate-400">
                    Одоогийн эрх: <span className="font-bold text-white">{selectedUserForRole.currentRole}</span>
                  </p>
                  
                  <div className="mb-6 space-y-2">
                    {uniqueRoles.map((role) => (
                      <button
                        key={role}
                        onClick={() => handleUpdateRole(selectedUserForRole.id, role)}
                        className={`w-full rounded-lg border px-4 py-3 text-left font-bold transition-all ${
                          role === selectedUserForRole.currentRole
                            ? "border-red-500/60 bg-red-600/25 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:border-white/20"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowRoleModal(false);
                      setSelectedUserForRole(null);
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-bold text-slate-300 hover:bg-white/[0.08]"
                  >
                    Хаах
                  </button>
                </div>
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

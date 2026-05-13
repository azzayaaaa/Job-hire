"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  LayoutDashboard,
  Users,
  Briefcase,
  Send,
  MessageSquare,
  LogOut,
  Search,
  Sparkles,
  Loader2,
  Shield,
  X,
  User,
  Phone,
  Save,
  MapPin,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import axios from "axios";
import { useLanguage, useTheme } from "../Providers";
import { authenticatedFetch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";
import NotificationCenter from "@/components/NotificationCenter";

export default function DashboardLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // AI Chat States
  const [aiQuery, setAiQuery] = useState("");
  const [aiChat, setAiChat] = useState<{ role: string; content: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Profile States
  const [profile, setProfile] = useState({
    fullName: "",
    phone: "",
    location: "Улаанбаатар",
    referralCode: "",
  });
  const [isParsingCv, setIsParsingCv] = useState(false);

  const roleColors: Record<string, string> = {
    admin: "#EF4444",
    employer: "#4F67FF",
    candidate: "#10B981",
  };

  const roleLabels: Record<string, string> = {
    admin: t.adminPortal,
    employer: t.employerPortal,
    candidate: t.candidatePortal,
  };

  const themeColor = roleColors[role] || "#4F67FF";

  const fetchProfile = async () => {
    try {
      const userId = (session?.user as any)?.id;
      if (!userId) return;
      const res = await authenticatedFetch(
        API_URLS.auth.profile(userId)
      );
      setProfile({
        fullName: res.data.fullName || "",
        phone: res.data.phone || "",
        location: res.data.location || "Улаанбаатар",
        referralCode: res.data.referralCode || "",
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
    }
  };

  useEffect(() => {
    if (isProfileOpen) fetchProfile();
  }, [isProfileOpen]);

  const copyReferral = () => {
    navigator.clipboard.writeText(profile.referralCode);
    showAlert("Урилгын код хуулагдлаа.", "success");
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingCv(true);
    const formData = new FormData();
    formData.append("cv", file);
    try {
      const res = await axios.post(
        API_URLS.ai.parseCv(),
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const { name, phone, location } = res.data.structuredData;
      setProfile((prev) => ({
        ...prev,
        fullName: name || prev.fullName,
        phone: phone || prev.phone,
        location: location || prev.location,
      }));
      showAlert("АI таны CV-г амжилттай уншиж, мэдээллийг бөглөлөө!", "success");
    } catch {
      showAlert("СV уншихад алдаа гарлаа.", "error");
    } finally {
      setIsParsingCv(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const userId = (session?.user as any)?.id;
      await authenticatedPost(API_URLS.auth.updateProfile(), {
        userId,
        ...profile,
      });
      showAlert("Амжилттай хадгалагдлаа", "success");
      setIsProfileOpen(false);
    } catch {
      showAlert("Алдаа гарлаа", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAiChat = async () => {
    if (!aiQuery.trim()) return;
    const userMsg = { role: "user", content: aiQuery };
    setAiChat((prev) => [...prev, userMsg]);
    setAiQuery("");
    setAiLoading(true);
    try {
      const res = await authenticatedPost(API_URLS.ai.ask(), {
        prompt: aiQuery,
        userRole: role.toUpperCase(),
        context:
          role === "admin"
            ? "Чи бол системийн админ туслах."
            : role === "employer"
            ? "Чи бол ажил олгогчийн туслах."
            : "Чи бол ажил горилогчийн туслах.",
      });
      setAiChat((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer },
      ]);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error || "Холболтын алдаа гарлаа.";
      setAiChat((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full min-w-0 overflow-hidden bg-background font-sans text-foreground">
      {/* ── Profile Modal ──────────────────────────────── */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-card rounded-[32px] border border-white/5 shadow-2xl overflow-hidden animate-in zoom-in duration-300 glass-card">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-black">
                Хувийн{" "}
                <span style={{ color: themeColor }}>Мэдээлэл</span>
              </h3>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-primary/10 text-primary p-2 rounded-xl hover:bg-primary/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                  {isParsingCv ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isParsingCv ? "Уншиж байна..." : "AI CV Parse"}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleCvUpload}
                    disabled={isParsingCv}
                  />
                </label>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-secondary-text hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary-text uppercase tracking-widest ml-1">
                  Овог Нэр
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-text group-focus-within:text-foreground transition-colors"
                    size={18}
                  />
                  <input
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    type="text"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-white/20 transition-all text-foreground"
                    placeholder="Таны нэр..."
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary-text uppercase tracking-widest ml-1">
                  Утасны дугаар
                </label>
                <div className="relative group">
                  <Phone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-text group-focus-within:text-foreground transition-colors"
                    size={18}
                  />
                  <input
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    type="text"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-white/20 transition-all text-foreground"
                    placeholder="Холбоо барих..."
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary-text uppercase tracking-widest ml-1">
                  Байршил
                </label>
                <div className="relative group">
                  <MapPin
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-text group-focus-within:text-foreground transition-colors"
                    size={18}
                  />
                  <select
                    value={profile.location}
                    onChange={(e) =>
                      setProfile({ ...profile, location: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-white/20 transition-all text-foreground appearance-none"
                  >
                    <option>Улаанбаатар</option>
                    <option>Алсын зайнаас</option>
                    <option>Архангай</option>
                    <option>Баян-Өлгий</option>
                    <option>Баянхонгор</option>
                    <option>Булган</option>
                    <option>Говь-Алтай</option>
                    <option>Говьсүмбэр</option>
                    <option>Дархан-Уул</option>
                    <option>Дорнод</option>
                    <option>Дорноговь</option>
                    <option>Дундговь</option>
                    <option>Завхан</option>
                    <option>Орхон (Эрдэнэт)</option>
                    <option>Өвөрхангай</option>
                    <option>Өмнөговь</option>
                    <option>Сүхбаатар</option>
                    <option>Сэлэнгэ</option>
                    <option>Төв</option>
                    <option>Увс</option>
                    <option>Ховд</option>
                    <option>Хөвсгөл</option>
                    <option>Хэнтий</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <label className="text-[10px] font-black text-secondary-text uppercase tracking-widest ml-1">
                  Миний урилгын код
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl font-black text-center tracking-widest text-[#10B981]">
                    {profile.referralCode}
                  </div>
                  <button
                    type="button"
                    onClick={copyReferral}
                    className="w-14 h-14 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-2xl flex items-center justify-center hover:bg-[#10B981] hover:text-white transition-all"
                  >
                    <LayoutDashboard size={20} />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-4 rounded-2xl font-black text-sm tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                style={{ backgroundColor: themeColor, color: "#fff" }}
              >
                {profileLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}{" "}
                ХАДГАЛАХ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Main Content (full width, no sidebar) ──────── */}
      <main className="min-w-0 flex-1 overflow-hidden bg-background animate-fade-in relative">
        {children}
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import { Settings, Bell, Moon, Sun, Lock, Loader2, KeyRound, Globe, Check } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useLanguage, useTheme } from "../../Providers";
import { authenticatedFetch } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { lang, changeLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const fetchUserProfile = async () => {
    try {
      const userId = (session?.user as any)?.id;
      if (!userId) return;
      const res = await authenticatedFetch(`http://127.0.0.1:5001/api/auth/profile/${userId}`);
      setUserProfile(res.data);
      setEmailNotifications(res.data.emailNotifications ?? true);
    } catch (error) {
      console.error("Profile fetch error:", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchUserProfile();
  }, [session, status]);

  const handleToggleEmailNotifications = async () => {
    setSavingNotifications(true);
    try {
      const userId = (session?.user as any)?.id;
      await axios.put(API_URLS.notifications.updatePreferences(userId), {
        emailNotifications: !emailNotifications,
      });
      setEmailNotifications(!emailNotifications);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      alert("Мэдэгдлүүдийн сонголтыг солихад алдаа гарлаа");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleCreatePassword = async () => {
    alert("Энэ функц тун удахгүй нэмэгдэнэ. Та 'Нууц үг мартсан' хэсгийг ашиглан нууц үг тохируулах боломжтой.");
  };

  if (status === "loading" || fetching) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;

  const role = userProfile?.userType?.toLowerCase() || "candidate";

  return (
    <DashboardLayout role={role}>
      <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2">{t.websiteSettings.split(' ')[0]} <span className="text-primary">{t.websiteSettings.split(' ')[1]}</span></h2>
          <p className="text-secondary-text text-sm font-medium">{t.generalSettings}</p>
        </div>

        <div className="space-y-6">
          {/* Interface Settings */}
          <div className="bg-card rounded-[32px] p-8 border border-white/5 shadow-2xl glass-card">
            <h3 className="text-lg font-bold mb-8 flex items-center gap-3">
              <Settings size={20} className="text-primary" /> {t.interfaceSettings}
            </h3>
            
            <div className="space-y-6">
              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover-lift">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Bell size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">И-мэйл мэдэгдлүүд</p>
                    <p className="text-[10px] text-secondary-text">Ажлын санал, сонголт, татгалзаалын мэдэгдэл</p>
                  </div>
                </div>
                <Toggle
                  active={emailNotifications}
                  onClick={handleToggleEmailNotifications}
                  disabled={savingNotifications}
                />
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover-lift">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.darkMode}</p>
                    <p className="text-[10px] text-secondary-text">Switch between light and dark themes</p>
                  </div>
                </div>
                <Toggle active={theme === "dark"} onClick={toggleTheme} />
              </div>

              {/* Language Selection */}
              <div className="flex flex-col gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                    <Globe size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.language}</p>
                    <p className="text-[10px] text-secondary-text">Select your preferred language</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => changeLang("mn")}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${lang === "mn" ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-secondary-text"}`}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest">Монгол</span>
                    {lang === "mn" && <Check size={14} />}
                  </button>
                  <button 
                    onClick={() => changeLang("en")}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${lang === "en" ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-secondary-text"}`}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest">English</span>
                    {lang === "en" && <Check size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings - Зөвхөн нууц үггүй (Google) хэрэглэгчдэд харуулна */}
          {!userProfile?.hasPassword && (
            <div className="bg-card rounded-[32px] p-8 border border-white/5 shadow-2xl glass-card">
              <h3 className="text-lg font-bold mb-8 flex items-center gap-3">
                <Lock size={20} className="text-red-500" /> {t.security}
              </h3>

              <div className="space-y-4">
                <p className="text-xs text-secondary-text leading-relaxed mb-4">
                  Хэрэв та Google-ээр бүртгүүлсэн бол системд шууд нэвтрэх нууц үг үүсгэх боломжтой.
                </p>
                <button 
                  onClick={handleCreatePassword}
                  className="flex items-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group w-full sm:w-auto hover-lift"
                >
                  <KeyRound size={18} className="text-primary group-hover:rotate-12 transition-transform" />
                  <span className="text-sm font-bold text-foreground">{t.createPassword}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Toggle({ active, onClick, disabled = false }: { active: boolean, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${active ? 'bg-primary' : 'bg-secondary-text/30'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

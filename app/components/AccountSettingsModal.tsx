"use client";

import React, { useEffect, useState } from "react";
import { Bell, Check, KeyRound, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import axios from "axios";
import { API_URLS } from "@/lib/apiConfig";
import { authenticatedFetch, authenticatedPost } from "@/lib/axiosClient";

type AccountSettingsModalProps = {
  userId: number | string;
  role: "candidate" | "employer";
  onClose: () => void;
};

export default function AccountSettingsModal({
  userId,
  role,
  onClose,
}: AccountSettingsModalProps) {
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const accent = role === "employer" ? "#4F67FF" : "#2563EB";

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authenticatedFetch(API_URLS.auth.profile(userId));
        setEmail(res.data?.email || "");
        setEmailNotifications(res.data?.emailNotifications ?? true);
      } catch (error) {
        console.error("Failed to fetch settings profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleSaveEmail = async () => {
    if (!email.trim()) return alert("Имэйл хаягаа оруулна уу.");

    setSavingEmail(true);
    try {
      await authenticatedPost(API_URLS.auth.updateProfile(), {
        userId,
        email: email.trim(),
      });
      alert("Имэйл амжилттай шинэчлэгдлээ. Дараагийн нэвтрэлтээс session шинэчлэгдэнэ.");
    } catch {
      alert("Имэйл шинэчлэхэд алдаа гарлаа.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleToggleNotifications = async () => {
    const next = !emailNotifications;
    setEmailNotifications(next);
    setSavingNotifications(true);
    try {
      await axios.put(API_URLS.notifications.updatePreferences(userId), {
        emailNotifications: next,
      });
    } catch (error) {
      setEmailNotifications(!next);
      console.error("Failed to update notification preference:", error);
      alert("Мэдэгдлийн тохиргоо хадгалахад алдаа гарлаа.");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSendPasswordCode = async () => {
    if (!email.trim()) return alert("Эхлээд имэйл хаягаа оруулна уу.");

    setSendingCode(true);
    try {
      await axios.post(API_URLS.auth.forgotPassword(), { email: email.trim() });
      setCodeSent(true);
      alert("Нууц үг солих код таны имэйл рүү илгээгдлээ.");
    } catch {
      alert("Код илгээхэд алдаа гарлаа.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleChangePassword = async () => {
    if (code.length !== 6) return alert("6 оронтой код оруулна уу.");
    if (newPassword.length < 6) return alert("Нууц үг хамгийн багадаа 6 тэмдэгт байна.");

    setChangingPassword(true);
    try {
      await axios.post(API_URLS.auth.resetPassword(), {
        email: email.trim(),
        code,
        newPassword,
      });
      setCode("");
      setNewPassword("");
      setCodeSent(false);
      alert("Нууц үг амжилттай шинэчлэгдлээ.");
    } catch {
      alert("Нууц үг шинэчлэхэд алдаа гарлаа. Кодоо шалгана уу.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1120] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/35">
              Account settings
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">Тохиргоо</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-[360px] place-items-center">
            <Loader2 className="animate-spin" style={{ color: accent }} />
          </div>
        ) : (
          <div className="space-y-4 p-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
                  <Mail size={21} />
                </div>
                <div>
                  <h3 className="font-black text-white">Имэйл солих</h3>
                  <p className="mt-1 text-xs text-white/45">
                    Нэвтрэх болон мэдэгдэл авах имэйл хаягаа шинэчилнэ.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#070d19] px-4 py-3 text-sm text-white outline-none focus:border-blue-500/60"
                  placeholder="example@mail.com"
                  type="email"
                />
                <button
                  onClick={handleSaveEmail}
                  disabled={savingEmail}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {savingEmail ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Хадгалах
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Bell size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-white">Мэдэгдэл хүлээн авах</h3>
                  <p className="mt-1 text-xs text-white/45">
                    Асаалттай үед имэйл мэдэгдэл очно. Унтраасан үед зөвхөн платформын хонхон дээр мэдэгдэл ирнэ.
                  </p>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  disabled={savingNotifications}
                  className={`relative h-7 w-14 rounded-full transition-all ${
                    emailNotifications ? "bg-emerald-500" : "bg-white/15"
                  } ${savingNotifications ? "opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      emailNotifications ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#070d19] px-4 py-3 text-xs font-semibold text-white/50">
                Төлөв:{" "}
                <span className={emailNotifications ? "text-emerald-300" : "text-amber-300"}>
                  {emailNotifications ? "Имэйл болон платформын мэдэгдэл идэвхтэй" : "Зөвхөн платформын мэдэгдэл идэвхтэй"}
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-300">
                  <KeyRound size={21} />
                </div>
                <div>
                  <h3 className="font-black text-white">Нууц үг солих</h3>
                  <p className="mt-1 text-xs text-white/45">
                    Имэйлээр баталгаажуулах код аваад шинэ нууц үгээ тохируулна.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  onClick={handleSendPasswordCode}
                  disabled={sendingCode}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white hover:bg-white/[0.09] disabled:opacity-60"
                >
                  {sendingCode ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  Код илгээх
                </button>
                {codeSent && (
                  <span className="flex items-center justify-center rounded-xl bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">
                    Код илгээгдсэн
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto]">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="rounded-xl border border-white/10 bg-[#070d19] px-4 py-3 text-center text-sm font-black tracking-[0.25em] text-white outline-none focus:border-red-500/60"
                  placeholder="000000"
                />
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="rounded-xl border border-white/10 bg-[#070d19] px-4 py-3 text-sm text-white outline-none focus:border-red-500/60"
                  placeholder="Шинэ нууц үг"
                  type="password"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {changingPassword ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Солих
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

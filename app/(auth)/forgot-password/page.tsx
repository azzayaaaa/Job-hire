"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import axios, { AxiosError } from "axios";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { API_URLS } from "@/lib/apiConfig";

type Step = "email" | "code" | "password";

function getAxiosErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; details?: string } | undefined;
    return data?.error || data?.details || fallback;
  }

  return fallback;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sendCode = async () => {
    if (!email.trim()) {
      setError("Имэйл хаягаа оруулна уу.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await axios.post(API_URLS.auth.forgotPassword(), { email: email.trim() });
      setMessage("Таны имэйл рүү 6 оронтой код илгээлээ.");
      setStep("code");
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Код илгээхэд алдаа гарлаа."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("6 оронтой код оруулна уу.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(API_URLS.auth.verify(), { email: email.trim(), code });
      setStep("password");
      setMessage("Код баталгаажлаа. Шинэ нууц үгээ оруулна уу.");
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Код буруу байна."));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Нууц үг баталгаажуулалт таарахгүй байна.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(API_URLS.auth.resetPassword(), {
        email: email.trim(),
        code,
        newPassword: password,
      });

      const signInRes = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.replace("/login");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Нууц үг шинэчлэхэд алдаа гарлаа."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050810] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/5 bg-[#080D1D] p-6 shadow-2xl shadow-black/40">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/35 hover:text-white">
            <ArrowLeft size={14} /> Нэвтрэх
          </Link>
          <div className="rounded-xl bg-[#4F67FF]/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#4F67FF]">
            JobHub
          </div>
        </div>

        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4F67FF]/15 text-[#4F67FF]">
            {step === "email" ? <Mail size={22} /> : step === "code" ? <ShieldCheck size={22} /> : <Lock size={22} />}
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {step === "email" ? "Нууц үг сэргээх" : step === "code" ? "Код баталгаажуулах" : "Шинэ нууц үг"}
          </h1>
          <p className="mt-2 text-sm text-white/40">
            {step === "email"
              ? "Бүртгэлтэй имэйлээ оруулна уу."
              : step === "code"
                ? `${email} хаяг руу ирсэн 6 оронтой кодыг оруулна уу.`
                : "Шинэ нууц үгээ хоёр удаа оруулж баталгаажуулна уу."}
          </p>
        </div>

        <div className="space-y-4">
          {step === "email" && (
            <>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full rounded-2xl border border-white/5 bg-[#111827] p-4 pl-12 text-sm text-white outline-none focus:border-[#4F67FF]/40"
                />
              </div>
              <button onClick={sendCode} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F67FF] py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-[#3d52e0] disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Код илгээх"}
              </button>
            </>
          )}

          {step === "code" && (
            <>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-2xl border border-white/5 bg-[#111827] p-4 text-center text-lg font-black tracking-[0.45em] text-white outline-none focus:border-[#4F67FF]/40"
              />
              <button onClick={verifyCode} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F67FF] py-4 text-sm font-black uppercase tracking-widest text-white hover:bg-[#3d52e0] disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Үргэлжлүүлэх"}
              </button>
              <button onClick={sendCode} disabled={loading} className="w-full text-center text-xs font-bold text-white/35 hover:text-white">
                Код дахин илгээх
              </button>
            </>
          )}

          {step === "password" && (
            <>
              {[["password", password, setPassword, "Шинэ нууц үг"], ["confirm", confirmPassword, setConfirmPassword, "Нууц үг баталгаажуулах"]].map(([key, value, setter, placeholder]: any) => (
                <div key={key} className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-2xl border border-white/5 bg-[#111827] p-4 pl-12 pr-12 text-sm text-white outline-none focus:border-[#4F67FF]/40"
                  />
                  {key === "password" && (
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
              ))}
              <button onClick={resetPassword} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10B981] py-4 text-sm font-black uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Нууц үг шинэчлэх"}
              </button>
            </>
          )}

          {message && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {message}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-black uppercase tracking-widest text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

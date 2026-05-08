"use client";

import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import axios, { AxiosError } from "axios";
import Image from "next/image";
import { useLanguage } from "../../Providers";


type ErrorResponse = {
  error?: string;
};

function getRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("rememberedEmail") ?? "";
}

function getRememberedPassword(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("rememberedPass") ?? "";
}

function getInitialRememberMe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    window.localStorage.getItem("rememberedEmail") &&
      window.localStorage.getItem("rememberedPass"),
  );
}

function getAxiosErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || fallback;
  }

  return fallback;
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  const [forgotStep, setForgotStep] = useState(0);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setHasMounted(true);
    setEmail(getRememberedEmail());
    setPassword(getRememberedPassword());
    setRememberMe(getInitialRememberMe());

    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email);
      localStorage.setItem("rememberedPass", password);
    } else {
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberedPass");
    }

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Имэйл эсвэл нууц үг буруу байна");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const handleForgotPassword = async () => {
    try {
      setLoading(true);
      await axios.post("http://localhost:5001/api/auth/forgot-password", {
        email,
      });
      setForgotStep(2);
    } catch (error: unknown) {
      setError(getAxiosErrorMessage(error, "Алдаа гарлаа"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (resetCode.length !== 6) {
      setError("6 оронтой код оруулна уу");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5001/api/auth/verify", {
        email,
        code: resetCode,
      });

      if (res.data.success) {
        setForgotStep(3);
        setError("");
      }
    } catch (error: unknown) {
      setError(getAxiosErrorMessage(error, "Код буруу байна"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Нууц үг таарахгүй байна");
      return;
    }

    try {
      setLoading(true);
      await axios.post("http://localhost:5001/api/auth/reset-password", {
        email,
        code: resetCode,
        newPassword,
      });
      alert(t.resetSuccess);
      setForgotStep(0);
    } catch (error: unknown) {
      setError(getAxiosErrorMessage(error, "Алдаа гарлаа"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#050810] font-sans text-white">
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-[#4F67FF]/10 blur-[120px]"></div>
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[40%] w-[40%] rounded-full bg-[#4F67FF]/10 blur-[120px]"></div>

      <div className="relative flex h-full w-full animate-in flex-col overflow-hidden rounded-xl border border-white/5 bg-[#080D1D]/50 shadow-[0_0_100px_rgba(0,0,0,0.5)] fade-in zoom-in duration-700 md:flex-row">
        <div className="h-auto w-full shrink-0 bg-gradient-to-br from-[#190e5b] to-[#080D1D] p-6 md:h-full md:w-[45%] md:p-12">
          <div className="animate-slide-up text-center md:mb-10 md:text-left">
            <div
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? "translateY(0)" : "translateY(10px)",
                transition: "all 1s ease-out",
              }}
            >
              <h1 className="text-[22px] leading-tight font-black tracking-tight uppercase md:text-[36px] lg:text-[42px]">
                ТАНИЙ <span className="text-[#4F67FF]">АМЖИЛТ</span> <br />
                ЭНДЭЭС ЭХЭЛНЭ. <br />
                <span className="text-[#4F67FF]">JOBHUB</span>
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-[10px] leading-relaxed font-medium text-white/40 md:mx-0 md:mt-4 md:text-sm">
                Хамгийн ухаалаг ажил хайлтын системд тавтай морил.
              </p>
            </div>
          </div>
          <div
            className={`relative z-10 h-32 w-full animate-float transition-all delay-300 duration-1000 md:h-80 ${
              isLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <Image
              src="/zuragaa.png"
              alt="Preview"
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>

        <div className="z-[2] flex flex-1 flex-col justify-center overflow-y-auto p-6 md:overflow-visible md:p-12 lg:p-16">
          <div className="mx-auto w-full max-w-[360px] py-4">
            <div className="mb-10 flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase transition-all hover:text-white"
              >
                <ArrowLeft size={14} /> Нүүр
              </Link>
              <div className="flex gap-4">
                <button
                  type="button"
                  className="rounded-xl bg-[#4F67FF] px-6 py-2 text-[10px] font-black tracking-widest text-white uppercase shadow-lg shadow-[#4F67FF]/20"
                >
                  Нэвтрэх
                </button>
                <Link href="/register">
                  <button
                    type="button"
                    className="px-4 py-2 text-[10px] font-black tracking-widest text-white/40 uppercase transition-colors hover:text-white"
                  >
                    Бүртгүүлэх
                  </button>
                </Link>
              </div>
            </div>

            {forgotStep === 0 ? (
              <>
                <div className="mb-8">
                  <h2 className="mb-2 text-3xl font-black tracking-tighter">
                    НЭВТРЭХ
                  </h2>
                  <p className="text-xs font-bold tracking-widest text-white/40 uppercase">
                    {t.noAccount}
                    <Link
                      href="/register"
                      className="ml-1 text-[#4F67FF] hover:underline"
                    >
                      {t.register}
                    </Link>
                  </p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-[10px] font-black tracking-widest text-[#374151] uppercase">
                      Имэйл хаяг
                    </label>
                    <div className="group relative">
                      <Mail
                        className="absolute top-1/2 left-4 -translate-y-1/2 text-[#374151] transition-colors group-focus-within:text-[#4F67FF]"
                        size={18}
                      />
                      <input
                        type="email"
                        placeholder="example@mail.com"
                        className="w-full rounded-2xl border border-white/5 bg-[#111827] p-4 pl-12 text-sm text-white outline-none transition-all focus:border-[#4F67FF]/30"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black tracking-widest text-[#374151] uppercase">
                        Нууц үг
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-[10px] font-black tracking-widest text-[#4F67FF] uppercase transition-colors hover:text-[#8062FF]"
                      >
                        {t.forgotPassword}
                      </Link>
                    </div>
                    <div className="group relative">
                      <Lock
                        className="absolute top-1/2 left-4 -translate-y-1/2 text-[#374151] transition-colors group-focus-within:text-[#4F67FF]"
                        size={18}
                      />
                      <input
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        className="w-full rounded-2xl border border-white/5 bg-[#111827] p-4 pr-12 pl-12 text-sm text-white outline-none transition-all focus:border-[#4F67FF]/30"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute top-1/2 right-4 -translate-y-1/2 p-2 text-[#374151] transition-colors hover:text-white"
                      >
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 flex items-center justify-between px-1">
                    <label className="group flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                          rememberMe
                            ? "border-[#4F67FF] bg-[#4F67FF]"
                            : "border-white/10 group-hover:border-white/20"
                        }`}
                      >
                        {rememberMe && (
                          <div className="h-2 w-2 rounded-sm bg-white" />
                        )}
                      </div>
                      <span className="text-[10px] font-black tracking-widest text-[#374151] uppercase transition-colors group-hover:text-white/60">
                        Намайг сана
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-[10px] font-black tracking-widest text-red-500 uppercase">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F67FF] py-4 text-sm font-black tracking-widest text-white shadow-lg shadow-[#4F67FF]/20 transition-all active:scale-95 hover:bg-[#3d52e0]"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      "НЭВТРЭХ"
                    )}
                  </button>
                </form>

                <div className="mt-8">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="h-[1px] flex-1 bg-white/5" />
                    <span className="text-[9px] font-black tracking-[0.3em] text-[#374151] uppercase">
                      ЭСВЭЛ
                    </span>
                    <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      signIn("google", { callbackUrl: "/dashboard" })
                    }
                    className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 py-3.5 transition-all hover:bg-white/10"
                  >
                    <Image
                      src="/google.png"
                      alt="Google"
                      width={20}
                      height={20}
                      className="h-auto w-4 transition-transform group-hover:scale-110"
                    />
                    <span className="text-[10px] font-black tracking-widest text-white uppercase">
                      Google-ээр орох
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="animate-in space-y-6 fade-in zoom-in duration-300">
                <button
                  onClick={() => setForgotStep(0)}
                  className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white/40 uppercase transition-all hover:text-white"
                >
                  <ArrowLeft size={14} /> БУЦАХ
                </button>

                <div className="mb-6">
                  <h2 className="text-2xl font-black text-white">
                    {forgotStep === 1
                      ? "Нууц үг сэргээх"
                      : forgotStep === 2
                        ? "Код оруулах"
                        : "Шинэ нууц үг"}
                  </h2>
                  <p className="mt-2 text-xs font-medium text-white/40">
                    {forgotStep === 1
                      ? "Бүртгэлтэй имэйл хаягаа оруулна уу."
                      : forgotStep === 2
                        ? `${email} хаяг руу код илгээлээ.`
                        : "Шинэ хүчтэй нууц үг сонгоно уу."}
                  </p>
                </div>

                {forgotStep === 1 && (
                  <div className="flex flex-col gap-4">
                    <input
                      type="email"
                      placeholder="example@mail.com"
                      className="w-full rounded-xl border border-white/5 bg-[#111827] p-4 text-sm text-white outline-none transition-all focus:border-[#4F67FF]/50 md:rounded-2xl md:p-5"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="flex w-full items-center justify-center rounded-xl bg-[#4F67FF] py-4 text-sm font-bold tracking-widest text-white transition-all hover:bg-[#3d52e0] md:rounded-2xl md:py-5"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "КОД ИЛГЭЭХ"
                      )}
                    </button>
                  </div>
                )}

                {forgotStep === 2 && (
                  <div className="flex flex-col gap-4">
                    <input
                      type="text"
                      placeholder="••••••"
                      className="w-full rounded-xl border border-white/5 bg-[#111827] p-4 text-center text-sm font-black tracking-[0.5em] text-white outline-none transition-all focus:border-[#4F67FF]/50 md:rounded-2xl md:p-5"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                    />
                    {error && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-[10px] font-black tracking-widest text-red-500 uppercase">
                        {error}
                      </div>
                    )}
                    <button
                      onClick={handleVerifyResetCode}
                      disabled={loading}
                      className="flex w-full items-center justify-center rounded-xl bg-[#4F67FF] py-4 text-sm font-bold tracking-widest text-white transition-all hover:bg-[#3d52e0] md:rounded-2xl md:py-5"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "ҮРГЭЛЖЛҮҮЛЭХ"
                      )}
                    </button>
                  </div>
                )}

                {forgotStep === 3 && (
                  <div className="flex flex-col gap-4">
                    <input
                      type="password"
                      placeholder={t.newPassword}
                      className="w-full rounded-xl border border-white/5 bg-[#111827] p-4 text-sm text-white outline-none transition-all focus:border-[#4F67FF]/50 md:rounded-2xl md:p-5"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder={t.confirmPassword}
                      className="w-full rounded-xl border border-white/5 bg-[#111827] p-4 text-sm text-white outline-none transition-all focus:border-[#4F67FF]/50 md:rounded-2xl md:p-5"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={loading}
                      className="flex w-full items-center justify-center rounded-xl bg-[#10B981] py-4 text-sm font-bold tracking-widest text-white transition-all hover:opacity-90 md:rounded-2xl md:py-5"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "НУУЦ ҮГ ШИНЭЧЛЭХ"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="mt-8 text-center text-[10px] font-black tracking-[0.3em] text-white/10 uppercase md:mt-12">
              JobHub © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { Eye, EyeOff, User, Briefcase, Loader2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useAlert } from "@/components/AlertProvider";
import { API_URLS } from "@/lib/apiConfig";

export default function RegisterPage() {
  const { showAlert } = useAlert();
  const [showPass, setShowPass] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userType, setUserType] = useState("candidate");
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(120); // 120 секунд

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300); // A small delay, adjust if needed
    return () => clearTimeout(timer);
  }, []); // Empty dependency array means it runs once on mount

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (step === 2 && timer > 0) {
        setTimer((prev) => prev - 1);
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [step, timer]);

  const handleSendCode = async () => {
    if (!email || !password) return showAlert("Мэдээллээ бүрэн бөглөнө үү", "error");
    setIsLoading(true);
    try {
      const res = await fetch(API_URLS.auth.sendCode(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
        setTimer(120);
      } else {
        showAlert(data.error, "error");
      }
    } catch (err) {
      showAlert("Сервер ажиллахгүй байна", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalRegister = async () => {
    if (code.length !== 6) return showAlert("6 оронтой код оруулна уу", "error");
    setIsLoading(true);
    try {
        const res = await fetch(API_URLS.auth.register(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, userType: userType.toUpperCase(), code, invitedByCode: promoCode }),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert("Бүртгэл амжилттай. Нэвтэрч байна...", "success");
        await signIn("credentials", {
          email,
          password,
          callbackUrl: "/dashboard",
        });
      } else {
        showAlert(data.error, "error");
      }
    } catch (err) {
      showAlert("Алдаа гарлаа", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="relative flex h-screen w-full items-stretch justify-center overflow-hidden bg-[#050810] font-sans text-white">
      {/* Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#4F67FF]/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-visible rounded-xl border border-white/5 bg-[#080D1D]/50 shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-in fade-in zoom-in duration-700 md:flex-row md:overflow-hidden">
        
        {/* Зүүн тал - Чимэглэл */}
        <div className="relative flex h-auto w-full shrink-0 flex-col justify-center bg-gradient-to-br from-[#190e5b] to-[#080D1D] p-5 text-center sm:p-6 md:min-h-[100dvh] md:w-[45%] md:p-12 md:text-left">
          <div className="relative z-10 mb-4 md:mb-10 animate-slide-up">
            <div style={{ opacity: isLoaded ? 1 : 0, transform: isLoaded ? "translateY(0)" : "translateY(10px)", transition: "all 1s ease-out" }}>
              <h1 className="text-[22px] md:text-[36px] lg:text-[42px] font-black leading-tight tracking-tight uppercase">
                Хамтдаа <br/> <span className="text-[#10B981]">амжилтанд</span> <br/> хүрье.
              </h1>
              <p className="text-white/40 mt-2 md:mt-4 text-[10px] md:text-sm font-medium leading-relaxed max-w-sm mx-auto md:mx-0">Өөрийн карьераа шинэ шатанд гаргах цаг боллоо.</p>
            </div>
          </div>
          <div className={`relative z-10 h-32 md:h-80 w-full transition-all duration-1000 delay-300 animate-float ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Image
              src="/zuragaa.png"
              alt="Preview"
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              priority
              className="object-contain"
            />
          </div>
        </div>

        {/* Баруун тал - Форм */}
        <div className="z-[2] flex min-h-0 flex-1 flex-col justify-start overflow-y-visible p-5 sm:p-6 md:justify-center md:overflow-y-auto md:p-12 lg:p-16">
          <div className="max-w-[360px] w-full mx-auto py-4">
            
            <div className="flex justify-between items-center mb-10">
              <Link href="/" className="text-[10px] font-black text-white/20 hover:text-white flex items-center gap-2 transition-all uppercase tracking-[0.2em]">
                <ArrowLeft size={14}/> Нүүр
              </Link>
              <div className="flex gap-4">
                <Link href="/login">
                  <button type="button" className="text-white/40 text-[10px] font-black py-2 px-4 hover:text-white transition-colors uppercase tracking-widest">Нэвтрэх</button>
                </Link>
                <button type="button" className="bg-[#10B981] text-white text-[10px] font-black py-2 px-6 rounded-xl shadow-lg shadow-[#10B981]/20 uppercase tracking-widest">Бүртгүүлэх</button>
              </div>
            </div>

            {step === 1 ? (
              <>
                <div className="mb-8">
                  <h2 className="text-3xl font-black tracking-tighter mb-2">БҮРТГҮҮЛЭХ</h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Бүртгэлтэй бол <Link href="/login" className="text-[#10B981] hover:underline ml-1">Нэвтрэх</Link></p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => setUserType("candidate")} className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${userType === "candidate" ? "bg-[#10B981]/10 border-[#10B981] text-[#10B981]" : "bg-[#111827] border-white/5 text-[#374151]"}`}>
                    <User size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ажилтан</span>
                  </button>
                  <button onClick={() => setUserType("employer")} className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${userType === "employer" ? "bg-[#10B981]/10 border-[#10B981] text-[#10B981]" : "bg-[#111827] border-white/5 text-[#374151]"}`}>
                    <Briefcase size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ажил олгогч</span>
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="space-y-1.5 text-black">
                    <label className="text-[10px] font-black text-[#374151] uppercase tracking-widest ml-1">Имэйл</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" className="w-full bg-[#111827] border border-white/5 text-white p-4 rounded-2xl text-sm outline-none focus:border-[#10B981]/30 transition-all" />
                  </div>
                  <div className="space-y-1.5 text-black">
                    <label className="text-[10px] font-black text-[#374151] uppercase tracking-widest ml-1">Нууц үг</label>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#111827] border border-white/5 text-white p-4 rounded-2xl text-sm outline-none focus:border-[#10B981]/30 transition-all pr-12" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#374151] hover:text-white transition-colors">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                  <button onClick={handleSendCode} disabled={isLoading} className="w-full bg-[#10B981] text-white font-black py-4 rounded-2xl mt-2 shadow-lg shadow-[#10B981]/20 hover:opacity-90 transition-all text-sm tracking-widest flex items-center justify-center gap-2 active:scale-95">
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : "ҮРГЭЛЖЛҮҮЛЭХ"}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-[1px] bg-white/5" />
                    <span className="text-[9px] text-[#374151] font-black tracking-[0.3em] uppercase">ЭСВЭЛ</span>
                    <div className="flex-1 h-[1px] bg-white/5" />
                  </div>
                  <button 
                    type="button" 
                    disabled={isLoading}
                    onClick={() => {
                      setIsLoading(true);
                      window.localStorage.removeItem("postLoginRedirect");
                      document.cookie = `pendingUserType=${userType.toUpperCase()}; path=/; max-age=300; SameSite=Lax`;
                      signIn(
                        "google",
                        { callbackUrl: "/dashboard" },
                        { prompt: "select_account" },
                      );
                    }}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 flex items-center justify-center gap-3 hover:bg-white/10 transition-all group disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Image src="/google.png" alt="Google" width={20} height={20} loading="eager" className="w-4 h-auto group-hover:scale-110 transition-transform" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Google-ээр үргэлжлүүлэх</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4 text-center animate-in fade-in zoom-in duration-300">
                <h2 className="text-xl md:text-2xl font-bold">Код баталгаажуулах</h2>
                <p className="text-sm text-[#6b7280] mb-2">{email} хаяг руу илгээсэн кодыг оруулна уу.</p>
                <input type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" className="w-full bg-[#111827] border border-[#4F67FF] text-white p-5 rounded-2xl text-center text-2xl tracking-[10px] outline-none" />
                
                <div className="flex flex-col gap-2">
                  <button onClick={handleFinalRegister} disabled={isLoading} className="w-full bg-[#4F67FF] text-white font-bold py-5 rounded-xl md:rounded-2xl shadow-lg hover:bg-[#3d52e0] transition-all flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Баталгаажуулах & Бүртгүүлэх"}
                  </button>
                  
                  <div className="flex justify-between items-center px-2">
                    <span className="text-xs text-[#6b7280]">Хугацаа: <span className={timer < 30 ? "text-red-500 font-bold" : "text-[#4F67FF]"}>{formatTime(timer)}</span></span>
                    <button 
                      onClick={handleSendCode} 
                      disabled={timer > 0 || isLoading} 
                      className={`text-xs font-bold transition-colors ${timer > 0 ? "text-[#374151] cursor-not-allowed" : "text-[#4F67FF] hover:text-white"}`}
                    >
                      Код дахин авах
                    </button>
                  </div>
                </div>

                <button type="button" onClick={() => setStep(1)} className="text-xs text-[#6b7280] hover:text-white transition-colors mt-4">Буцах</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Copy, Crown, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { authenticatedFetch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";

type UpgradePlanModalProps = {
  userId: number | string;
  role: "candidate" | "employer";
  onClose: () => void;
};

type FeatureLimit = {
  limit: number;
  used: number;
  remaining: number;
};

type PlanInfo = {
  plan?: string;
  proActive?: boolean;
  priceMnt?: number;
  subscriptionExpiresAt?: string | null;
  free?: {
    aiCv?: FeatureLimit;
    selfImprovement?: FeatureLimit;
  };
};

function createFallbackTransactionCode(userId: number | string) {
  const normalizedUserId = String(userId).replace(/\D/g, "").slice(-4).padStart(4, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JOB${normalizedUserId}${random}`;
}

function getStoredTransactionCode(userId: number | string) {
  if (typeof window === "undefined") return "";
  const key = `jobhubPaymentCode_${userId}`;
  const saved = window.localStorage.getItem(key);
  if (saved && /^JOB[A-Z0-9]{3,12}$/.test(saved)) return saved;
  const next = createFallbackTransactionCode(userId);
  window.localStorage.setItem(key, next);
  return next;
}

function getRemainingDays(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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

function formatPlanName(plan?: PlanInfo | null) {
  if (!plan?.proActive) return "Үнэгүй эрх";
  if (!plan.subscriptionExpiresAt) return "Хязгааргүй Pro";
  const remainingDays = getRemainingDays(plan.subscriptionExpiresAt);
  if (remainingDays !== null && remainingDays <= 7) return "7 хоногийн Pro";
  return "Сарын Pro";
}

export default function UpgradePlanModal({ userId, role, onClose }: UpgradePlanModalProps) {
  const { showAlert } = useAlert();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [lastOrderId, setLastOrderId] = useState("");
  const [transactionCode, setTransactionCode] = useState(() => getStoredTransactionCode(userId));
  const [paymentOrderLoading, setPaymentOrderLoading] = useState(false);
  const [paymentOrderAttempted, setPaymentOrderAttempted] = useState(false);

  const priceMnt = plan?.priceMnt || 10000;
  const isPro = plan?.proActive === true;
  const planName = formatPlanName(plan);
  const remainingDays = getRemainingDays(plan?.subscriptionExpiresAt);
  const expiresLabel = formatMongolianDate(plan?.subscriptionExpiresAt);
  const freeAiCv = plan?.free?.aiCv;
  const freeSelfImprovement = plan?.free?.selfImprovement;
  const roleBenefits =
    role === "employer"
      ? ["AI туслах", "2-оос олон ажлын зар", "Кандидат шалгах", "Чат болон dashboard боломжууд"]
      : ["AI CV бэлдэх", "CV татах/хэвлэх", "Өөрийгөө хөгжүүлэх", "Чат болон dashboard боломжууд"];

  useEffect(() => {
    let active = true;

    const fetchPlan = async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(API_URLS.user.entitlements(userId));
        if (active) setPlan(res.data);
      } catch (error) {
        console.warn("Failed to fetch upgrade entitlements:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPlan();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (isPro || loading || transactionCode || paymentOrderLoading || paymentOrderAttempted) return;
    let active = true;

    const createPaymentCode = async () => {
      setPaymentOrderLoading(true);
      setPaymentOrderAttempted(true);
      try {
        const res = await authenticatedPost(API_URLS.user.createPaymentOrder(), {
          userId,
          amountMnt: priceMnt,
          plan: "PRO_MONTHLY",
          duration: "ONE_MONTH",
        });
        if (!active) return;
        setLastOrderId(res.data?.order?.orderId || "");
        setTransactionCode(res.data?.order?.transactionCode || getStoredTransactionCode(userId));
      } catch (error) {
        console.warn("Failed to create payment order:", error);
        if (active) {
          setTransactionCode(getStoredTransactionCode(userId));
          showAlert("Гүйлгээний утга түр local-оор үүслээ. Screenshot илгээхэд энэ кодоор бүртгэнэ.", "warning");
        }
      } finally {
        if (active) setPaymentOrderLoading(false);
      }
    };

    createPaymentCode();
    return () => {
      active = false;
    };
  }, [isPro, loading, paymentOrderAttempted, paymentOrderLoading, priceMnt, showAlert, transactionCode, userId]);

  const handleScreenshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showAlert("Гүйлгээний screenshot зураг оруулна уу.", "warning");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showAlert("Зураг 6MB-аас бага байх хэрэгтэй.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshot(String(reader.result || ""));
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const copyBankInfo = async () => {
    await navigator.clipboard.writeText("TDB 140005000499582572 Аззаяа Баяртай");
    showAlert("Дансны мэдээлэл хуулагдлаа.", "success");
  };

  const copyAccountNumber = async () => {
    await navigator.clipboard.writeText("140005000499582572");
    showAlert("Дансны дугаар хуулагдлаа.", "success");
  };

  const copyTransactionCode = async () => {
    if (!transactionCode) return;
    await navigator.clipboard.writeText(transactionCode);
    showAlert("Гүйлгээний утга хуулагдлаа.", "success");
  };

  const handlePaymentRequest = async () => {
    if (!transactionCode) {
      showAlert("Гүйлгээний утга үүсээгүй байна. Дахин оролдоно уу.", "warning");
      return;
    }

    if (!screenshot) {
      showAlert("Эхлээд гүйлгээний screenshot-оо upload хийнэ үү.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authenticatedPost(API_URLS.user.createPaymentOrder(), {
        userId,
        amountMnt: priceMnt,
        plan: "PRO_MONTHLY",
        duration: "ONE_MONTH",
        transactionCode,
        screenshotUrl: screenshot,
      });
      setLastOrderId(res.data?.order?.orderId || "");
      setTransactionCode(res.data?.order?.transactionCode || "");
      showAlert("Төлбөрийн хүсэлт илгээгдлээ. Админ шалгаад Pro plan идэвхжүүлнэ.", "success");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Төлбөрийн хүсэлт илгээхэд алдаа гарлаа.";
      showAlert(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-24px)] w-full max-w-6xl overflow-y-auto rounded-[20px] border border-white/10 bg-[#080d18] shadow-[0_24px_90px_rgba(0,0,0,0.58)] sm:my-6 sm:max-h-[94vh] sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 md:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/35">
              {isPro ? "Active subscription" : "Semi-auto payment"}
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              {isPro ? "Pro plan идэвхтэй" : "Pro plan авах"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              {isPro
                ? `Таны ${planName} идэвхтэй байна. Дуусах хугацаа: ${expiresLabel}.`
                : "Данс руу шилжүүлээд гүйлгээний screenshot-оо илгээнэ. Админ баталгаажуулсны дараа Pro plan 1 сарын хугацаатай идэвхжинэ."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Close upgrade modal"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center">
            <Loader2 className="animate-spin text-blue-300" size={28} />
          </div>
        ) : isPro ? (
          <div className="p-4 sm:p-6 md:p-8">
            <section className="relative overflow-hidden rounded-[20px] border border-emerald-400/45 bg-gradient-to-br from-[#103b2e] via-[#12345f] to-[#111827] p-4 shadow-[0_24px_70px_rgba(16,185,129,0.2)] sm:rounded-[24px] sm:p-6">
              <div className="relative">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100/75">Одоогийн эрх</p>
                    <h3 className="mt-2 text-4xl font-black text-white">{planName}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-emerald-50/75">
                      Бүх Pro боломжууд нээгдсэн. Free plan-ийн лимит болон payment upload хэсэг танд харагдахгүй.
                    </p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-200">
                    <Crown size={28} />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Төлөв</p>
                    <p className="mt-2 text-lg font-black text-emerald-200">Идэвхтэй</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Дуусах хугацаа</p>
                    <p className="mt-2 text-lg font-black text-white">{expiresLabel}</p>
                    {remainingDays !== null && (
                      <p className="mt-1 text-xs font-bold text-emerald-200/75">
                        {remainingDays > 0 ? `${remainingDays} хоног үлдсэн` : "Өнөөдөр дуусна"}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Эрхийн төрөл</p>
                    <p className="mt-2 text-lg font-black text-white">{planName}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {roleBenefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <Check size={17} className="shrink-0 text-emerald-300" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-base font-black text-[#0f3327] transition hover:bg-emerald-50 sm:w-auto"
                >
                  Dashboard руу буцах
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 md:grid-cols-[0.95fr_1.05fr] md:p-8">
            <section className="rounded-[20px] border border-white/10 bg-white/[0.035] p-4 sm:rounded-[24px] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">Free</p>
                  <h3 className="mt-2 text-4xl font-black text-white">0₮</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white/65">Одоо</span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white/72">AI CV бэлдэх</span>
                    <span className="text-sm font-black text-white">{freeAiCv?.remaining ?? 1}/{freeAiCv?.limit ?? 1}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/42">Үлдсэн хэрэглээ</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white/72">Өөрийгөө хөгжүүлэх</span>
                    <span className="text-sm font-black text-white">
                      {freeSelfImprovement?.remaining ?? 1}/{freeSelfImprovement?.limit ?? 1}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/42">Үлдсэн хэрэглээ</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-white/54">
                Free plan дээр CV preview хийж болно. Харин screenshot, PDF/HTML татах, хэвлэх зэрэг хамгаалалттай үйлдэл Pro plan дээр нээгдэнэ.
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[20px] border border-blue-400/45 bg-gradient-to-br from-[#293a93] via-[#18295f] to-[#111827] p-4 shadow-[0_24px_70px_rgba(37,99,235,0.28)] sm:rounded-[24px] sm:p-6">
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-100/80">Pro Monthly</p>
                    <h3 className="mt-2 text-4xl font-black text-white">
                      {priceMnt.toLocaleString("mn-MN")}₮
                      <span className="ml-1 text-base font-bold text-white/60">/сар</span>
                    </h3>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-blue-100">
                    <Crown size={24} />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4">
                  <div className="space-y-4">
                    {/* Bank Details */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100/60">Хүлээн авах банк</p>
                      <p className="mt-2 text-sm font-black text-white">TDB</p>
                    </div>

                    {/* Account Number with Copy */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100/60">Дансны дугаар</p>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="flex-1 text-lg font-black text-white break-all">140005000499582572</p>
                        <button
                          type="button"
                          onClick={copyAccountNumber}
                          className="shrink-0 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/15"
                          title="Дансны дугаар хуулах"
                        >
                          <Copy size={17} />
                        </button>
                      </div>
                    </div>

                    {/* Account Holder */}
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100/60">Данс эзэмшигч</p>
                      <p className="mt-2 text-sm font-bold text-blue-100">Аззаяа Баяртай</p>
                    </div>

                    {/* Transaction Code with Copy - Highlighted */}
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Гүйлгээний утга</p>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="flex-1 text-2xl font-black text-white tracking-wider">
                          {paymentOrderLoading ? "Үүсгэж байна..." : transactionCode || "---"}
                        </p>
                        {transactionCode && (
                          <button
                            type="button"
                            onClick={copyTransactionCode}
                            className="shrink-0 grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                            title="Гүйлгээний утга хуулах"
                          >
                            <Copy size={17} />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-blue-100/65">
                        Банкны апп руу шилжүүлэхдээ энэ кодыг гүйлгээний утгаар бичнэ үү
                      </p>
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" />
                        <p className="text-xs font-bold leading-5">
                          Гүйлгээний утга өөрчилж бичээгүй эсвэл буруу бичсэн төлбөр автоматаар ялгагдахгүй тул Pro эрх сэргээхгүй.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div className="rounded-2xl bg-white p-2">
                      <Image
                        src="/payment-qr.jpg"
                        alt="TDB төлбөрийн QR"
                        width={360}
                        height={360}
                        className="h-auto w-full rounded-xl"
                        priority
                      />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">Банкны апп руугаа энэ QR кодыг уншуулаарай.</p>
                      <p className="mt-2 text-xs leading-5 text-blue-100/70">
                        QR уншуулсны дараа гүйлгээний утга хэсгийг заавал <span className="font-black text-emerald-200">{transactionCode || "JOB..."}</span> болгож өөрчилнө.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {roleBenefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <Check size={17} className="shrink-0 text-emerald-300" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <label className="mt-5 flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/8 p-4 transition hover:bg-white/12">
                  <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-blue-100">
                    <ImagePlus size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">
                      {screenshotName || "Гүйлгээний screenshot upload хийх"}
                    </span>
                    <span className="mt-1 block text-xs text-blue-100/60">PNG, JPG, JPEG зураг дэмжинэ</span>
                  </span>
                </label>

                {lastOrderId && (
                  <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 space-y-2">
                    <p className="text-sm font-bold text-emerald-100">Хүсэлт амжилттай илгээгдлээ!</p>
                    <div className="text-xs text-emerald-100/75 space-y-1">
                      <p>Order ID: <span className="font-black">{lastOrderId}</span></p>
                      <p>Гүйлгээний утга: <span className="font-black">{transactionCode}</span></p>
                    </div>
                  </div>
                )}

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handlePaymentRequest}
                    disabled={submitting || plan?.proActive || !transactionCode}
                    className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-black text-[#17306f] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/55"
                  >
                    <Sparkles size={18} />
                    {plan?.proActive ? "Идэвхтэй" : submitting ? "Хүсэлт илгээж байна..." : "Төлбөрийн хүсэлт илгээх"}
                  </button>
                  <span className="text-center text-xs font-semibold text-blue-100/75 sm:max-w-[190px] sm:text-left">
                    Баталгаажмагц notification очиж, Pro эрх нээгдэнэ.
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { SessionProvider } from "next-auth/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AlertProvider } from "./components/AlertProvider";

type Locale = "mn" | "en";
type ThemeMode = "dark" | "light";
type TranslationMap = Record<string, string>;

type LanguageContextValue = {
  lang: Locale;
  changeLang: (locale: Locale) => void;
  t: TranslationMap;
};

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within Providers");
  }

  return context;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within Providers");
  }

  return context;
};

const translations: Record<Locale, TranslationMap> = {
  mn: {
    login: "Нэвтрэх",
    register: "Бүртгүүлэх",
    email: "Имэйл хаяг",
    password: "Нууц үг",
    rememberMe: "Намайг сана",
    forgotPassword: "Нууц үг мартсан?",
    noAccount: "Бүртгэлгүй юу?",
    haveAccount: "Бүртгэлтэй юу?",
    logout: "Гарах",
    settings: "Тохиргоо",
    dashboard: "Хянах самбар",
    search: "Хайх",
    credits: "Эрх",
    aiAssistant: "AI Туслах",
    candidatePortal: "Ажил горилогч",
    employerPortal: "Ажил олгогч",
    adminPortal: "Админ",
    newJob: "ШИНЭ ЗАР НЭМЭХ",
    apply: "ХҮСЭЛТ ИЛГЭЭХ",
    sendCode: "Код илгээх",
    verify: "Баталгаажуулах",
    newPassword: "Шинэ нууц үг",
    confirmPassword: "Нууц үг давтах",
    resetSuccess: "Нууц үг амжилттай шинэчлэгдлээ",
    notifications: "Мэдэгдэл хүлээн авах",
    darkMode: "Dark Mode",
    security: "Аюулгүй байдал",
    createPassword: "Нууц үг үүсгэх / солих",
    language: "Хэл сонгох",
    interfaceSettings: "Харагдац болон Мэдэгдэл",
    websiteSettings: "Вэбсайт Тохиргоо",
    generalSettings: "Системийн ерөнхий тохиргоо болон аюулгүй байдал.",
  },
  en: {
    login: "Login",
    register: "Register",
    email: "Email Address",
    password: "Password",
    rememberMe: "Remember Me",
    forgotPassword: "Forgot Password?",
    noAccount: "No account?",
    haveAccount: "Have an account?",
    logout: "Logout",
    settings: "Settings",
    dashboard: "Dashboard",
    search: "Search",
    credits: "Plan",
    aiAssistant: "AI Assistant",
    candidatePortal: "Candidate Portal",
    employerPortal: "Employer Portal",
    adminPortal: "Admin Portal",
    newJob: "POST NEW JOB",
    apply: "APPLY NOW",
    sendCode: "Send Code",
    verify: "Verify Code",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    resetSuccess: "Password reset successful",
    notifications: "Receive Notifications",
    darkMode: "Dark Mode",
    security: "Security",
    createPassword: "Create / Change Password",
    language: "Select Language",
    interfaceSettings: "Interface & Notifications",
    websiteSettings: "Website Settings",
    generalSettings: "General system settings and security.",
  },
};

function getInitialLanguage(): Locale {
  if (typeof window === "undefined") {
    return "mn";
  }

  const savedLang = window.localStorage.getItem("lang");
  return savedLang === "en" || savedLang === "mn" ? savedLang : "mn";
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem("theme");
  return savedTheme === "light" ? "light" : "dark";
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Locale>("mn");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = window.localStorage.getItem("lang") as Locale;
    if (savedLang === "en" || savedLang === "mn") {
      setLang(savedLang);
    }
    const savedTheme = window.localStorage.getItem("theme") as ThemeMode;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      window.localStorage.setItem("lang", lang);
    }
  }, [lang, mounted]);

  useEffect(() => {
    if (mounted) {
      window.localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("light", theme === "light");
    }
  }, [theme, mounted]);

  const changeLang = (locale: Locale) => {
    setLang(locale);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const t = translations[lang];

  // Hydration mismatch-ээс сэргийлэхийн тулд эхний render дээр сервертэй ижил байлгах
  // Гэхдээ context-оор дамжиж буй 't' нь сервер дээр 'mn' байгаа тул 
  // эхний render дээр 'mn' хэвээр үлдээх нь зөв.

  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AlertProvider>
        <LanguageContext.Provider value={{ lang, changeLang, t }}>
          <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
          </ThemeContext.Provider>
        </LanguageContext.Provider>
      </AlertProvider>
    </SessionProvider>
  );
}

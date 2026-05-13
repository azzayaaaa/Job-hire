"use client";

import React, { useEffect, useState } from "react";
import { Settings, Save, RotateCcw, AlertCircle } from "lucide-react";

interface AppSetting {
  id: string;
  name: string;
  description: string;
  value: string | boolean;
  type: "toggle" | "text" | "number";
}

export function SettingsView() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Simulated settings
      setSettings([
        {
          id: "maintenance_mode",
          name: "Засварын горим",
          description: "Системийг засварын горимд оруулах үед бусад хэрэглэгчид нэвтрэх боломжгүй болно",
          value: false,
          type: "toggle",
        },
        {
          id: "email_notifications",
          name: "Имэйл мэдэгдэл",
          description: "Системийн чухал үйл явдлуудын имэйл мэдэгдэл илгээх",
          value: true,
          type: "toggle",
        },
        {
          id: "auto_backup",
          name: "Автоматик резервкопи",
          description: "Өдөр бүр автоматаар системийн резервкопи үүсгэх",
          value: true,
          type: "toggle",
        },
        {
          id: "max_users",
          name: "Хэрэглэгчийн дээд хязгаар",
          description: "Систем дээр бүртгүүлж болох хэрэглэгчийн хамгийн их тоо",
          value: "10000",
          type: "number",
        },
        {
          id: "session_timeout",
          name: "Сеанс таслагдах хугацаа (минут)",
          description: "Идэвхгүй байдлын дараа сеанс таслагдах хугацаа",
          value: "30",
          type: "number",
        },
        {
          id: "password_expiry",
          name: "Нууцлалын хүчинтэй хугацаа (өдөр)",
          description: "Нууцлалыг өөрчлөхийг албаддаг өдрийн тоо",
          value: "90",
          type: "number",
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      setLoading(false);
    }
  };

  const handleSettingChange = (id: string, newValue: string | boolean) => {
    setSettings(settings.map((s) => (s.id === id ? { ...s, value: newValue } : s)));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    setSaveStatus("saving");
    try {
      // Simulated save
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveStatus("saved");
      setHasChanges(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("idle");
    }
  };

  const handleResetSettings = () => {
    if (!confirm("Бүх тохиргоог анхны төлөвтөй буцаах уу?")) return;
    fetchSettings();
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {hasChanges && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-amber-300 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>Хэсэг тохиргоо өөрчлөгдсөн. Сохранить хийх шаардлагатай.</span>
        </div>
      )}

      {saveStatus === "saved" && (
        <div className="rounded-lg border border-green-500/25 bg-green-500/10 p-4 text-green-300 flex items-center gap-3">
          <span>✓ Тохиргоо амжилттай хэмжээнээ хойругдлаа</span>
        </div>
      )}

      {/* General Settings */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
        <h2 className="mb-6 flex items-center gap-3 text-lg font-black text-white">
          <Settings size={22} className="text-slate-300" />
          Ерөнхий Тохиргоо
        </h2>

        <div className="space-y-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex-1">
                <p className="font-bold text-white">{setting.name}</p>
                <p className="text-sm text-slate-400">{setting.description}</p>
              </div>

              <div className="ml-4">
                {setting.type === "toggle" ? (
                  <button
                    onClick={() =>
                      handleSettingChange(setting.id, !setting.value)
                    }
                    className={`relative inline-flex h-8 w-14 rounded-full border-2 transition-colors ${
                      setting.value
                        ? "border-emerald-500 bg-emerald-500/20"
                        : "border-white/10 bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform ${
                        setting.value ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                ) : (
                  <input
                    type={setting.type === "number" ? "number" : "text"}
                    value={String(setting.value)}
                    onChange={(e) =>
                      handleSettingChange(
                        setting.id,
                        setting.type === "number"
                          ? e.target.value
                          : e.target.value
                      )
                    }
                    className="h-10 w-32 rounded-lg border border-white/10 bg-[#07101d] px-3 text-right font-bold text-white outline-none focus:border-red-500/50"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1424]/85 p-6">
        <h2 className="mb-6 text-lg font-black text-white">Дэвшилтэт Тохиргоо</h2>

        <div className="space-y-4">
          {[
            { name: "API Rate Limit", value: "1000" },
            { name: "Cache TTL (секунд)", value: "3600" },
            { name: "Max Upload Size (MB)", value: "100" },
            { name: "Database Backup Time", value: "02:00" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="font-bold text-white">{item.name}</p>
              <input
                type="text"
                defaultValue={item.value}
                className="h-10 w-32 rounded-lg border border-white/10 bg-[#07101d] px-3 text-right font-bold text-white outline-none focus:border-red-500/50"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveSettings}
          disabled={!hasChanges || saveStatus === "saving"}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-black text-white hover:bg-green-500 disabled:opacity-50"
        >
          <Save size={18} />
          {saveStatus === "saving" ? "Хэмжээнээ хойрулж байна..." : "Хэмжээнээ хойрулэх"}
        </button>

        <button
          onClick={handleResetSettings}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 font-black text-slate-300 hover:bg-white/[0.08]"
        >
          <RotateCcw size={18} />
          Дахин сэргээх
        </button>
      </div>
    </div>
  );
}

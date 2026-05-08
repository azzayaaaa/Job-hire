"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { compressImageDataUrl, compressImageFile, safeSetLocalStorage, loadFromIndexedDB } from "@/lib/imageStorage";

type CandidateProfileForm = {
  lastName: string;
  firstName: string;
  phone: string;
  age: string;
  gender: string;
  photo: string;
};

const emptyProfile: CandidateProfileForm = {
  lastName: "",
  firstName: "",
  phone: "",
  age: "",
  gender: "",
  photo: "",
};

async function loadProfile(userId: number): Promise<CandidateProfileForm> {
  if (typeof window === "undefined") return emptyProfile;
  try {
    // Try localStorage first
    const saved = localStorage.getItem(`userProfile_${userId}`);
    if (saved) return { ...emptyProfile, ...JSON.parse(saved) };
    
    // Fallback to IndexedDB
    const indexedDBData = await loadFromIndexedDB(`userProfile_${userId}`);
    if (indexedDBData) return { ...emptyProfile, ...JSON.parse(indexedDBData) };
    
    return emptyProfile;
  } catch {
    return emptyProfile;
  }
}

export default function ProfileModal({
  onClose,
  userId,
  onSaved,
}: {
  onClose: () => void;
  userId: number;
  onSaved?: (profile: {
    lastName: string;
    firstName: string;
    phone: string;
    age: string;
    gender: string;
    photo: string;
  }) => void;
}) {
  const [form, setForm] = useState<CandidateProfileForm>(emptyProfile);

  useEffect(() => {
    loadProfile(userId).then(profile => setForm(profile));
  }, [userId]);

  const handleCyrillicNameChange = (key: "lastName" | "firstName", value: string) => {
    const cyrillicOnly = value.replace(/[^А-Яа-яЁёӨөҮү\s-]/g, "");
    setForm((f) => ({ ...f, [key]: cyrillicOnly }));
  };

  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, phone: value.replace(/\D/g, "").slice(0, 8) }));
  };

  const handleAgeChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setForm((f) => ({ ...f, age: "" }));
      return;
    }

    setForm((f) => ({ ...f, age: String(Math.min(Number(digits), 99)) }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Зөвхөн зураг файл сонгоно уу.");
      e.target.value = "";
      return;
    }

    alert("Анхааруулга: Цээж зураг тод, нүүр бүтэн харагдсан, албан маягийн зураг байвал тохиромжтой.");

    try {
      const photo = await compressImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.65 });
      setForm((f) => ({ ...f, photo }));
    } catch {
      alert("Зураг боловсруулахад алдаа гарлаа. Өөр зураг сонгоно уу.");
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.lastName.trim() || !form.firstName.trim()) {
      alert("Овог, нэрээ кирилл үсгээр бөглөнө үү.");
      return;
    }

    if (!/^[А-Яа-яЁёӨөҮү\s-]+$/.test(form.lastName) || !/^[А-Яа-яЁёӨөҮү\s-]+$/.test(form.firstName)) {
      alert("Овог, нэр зөвхөн кирилл үсэг байх ёстой.");
      return;
    }

    if (form.phone && !/^\d{8}$/.test(form.phone)) {
      alert("Утасны дугаар яг 8 оронтой тоо байх ёстой.");
      return;
    }

    if (form.age && Number(form.age) > 99) {
      alert("Нас 99-өөс их байж болохгүй.");
      return;
    }

    const storageKey = `userProfile_${userId}`;
    let nextForm = form;
    
    // Aggressive compression for storage
    if (form.photo?.startsWith("data:image/")) {
      try {
        nextForm = {
          ...form,
          photo: await compressImageDataUrl(form.photo, { maxWidth: 400, maxHeight: 400, quality: 0.60 }),
        };
        setForm(nextForm);
      } catch {}
    }

    const saved = await safeSetLocalStorage(storageKey, JSON.stringify(nextForm));
    if (!saved) {
      alert("Зураг хэт том байна. Бага хэмжээтэй JPG/PNG зураг сонгоно уу.");
      return;
    }
    onSaved?.(nextForm);
    alert("Хадгалагдлаа!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2535]">
          <p className="text-white font-semibold">Профайл бөглөх</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Цээж зураг */}
          <div className="flex items-center gap-4">
            <div
              onClick={() => document.getElementById("photoInput")?.click()}
              className="w-20 h-20 rounded-full bg-[#1a2035] border-2 border-dashed border-[#3b5bdb]/50 flex items-center justify-center overflow-hidden cursor-pointer shrink-0"
            >
              {form.photo ? (
                <img src={form.photo} className="w-full h-full object-cover" alt="profile" />
              ) : (
                <span className="text-[10px] text-[#4c6ef5] text-center leading-tight">
                  Зураг
                  <br />
                  оруулах
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-white font-medium mb-1">Цээж зураг</p>
              <p className="text-xs text-gray-500 mb-2">JPG, PNG дэмжинэ</p>
              <button
                onClick={() => document.getElementById("photoInput")?.click()}
                className="px-3 py-1.5 text-xs border border-[#1e2535] rounded-xl text-gray-400 hover:text-white transition-all"
              >
                Сонгох
              </button>
              <input
                id="photoInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>
          </div>

          {/* Овог, Нэр */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["lastName", "Овог"],
              ["firstName", "Нэр"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input
                  value={form[key as "lastName" | "firstName"]}
                  onChange={(e) => handleCyrillicNameChange(key as "lastName" | "firstName", e.target.value)}
                  placeholder={label}
                  className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#3b5bdb]/50"
                />
              </div>
            ))}
          </div>

          {/* Утас */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Утасны дугаар</label>
            <input
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="99xxxxxx"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#3b5bdb]/50"
            />
          </div>

          {/* Нас */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Нас</label>
            <input
              value={form.age}
              onChange={(e) => handleAgeChange(e.target.value)}
              placeholder="25"
              type="text"
              inputMode="numeric"
              maxLength={2}
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#3b5bdb]/50"
            />
          </div>

          {/* Хүйс */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">Хүйс</label>
            <div className="flex gap-2">
              {[
                ["male", "Эрэгтэй"],
                ["female", "Эмэгтэй"],
              ].map(([val, lbl]) => (
                <label
                  key={val}
                  className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-all ${
                    form.gender === val
                      ? "border-[#3b5bdb] bg-[#3b5bdb]/10 text-white"
                      : "border-[#1e2535] text-gray-400 hover:border-[#2a3550]"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={val}
                    checked={form.gender === val}
                    onChange={() => setForm((f) => ({ ...f, gender: val }))}
                    className="hidden"
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2 border-t border-[#1e2535]">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all"
            >
              Хадгалах
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
            >
              Цуцлах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

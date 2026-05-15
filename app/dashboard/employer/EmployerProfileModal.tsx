"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Mail, Phone, Globe, MapPin, Building2, FileText, ImagePlus, Lightbulb } from "lucide-react";
import { authenticatedFetch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { compressImageDataUrl, compressImageFile, safeSetLocalStorage } from "@/lib/imageStorage";
import { useAlert } from "@/components/AlertProvider";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const IMAGE_FILE_TYPE_MESSAGE = "Зөвхөн JPG, JPEG, PNG, WEBP зураг оруулж болно.";

const isAllowedImageFile = (file: File) => {
  const fileName = file.name.toLowerCase();
  return ALLOWED_IMAGE_TYPES.has(file.type) || ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
};

export default function EmployerProfileModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: number;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    website: "",
    location: "",
    description: "",
    logo: "",
  });
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  const loadProfileData = useCallback(async () => {
    try {
      // First try to load from localStorage with userId as key
      const localStorageKey = `employerProfile_${userId}`;
      const savedProfile = localStorage.getItem(localStorageKey);
      
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          setFormData(parsed);
          return;
        } catch (parseError) {
          console.error("Failed to parse saved profile:", parseError);
          localStorage.removeItem(localStorageKey);
        }
      }

      // If not in localStorage, fetch from backend
      const res = await authenticatedFetch(API_URLS.auth.profile(userId));
      if (res.data) {
        const profileData = {
          fullName: res.data.fullName || "",
          email: res.data.email || "",
          phone: res.data.phone || "",
          website: res.data.website || "",
          location: res.data.location || "",
          description: res.data.description || "",
          logo: res.data.logo || "",
        };
        setFormData(profileData);
        // Also save to localStorage for offline support
        safeSetLocalStorage(localStorageKey, JSON.stringify(profileData));
      }
    } catch (error) {
      console.error("Profile load error:", error);
    }
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    loadProfileData();
  }, [userId, loadProfileData]);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      showAlert(IMAGE_FILE_TYPE_MESSAGE, "warning");
      e.target.value = "";
      return;
    }

    try {
      const logo = await compressImageFile(file, { maxWidth: 700, maxHeight: 700, quality: 0.78 });
      setFormData((prev) => ({ ...prev, logo }));
    } catch {
      showAlert("Зураг боловсруулахад алдаа гарлаа.", "error");
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const localStorageKey = `employerProfile_${userId}`;
      let nextFormData = formData;
      
      // Compress large logo if needed
      if (formData.logo?.startsWith("data:image/") && formData.logo.length > 500_000) {
        try {
          nextFormData = {
            ...formData,
            logo: await compressImageDataUrl(formData.logo, { maxWidth: 700, maxHeight: 700, quality: 0.72 }),
          };
          setFormData(nextFormData);
        } catch {}
      }
      
      // Save full profile to localStorage (all 7 fields)
      const savedLocal = safeSetLocalStorage(localStorageKey, JSON.stringify(nextFormData));
      if (!savedLocal) {
        showAlert("Компанийн зураг хэт том байна. Өөр зураг сонгоно уу.", "warning");
        setLoading(false);
        return;
      }
      
      // Send to backend (all employer profile fields)
      try {
        await authenticatedPost(API_URLS.auth.updateProfile(), {
          userId,
          fullName: nextFormData.fullName,
          email: nextFormData.email,
          phone: nextFormData.phone,
          website: nextFormData.website,
          location: nextFormData.location,
          description: nextFormData.description,
          logo: nextFormData.logo,
        });
      } catch (backendError) {
        console.warn("Backend save partial failure (local data saved):", backendError);
      }
      
      showAlert("Профайл амжилттай хадгалагдлаа.", "success");
      onSaved?.();
    } catch (error) {
      console.error("Profile save error:", error);
      showAlert("Профайл хадгалах алдаа.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate field completion
  const getFieldStatus = (value: string) => {
    return value && value.trim().length > 0;
  };

  const completedFields = [
    getFieldStatus(formData.fullName),
    getFieldStatus(formData.email),
    getFieldStatus(formData.phone),
    getFieldStatus(formData.website),
    getFieldStatus(formData.location),
    getFieldStatus(formData.description),
    getFieldStatus(formData.logo),
  ].filter(Boolean).length;

  const completionPercent = Math.round((completedFields / 7) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#1e2535] bg-[#0d1117]">
          <div>
            <p className="text-white font-semibold text-lg">Компанийн мэдээлэл</p>
            <p className="text-sm text-gray-500">Ажил олгогчийн профайл засах</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Completion Progress */}
          <div className="bg-[#1a2035] border border-[#1e2535] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400">Профайлын бөглөлт</p>
              <p className="text-sm font-bold text-[#4c6ef5]">{completionPercent}%</p>
            </div>
            <div className="w-full h-2 bg-[#0d1117] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#3b5bdb] to-[#4c6ef5] transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {completedFields} / 7 хэсэг дүүргэгдсэн
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <ImagePlus size={14} className="text-[#4c6ef5]" />
              Компанийн зураг / лого
              {getFieldStatus(formData.logo) && <span className="text-green-500">✓</span>}
            </label>
            <div className="flex items-center gap-4 rounded-xl border border-[#1e2535] bg-[#1a2035] p-3">
              <button
                type="button"
                onClick={() => document.getElementById("companyLogoInput")?.click()}
                className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] flex items-center justify-center shrink-0"
              >
                {formData.logo ? (
                  <img src={formData.logo} alt="company" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={22} className="text-[#4c6ef5]" />
                )}
              </button>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Кандидат талын ажлын зар дээр компанийн profile зураг болж харагдана.</p>
                <button
                  type="button"
                  onClick={() => document.getElementById("companyLogoInput")?.click()}
                  className="mt-2 rounded-lg border border-[#2a3550] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white"
                >
                  Зураг сонгох
                </button>
              </div>
              <input id="companyLogoInput" type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={handleLogo} />
            </div>
          </div>
          {/* Company Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Building2 size={14} className="text-[#4c6ef5]" />
              Компанийн нэр
              {getFieldStatus(formData.fullName) && <span className="text-green-500">✓</span>}
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="ТечСолюшнс ООО"
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Mail size={14} className="text-[#4c6ef5]" />
              И-мэйл хаяг
              {getFieldStatus(formData.email) && <span className="text-green-500">✓</span>}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="hr@company.mn"
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Phone size={14} className="text-[#4c6ef5]" />
              Утасны дугаар
              {getFieldStatus(formData.phone) && <span className="text-green-500">✓</span>}
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+976 ХХХ-ХХХ-ХХХ"
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all"
            />
          </div>

          {/* Website */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Globe size={14} className="text-[#4c6ef5]" />
              Вебсайт
              {getFieldStatus(formData.website) && <span className="text-green-500">✓</span>}
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://company.mn"
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all"
            />
          </div>

          {/* Location */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <MapPin size={14} className="text-[#4c6ef5]" />
              Байршил
              {getFieldStatus(formData.location) && <span className="text-green-500">✓</span>}
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Улаанбаатар, Сүхбаатар дүүрэг"
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <FileText size={14} className="text-[#4c6ef5]" />
              Компанийн тайлбар
              {getFieldStatus(formData.description) && <span className="text-green-500">✓</span>}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Компанийн талаар кандидатуудад хэлэхийг хүсэж байгаа зүйл..."
              rows={4}
              className="w-full bg-[#1a2035] border border-[#1e2535] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 outline-none focus:border-[#3b5bdb]/50 transition-all resize-none"
            />
          </div>

          {/* Info message */}
          <div className="flex gap-3 bg-[#1a2035] border border-[#1e2535] rounded-xl p-4">
            <Lightbulb size={16} className="shrink-0 text-[#4c6ef5]" />
            <p className="text-xs text-gray-400">
              Энэ мэдээлэл бүх нийтлэгдсэн ажлын зарт кандидатуудад харагдана. Компанийн сайн төрх үлдээх мэдээлэл оруулна уу.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4 border-t border-[#1e2535]">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-2.5 bg-[#3b5bdb] text-white text-sm font-semibold rounded-xl hover:bg-[#4c6ef5] disabled:opacity-40 transition-all"
            >
              {loading ? "Хадгалаж байна..." : "Хадгалах"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#1e2535] text-gray-400 text-sm rounded-xl hover:text-white transition-all"
            >
              Цуцлах
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

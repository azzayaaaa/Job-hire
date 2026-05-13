'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Upload, Plus, X } from 'lucide-react';
import { API_URLS } from '@/lib/apiConfig';
import { authenticatedPost } from '@/lib/axiosClient';
import { useAlert } from '@/components/AlertProvider';

interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
}

interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface Education {
  school: string;
  degree: string;
  field: string;
  year: string;
}

interface CVFormProps {
  onCVGenerated: (htmlContent: string) => void;
  isLoading?: boolean;
  userId?: number | string;
}

export default function CVForm({ onCVGenerated, isLoading = false, userId }: CVFormProps) {
  const { showAlert } = useAlert();
  const [currentStep, setCurrentStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    phone: '',
    location: '',
    jobTitle: '',
  });

  const [experience, setExperience] = useState<Experience[]>([
    { company: '', position: '', startDate: '', endDate: '', description: '' },
  ]);

  const [education, setEducation] = useState<Education[]>([
    { school: '', degree: '', field: '', year: '' },
  ]);

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [photoError, setPhotoError] = useState('');

  const handlePersonalInfoChange = (field: keyof PersonalInfo, value: string) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleExperienceChange = (index: number, field: keyof Experience, value: string) => {
    const newExperience = [...experience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    setExperience(newExperience);
  };

  const handleEducationChange = (index: number, field: keyof Education, value: string) => {
    const newEducation = [...education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setEducation(newEducation);
  };

  const addExperience = () => {
    setExperience([...experience, { company: '', position: '', startDate: '', endDate: '', description: '' }]);
  };

  const removeExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const addEducation = () => {
    setEducation([...education, { school: '', degree: '', field: '', year: '' }]);
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('JPG эсвэл PNG зургийг л сонгоно уу');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Зураг 5MB-аас бага байх ёстой');
      return;
    }

    setPhotoError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!personalInfo.name || !personalInfo.email) {
      showAlert('Нэр болон имэйл хаяг заавал оруулна уу', 'error');
      return;
    }

    try {
      if (userId) {
        try {
          await authenticatedPost(API_URLS.user.useEntitlement(userId), { feature: 'aiCv' });
        } catch (entitlementError: unknown) {
          if ((entitlementError as { response?: { status?: number } })?.response?.status === 402) {
            showAlert('Free эрхээр AI CV 1 удаа үүсгэнэ. Pro эрх 10,000₮/сар бөгөөд profile/settings дээрээс түвшин ахиулж хязгааргүй ашиглана.', 'info');
            return;
          }
          throw entitlementError;
        }
      }

      const response = await fetch(API_URLS.ai.generateCv(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo,
          experience: experience.filter(exp => exp.company || exp.position),
          education: education.filter(edu => edu.school || edu.degree),
          skills,
          profilePhotoBase64: profilePhoto || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'CV үүсгэхэд алдаа гарлаа');
      }

      const data = await response.json();
      onCVGenerated(data.htmlContent);
    } catch (error: any) {
      showAlert(error.message || 'CV үүсгэхэд алдаа гарлаа', 'error');
    }
  };

  const isStep1Valid = personalInfo.name && personalInfo.email;
  const isStep2Valid = experience.some(exp => exp.company || exp.position);
  const isStep3Valid = education.some(edu => edu.school || edu.degree);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Step Indicator */}
      <div className="flex justify-between mb-8">
        {[1, 2, 3, 4, 5].map(step => (
          <div
            key={step}
            className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all ${
              step === currentStep
                ? 'bg-blue-600 text-white'
                : step < currentStep
                ? 'bg-green-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}
          >
            {step}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Info */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Хувийн мэдээлэл</h2>
          <input
            type="text"
            placeholder="Нэр"
            value={personalInfo.name}
            onChange={e => handlePersonalInfoChange('name', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Имэйл"
            value={personalInfo.email}
            onChange={e => handlePersonalInfoChange('email', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Утас"
            value={personalInfo.phone}
            onChange={e => handlePersonalInfoChange('phone', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Байршил"
            value={personalInfo.location}
            onChange={e => handlePersonalInfoChange('location', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Ажилын мэргэжил"
            value={personalInfo.jobTitle}
            onChange={e => handlePersonalInfoChange('jobTitle', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Step 2: Work Experience */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ажлын туршлага</h2>
          {experience.map((exp, idx) => (
            <div key={idx} className="p-4 border border-gray-300 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">Ажлын байр {idx + 1}</h3>
                {experience.length > 1 && (
                  <button
                    onClick={() => removeExperience(idx)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Компани"
                value={exp.company}
                onChange={e => handleExperienceChange(idx, 'company', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Байр"
                value={exp.position}
                onChange={e => handleExperienceChange(idx, 'position', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="month"
                  placeholder="Эхлэх сар"
                  value={exp.startDate}
                  onChange={e => handleExperienceChange(idx, 'startDate', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="month"
                  placeholder="Дуусгах сар"
                  value={exp.endDate}
                  onChange={e => handleExperienceChange(idx, 'endDate', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="Үүргүүд ба амжилтууд"
                value={exp.description}
                onChange={e => handleExperienceChange(idx, 'description', e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={addExperience}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} /> Нэмэх
          </button>
        </div>
      )}

      {/* Step 3: Education */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Боловсрол</h2>
          {education.map((edu, idx) => (
            <div key={idx} className="p-4 border border-gray-300 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">Боловсрол {idx + 1}</h3>
                {education.length > 1 && (
                  <button
                    onClick={() => removeEducation(idx)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Сургууль"
                value={edu.school}
                onChange={e => handleEducationChange(idx, 'school', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Зэрэг"
                value={edu.degree}
                onChange={e => handleEducationChange(idx, 'degree', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Чиглэл"
                value={edu.field}
                onChange={e => handleEducationChange(idx, 'field', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Жил"
                value={edu.year}
                onChange={e => handleEducationChange(idx, 'year', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={addEducation}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} /> Нэмэх
          </button>
        </div>
      )}

      {/* Step 4: Skills */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ур чадвар</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ур чадвар нэмэх (жнь: React, Python)"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addSkill()}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addSkill}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Нэмэх
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
              >
                {skill}
                <button
                  onClick={() => removeSkill(idx)}
                  className="text-blue-800 hover:text-blue-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Profile Photo */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Профайлын зураг</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            {profilePhoto ? (
              <div className="space-y-4">
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-32 h-32 object-cover rounded-full mx-auto"
                />
                <button
                  onClick={() => setProfilePhoto('')}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Солих
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <Upload size={32} className="text-gray-400 mb-2" />
                <span className="text-gray-600 font-medium">Зургийг сонгоно уу</span>
                <span className="text-sm text-gray-500">JPG эсвэл PNG (5MB хүртэл)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {photoError && <div className="text-red-600 text-sm">{photoError}</div>}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} /> Буцах
        </button>

        {currentStep === 5 ? (
          <button
            onClick={handleSubmit}
            disabled={isLoading || !isStep1Valid}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? 'CV бэлтгэж байна...' : 'CV Үүсгэх'}
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Дараа <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

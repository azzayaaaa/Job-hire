'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Upload, Plus, X } from 'lucide-react';
import { API_URLS } from '@/lib/apiConfig';

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
}

export default function CVForm({ onCVGenerated }: CVFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
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
      alert('Нэр болон имэйл хаяг заавал оруулна уу');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        personalInfo,
        experience: experience.filter(exp => exp.company || exp.position),
        education: education.filter(edu => edu.school || edu.degree),
        skills,
        profilePhotoBase64: profilePhoto ? profilePhoto.split(',')[1] : null, // Remove data:image/... prefix
      };

      console.log('📤 CV sending data:', payload);
      console.log('🔗 API URL:', API_URLS.ai.generateCv());

      const response = await fetch(API_URLS.ai.generateCv(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: CV үүсгэхэд алдаа гарлаа`);
      }

      const data = await response.json();
      console.log('✅ CV generated successfully, content length:', data.htmlContent?.length);
      onCVGenerated(data.htmlContent);
    } catch (error: any) {
      console.error('🔴 Submit error:', error);
      alert(error.message || 'CV үүсгэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = personalInfo.name && personalInfo.email;
  const isStep2Valid = experience.some(exp => exp.company || exp.position);
  const isStep3Valid = education.some(edu => edu.school || edu.degree);

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl">
      {/* Step Indicator */}
      <div className="flex justify-between mb-10">
        {[1, 2, 3, 4, 5].map(step => (
          <div
            key={step}
            className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg transition-all cursor-pointer ${
              step === currentStep
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : step < currentStep
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
            onClick={() => step <= currentStep && setCurrentStep(step)}
            title={`Step ${step}`}
          >
            {step < currentStep ? '✓' : step}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${(currentStep / 5) * 100}%` }}
        />
      </div>

      {/* Step 1: Personal Info */}
      {currentStep === 1 && (
        <div className="space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Хувийн мэдээлэл</h2>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Нэр</label>
            <input
              type="text"
              placeholder="Өөрийнхөө нэрээ оруулна уу..."
              value={personalInfo.name}
              onChange={e => handlePersonalInfoChange('name', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Имэйл хаяг</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={personalInfo.email}
              onChange={e => handlePersonalInfoChange('email', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Утасны дугаар</label>
            <input
              type="tel"
              placeholder="+976 XXXX XXXX"
              value={personalInfo.phone}
              onChange={e => handlePersonalInfoChange('phone', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Байршил</label>
            <input
              type="text"
              placeholder="Улаанбаатар, Монгол"
              value={personalInfo.location}
              onChange={e => handlePersonalInfoChange('location', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ажилын мэргэжил</label>
            <input
              type="text"
              placeholder="жишээ: Frontend Developer, Product Manager..."
              value={personalInfo.jobTitle}
              onChange={e => handlePersonalInfoChange('jobTitle', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
          </div>
        </div>
      )}

      {/* Step 2: Work Experience */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Ажлын туршлага</h2>
          {experience.map((exp, idx) => (
            <div key={idx} className="p-5 border-2 border-gray-200 rounded-xl space-y-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Ажлын байр {idx + 1}</h3>
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
                placeholder="Компани нэр (жишээ: Google, Microsoft)"
                value={exp.company}
                onChange={e => handleExperienceChange(idx, 'company', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
              <input
                type="text"
                placeholder="Албан тушаал (жишээ: Frontend Developer)"
                value={exp.position}
                onChange={e => handleExperienceChange(idx, 'position', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="month"
                  value={exp.startDate}
                  onChange={e => handleExperienceChange(idx, 'startDate', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
                />
                <input
                  type="month"
                  value={exp.endDate}
                  onChange={e => handleExperienceChange(idx, 'endDate', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
                />
              </div>
              <textarea
                placeholder="Үүргүүд ба амжилтууд (жишээ: Сайт хөгжүүлэх, баг удирдах...)"
                value={exp.description}
                onChange={e => handleExperienceChange(idx, 'description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
            </div>
          ))}
          <button
            onClick={addExperience}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} /> Нэмэх
          </button>
        </div>
      )}

      {/* Step 3: Education */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Боловсрол</h2>
          {education.map((edu, idx) => (
            <div key={idx} className="p-5 border-2 border-gray-200 rounded-xl space-y-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Боловсрол {idx + 1}</h3>
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
                placeholder="Сургуульийн нэр (жишээ: Монгол Улсын Их Сургууль)"
                value={edu.school}
                onChange={e => handleEducationChange(idx, 'school', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
              <input
                type="text"
                placeholder="Зэрэг (жишээ: Бакалавр, Магистр)"
                value={edu.degree}
                onChange={e => handleEducationChange(idx, 'degree', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
              <input
                type="text"
                placeholder="Мэргэжлийн чиглэл (жишээ: Компьютерийн ухаан)"
                value={edu.field}
                onChange={e => handleEducationChange(idx, 'field', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
              <input
                type="number"
                placeholder="Дүүргэсэн жил"
                value={edu.year}
                onChange={e => handleEducationChange(idx, 'year', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
            </div>
          ))}
          <button
            onClick={addEducation}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} /> Нэмэх
          </button>
        </div>
      )}

      {/* Step 4: Skills */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Ур чадвар</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ур чадвар оруулна уу (жишээ: React, Python, UI Design)"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
            <button
              onClick={addSkill}
              disabled={!skillInput.trim()}
              className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => (
              <div
                key={idx}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full flex items-center gap-2 text-sm font-medium"
              >
                {skill}
                <button
                  onClick={() => removeSkill(idx)}
                  className="text-blue-600 hover:text-red-600"
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
        <div className="space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Профайлын зураг</h2>
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-2xl p-10 transition-colors">
            {profilePhoto ? (
              <div className="space-y-5">
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-40 h-40 object-cover rounded-full mx-auto border-4 border-blue-100"
                />
                <button
                  onClick={() => setProfilePhoto('')}
                  className="w-full px-5 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Өөр зураг сонгох
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <Upload size={48} className="text-gray-400 mb-3" />
                <span className="text-gray-800 font-semibold text-lg">Профайлын зургийг сонгоно уу</span>
                <span className="text-sm text-gray-500 mt-1">JPG эсвэл PNG (5MB хүртэл)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {photoError && <div className="text-red-600 text-sm font-medium">{photoError}</div>}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10 gap-4">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} /> Буцах
        </button>

        {currentStep === 5 ? (
          <button
            onClick={handleSubmit}
            disabled={loading || !isStep1Valid}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'CV бэлтгэж байна...' : '✓ CV Үүсгэх'}
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Дараа <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

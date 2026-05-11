"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import DashboardLayout from "../DashboardLayout";
import EmployerProfileModal from "./EmployerProfileModal";
import HomeView from "./HomeView";
import JobsView from "./JobsView";
import CandidatesView from "./CandidatesView";
import InterviewsView from "./InterviewsView";
import MessagesView from "./MessagesView";
import MessagesProfilePanel from "./MessagesProfilePanel";
import CVPreviewModal from "./CVPreviewModal";
import FloatingChat from "@/components/FloatingChat";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import NotificationCenter from "@/components/NotificationCenter";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import {
  Briefcase, Users, FileText, Eye,
  Loader2, X, Home, Calendar, MessageSquare,
  Settings, Bell, Search, MapPin, ChevronDown,
  Plus, LogOut, Sparkles, ImagePlus
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { notFound, useSearchParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { authenticatedFetch, authenticatedPost, authenticatedDelete, resetAxiosClient } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { compressImageFile, safeSetLocalStorage } from "@/lib/imageStorage";

function hydrateEmployerImages(jobs: any[]) {
  if (typeof window === "undefined") return jobs;
  return jobs.map((job) => {
    const localProfile = JSON.parse(localStorage.getItem(`employerProfile_${job.employerId}`) || "{}");
    return {
      ...job,
      jobImage: localStorage.getItem(`jobImage_${job.id}`) || job.jobImage || "",
      employerLogo: localProfile.logo || job.employerLogo || "",
      employer: job.employer ? { ...job.employer, logo: localProfile.logo || job.employer.logo || "" } : job.employer,
    };
  });
}

function formatSalary(value: number): string {
  if (value >= 1000000) return `${Math.round(value / 1000000)}М₮`;
  if (value >= 1000) return `${Math.round(value / 1000)}К₮`;
  return `${value}₮`;
}

function generateChartData(applications: any[]) {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const count    = applications.filter(
      a => new Date(a.createdAt) >= dayStart && new Date(a.createdAt) < dayEnd
    ).length;
    last7Days.push({ date: dateStr, value: count });
  }
  return last7Days;
}

export default function EmployerDashboard() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tab          = searchParams.get("tab") || "jobs";

  const [jobs, setJobs]                   = useState<any[]>([]);
  const [applications, setApplications]   = useState<any[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<any[]>([]);
  const [stats, setStats]                 = useState({ totalJobs: 0, totalApplications: 0 });
  const [credits, setCredits]             = useState(0);
  const [loading, setLoading]             = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showModal, setShowModal]         = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [selectedJob, setSelectedJob]     = useState<any>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [chartData, setChartData]         = useState<any[]>([]);
  const [employerProfile, setEmployerProfile] = useState<any>({});
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [processingApplicationId, setProcessingApplicationId] = useState<number | null>(null);
  const [chatSocket, setChatSocket]       = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [profileBubbleContact, setProfileBubbleContact] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollToChatInputRef = useRef<(() => void) | null>(null);

  const fetchInFlightRef = useRef(false);

  const [jobForm, setJobForm] = useState({
    title: "", description: "", requirements: "",
    location: "Улаанбаатар", salary: "", category: "IT",
    jobType: "FULL_TIME", experience: "1-3",
  });
  const [jobImage, setJobImage] = useState("");
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (!session?.user) return;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    try {
      setLoading(true);
      const userId = Number((session.user as any).id);
      
      // Use API gateway URLs instead of direct backend calls. Chat is optional,
      // so it should not block the rest of the employer dashboard.
      const [allJobsRes, userRes] = await Promise.all([
        authenticatedFetch(API_URLS.jobs.all()),
        authenticatedFetch(API_URLS.auth.profile(userId)),
      ]);

      let conversationsData: any[] = [];
      try {
        const convRes = await authenticatedFetch(API_URLS.chat.conversations(userId));
        conversationsData = convRes.data || [];
      } catch {
        conversationsData = [];
      }
      
      const empJobs = hydrateEmployerImages(allJobsRes.data.filter((j: any) => Number(j.employerId) === userId));
      setJobs(empJobs);
      setCredits(userRes.data.credits);
      setConversations(conversationsData);

      const applicationsData: any[] = [];
      for (const job of empJobs) {
        if (job.applications?.length > 0) applicationsData.push(...job.applications);
      }
      
      // Add small delay between sequential requests to avoid 429 rate limits
      if (applicationsData.length === 0 && empJobs.length > 0) {
        for (const job of empJobs) {
          try {
            const appRes = await authenticatedFetch(`${API_URLS.jobs.detail(job.id)}/applications`);
            applicationsData.push(...(appRes.data || []));
            // Add 100ms delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch {}
        }
      }
      
      setApplications(applicationsData);
      setNotificationCount(applicationsData.length);
      setChartData(generateChartData(applicationsData));
      const recent = applicationsData
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(app => ({
          ...app.candidate,
          appliedFor: app.job?.title || "Ажлын зар",
          appliedTime: app.createdAt,
          init: app.candidate?.fullName?.[0] || app.candidate?.email[0].toUpperCase() || "U",
        }));
      setRecentCandidates(recent);
      setStats({ totalJobs: empJobs.length, totalApplications: applicationsData.length });
      if (selectedJob) {
        const upd = empJobs.find((j: any) => j.id === selectedJob.id);
        if (upd) setSelectedJob(upd);
      }
    } catch (e) { console.error("Error fetching employer data:", e); }
    finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [session, selectedJob]);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [session, status]);

  const fetchProfileCompletion = useCallback(async () => {
    try {
      const userId = (session?.user as any)?.id;
      if (!userId) return;
      const res = await authenticatedFetch(API_URLS.auth.profile(userId));
      const localProfile =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem(`employerProfile_${userId}`) || "{}")
          : {};
      const profile = { ...(res.data || {}), ...localProfile };
      setEmployerProfile(profile);
      const fields = [profile.fullName, profile.email, profile.phone, profile.website, profile.location, profile.description, profile.logo];
      const filled = fields.filter(f => f && String(f).trim().length > 0).length;
      setProfileCompletion(Math.round((filled / fields.length) * 100));
    } catch (e) { console.error("Profile completion fetch error:", e); }
  }, [session]);

  useEffect(() => { if (session) fetchProfileCompletion(); }, [session, fetchProfileCompletion]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setJobs([]); setApplications([]); setRecentCandidates([]);
      setCredits(0); setConversations([]); setSelectedContact(null);
      setSelectedJob([]); setChartData([]); setEmployerProfile({});
      setProfileCompletion(0); setStats({ totalJobs: 0, totalApplications: 0 });
      localStorage.removeItem("employerSessionData");
      resetAxiosClient();
    }
  }, [status]);

  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [session, fetchData]);

  useEffect(() => {
    if (!session?.user) return;
    const socket = io(API_URLS.sockets.auth(), {
      reconnectionAttempts: 3,
      transports: ["websocket", "polling"],
    });
    socket.on("new-job-posted", () => { if (session?.user) fetchData(); });
    return () => {
      socket.disconnect();
    };
  }, [session, fetchData]);

  useEffect(() => {
    if (!session?.user) return;
    const socket = io(API_URLS.sockets.chat(), {
      reconnectionAttempts: 3,
      transports: ["websocket", "polling"],
    });
    setChatSocket(socket);
    socket.on("connect", () => socket.emit("join-room", (session?.user as any).id));
    return () => { setChatSocket(null); socket?.disconnect(); };
  }, [session]);

  const addConversationOptimistically = (candidate: any) => {
    if (!candidate?.id) return;
    setConversations(prev => {
      const candidateId = Number(candidate.id);
      if (prev.some((conv: any) => Number(conv.participantId ?? conv.id) === candidateId)) return prev;
      return [{
        id: candidateId, participantId: candidateId,
        participantEmail: candidate.email, participantName: candidate.fullName,
        email: candidate.email, fullName: candidate.fullName,
        lastMessage: "Чат эхлүүлэхэд бэлэн",
      }, ...prev];
    });
  };

  const handleOpenProfileBubble = (contact: any) => {
    if (!contact?.id) return;
    setProfileBubbleContact(contact);
  };

  const handleProfileBubbleChat = () => {
    if (!profileBubbleContact?.id) return;
    setSelectedContact(profileBubbleContact);
    router.push("?tab=messages");
    setProfileBubbleContact(null);
    window.requestAnimationFrame(() => {
      scrollToChatInputRef.current?.();
    });
  };

  const handleOpenJobModal = () => {
    if (profileCompletion < 100) {
      alert("Ажлын зар оруулахын өмнө компанийн профайлаа 100% бөглөнө үү.");
      setShowProfile(true);
      return;
    }
    setShowModal(true);
  };

  const handleJobImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Зөвхөн зураг файл сонгоно уу.");
      e.target.value = "";
      return;
    }

    try {
      const image = await compressImageFile(file, { maxWidth: 1200, maxHeight: 800, quality: 0.78 });
      setJobImage(image);
    } catch {
      alert("Зураг боловсруулахад алдаа гарлаа.");
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (profileCompletion < 100) {
      alert("Ажлын зар оруулахын өмнө компанийн профайлаа 100% бөглөнө үү.");
      setShowProfile(true);
      return;
    }
    try {
      const created = await authenticatedPost(API_URLS.jobs.create(), {
        ...jobForm, employerId: (session?.user as any).id, image: jobImage,
      });
      if (jobImage && created.data?.id) {
        safeSetLocalStorage(`jobImage_${created.data.id}`, jobImage);
      }
      setShowModal(false);
      setJobImage("");
      setJobForm({
        title: "", description: "", requirements: "",
        location: "Улаанбаатар", salary: "", category: "IT",
        jobType: "FULL_TIME", experience: "1-3",
      });
      fetchData();
    } catch { alert("Алдаа гарлаа"); }
  };

  const handleApproveCandidate = async (applicationId: number) => {
    let approvedContact: any = null;
    try {
      setProcessingApplicationId(applicationId);
      const res = await authenticatedPost(
        API_URLS.jobs.applicationStatus(applicationId),
        { status: "APPROVED" }
      );
      const application = res.data?.application || applications.find(a => a.id === applicationId);
      if (application?.candidate) {
        const contact = {
          id: application.candidate.id, email: application.candidate.email,
          fullName: application.candidate.fullName, phone: application.candidate.phone,
        };
        setApplications(prev => prev.map(app => app.id === applicationId ? { ...app, status: "APPROVED" } : app));
        approvedContact = contact;
        setSelectedContact(contact);
        addConversationOptimistically(contact);
        setSelectedCandidate(null);
      }
      await fetchData();
      if (approvedContact) addConversationOptimistically(approvedContact);
    } catch (e) { console.error("Failed to approve:", e); alert("Алдаа гарлаа"); }
    finally { setProcessingApplicationId(null); }
  };

  const handleRejectCandidate = async (applicationId: number) => {
    try {
      setProcessingApplicationId(applicationId);
      await authenticatedPost(API_URLS.jobs.applicationStatus(applicationId), { status: "REJECTED" });
      setApplications(prev => prev.map(app => app.id === applicationId ? { ...app, status: "REJECTED" } : app));
      setSelectedCandidate((prev: any) =>
        prev?.applicationId === applicationId ? { ...prev, applicationStatus: "REJECTED" } : prev
      );
      await fetchData();
    } catch (e) { console.error("Failed to reject:", e); alert("Алдаа гарлаа"); }
    finally { setProcessingApplicationId(null); }
  };

  if (status === "loading") return (
    <div className="h-screen flex items-center justify-center bg-[#050810]">
      <Loader2 className="animate-spin text-[#4F67FF]" size={32} />
    </div>
  );
  if (!session || (session.user as any).userType !== "EMPLOYER") return notFound();

  return (
    <DashboardLayout role="employer">
      <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-[220px] min-w-[220px] bg-[#0d1426] border-r border-white/[0.06] flex flex-col py-4 px-3 gap-1 hidden lg:flex">
          <div className="flex items-center gap-2.5 px-3 py-3 mb-4">
            <div className="w-8 h-8 bg-[#4F67FF] rounded-lg flex items-center justify-center font-black text-sm text-white">H</div>
            <span className="text-white font-black text-base tracking-tight">JobHub</span>
          </div>
          {[
            { label: "Нүүр хуудас", icon: <Home size={15} />,          key: "home" },
            { label: "Ажлын байр",  icon: <Briefcase size={15} />,     key: "jobs" },
            { label: "Кандидатууд", icon: <Users size={15} />,         key: "candidates" },
            { label: "Ярилцлага",   icon: <Calendar size={15} />,      key: "interviews" },
            { label: "Мессежүүд",   icon: <MessageSquare size={15} />, key: "messages" },
          ].map(item => (
            <button key={item.key} onClick={() => router.push(`?tab=${item.key}`)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all text-left w-full ${
                tab === item.key ? "bg-[#4F67FF]/10 text-[#4F67FF]" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {item.icon}{item.label}
            </button>
          ))}
          <div className="mt-auto">
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all w-full"
            >
              <Settings size={15} /> Тохиргоо
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="min-h-[60px] bg-[#0d1426] border-b border-white/[0.06] flex items-center px-3 md:px-6 gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 flex-1 max-w-[440px] bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2">
              <Search size={13} className="text-white/30 shrink-0" />
              <input placeholder="Ажлын байр, үр чадвар, компани хайх..." className="bg-transparent text-[12px] text-white outline-none w-full placeholder:text-white/25" />
              <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg px-2 py-1 cursor-pointer shrink-0">
                <MapPin size={10} className="text-white/40" />
                <span className="text-[10px] text-white/40">Бүх байршил</span>
                <ChevronDown size={10} className="text-white/30" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <NotificationCenter />
              <div className="relative">
                <div onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5 cursor-pointer hover:bg-white/[0.07] transition-all"
                >
                  <div className="w-6 h-6 bg-[#4F67FF] rounded-lg flex items-center justify-center text-[10px] font-black text-white overflow-hidden">
                    {employerProfile?.logo ? (
                      <img src={employerProfile.logo} alt="company" className="h-full w-full object-cover" />
                    ) : (
                      employerProfile?.fullName?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white leading-none">{employerProfile?.fullName || "Компани"}</p>
                    <p className="text-[9px] text-white/35 leading-none mt-0.5">Ажил олгогч</p>
                  </div>
                  <ChevronDown size={11} className="text-white/30 ml-1" />
                </div>
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a2635] border border-[#1e2535] rounded-xl shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-[#1e2535]">
                      <p className="text-xs text-white/60">И-мэйл хаяг</p>
                      <p className="text-sm font-semibold text-white truncate">{session?.user?.email}</p>
                    </div>
                    <button onClick={() => { setShowProfile(true); setIsProfileDropdownOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/[0.05] transition-all"
                    >Профайл засах</button>
                    <button onClick={() => { setShowSettings(true); setIsProfileDropdownOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/[0.05] transition-all"
                    >Тохиргоо</button>
                    <button onClick={() => signOut({ callbackUrl: "/login" })}
                      className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-all border-t border-[#1e2535] flex items-center gap-2"
                    ><LogOut size={14} /> Гарах</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto pb-24 ${tab === "messages" ? "p-0 md:p-4 xl:p-6" : "p-3 md:p-4 xl:p-6"}`}>
            {profileCompletion < 100 && (
              <div className="mb-6 bg-[#1a2035]/60 border border-[#3b5bdb]/30 rounded-2xl p-4 backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-2">📋 Компанийн профайл {profileCompletion}% бөглөгдсөн</p>
                    <div className="w-full h-2 bg-[#1e2535] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#3b5bdb] to-[#4c6ef5] transition-all duration-300" style={{ width: `${profileCompletion}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Профайл бөглөхөөр кандидатуудад сайн үлгүүлнэ</p>
                  </div>
                  <button onClick={() => setShowProfile(true)}
                    className="px-4 py-2 bg-[#3b5bdb] text-white text-xs font-semibold rounded-xl hover:bg-[#4c6ef5] transition-all whitespace-nowrap"
                  >Профайл засах</button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-[22px] font-black text-white leading-tight break-words">
                  Тавтай морил, {employerProfile?.fullName || session?.user?.email} 👋
                </h1>
                <p className="text-[12px] text-white/35 mt-1">Өнөөдрийн ажлын зар, кандидатуудын тойм</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAiOpen(true)}
                  className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-white font-black text-[12px] px-4 py-3 rounded-xl transition-all"
                >
                  <Sparkles size={15} /> AI
                </button>
                <button onClick={handleOpenJobModal}
                  className="flex items-center gap-2 bg-[#4F67FF] hover:bg-[#3d52e0] text-white font-black text-[12px] px-4 sm:px-5 py-3 rounded-xl transition-all shadow-lg shadow-[#4F67FF]/20"
                ><Plus size={15} /> Ажлын байр нэмэх</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
              <StatCard label="Идэвхтэй ажлын байр" value={jobs.filter(j => j.status === "ACTIVE").length} sub="Бүх идэвхтэй зарууд" subColor="#10B981" color="#4F67FF" bg="#4F67FF" icon={<Briefcase size={20} />} />
              <StatCard label="Нийт анкет" value={applications.length} sub={`${applications.length} нийт сонгогдсон`} subColor="#10B981" color="#10B981" bg="#10B981" icon={<Users size={20} />} />
              <StatCard label="Үнэлэгдсэн" value={applications.filter(a => a.status === "REVIEWED").length} sub={`${((applications.filter(a => a.status === "REVIEWED").length / (applications.length || 1)) * 100).toFixed(0)}% үнэлэгдсэн`} subColor="#A855F7" color="#A855F7" bg="#A855F7" icon={<FileText size={20} />} />
              <StatCard label="Идэвхтэй ажил" value={jobs.length} sub={`${jobs.length} ажлын байр нийтлэгдсэн`} subColor="#F59E0B" color="#F59E0B" bg="#F59E0B" icon={<Eye size={20} />} />
            </div>

            <div className="flex flex-col gap-5 w-full">
              {tab === "home" && <HomeView jobs={jobs} applications={applications} chartData={chartData} credits={credits} />}
              {tab === "jobs" && <JobsView jobs={jobs} applications={applications} onSelectJob={setSelectedJob} />}
              {tab === "candidates" && (
                <CandidatesView
                  applications={applications} jobs={jobs}
                  onSelectCandidate={setSelectedCandidate}
                  onApproveCandidate={handleApproveCandidate}
                  onRejectCandidate={handleRejectCandidate}
                  processingApplicationId={processingApplicationId}
                />
              )}
              {tab === "interviews" && <InterviewsView />}
              {tab === "messages" && (
                <div ref={chatContainerRef} className="h-full">
                <MessagesView
                  conversations={conversations}
                  selectedContact={selectedContact}
                  onSelectContact={setSelectedContact}
                  senderId={(session?.user as any)?.id}
                  socket={chatSocket}
                  onOpenProfile={handleOpenProfileBubble}
                  onScrollToInputReady={(fn: () => void) => {
                    scrollToChatInputRef.current = fn;
                  }}
                />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FloatingChat />
      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        userId={(session?.user as any)?.id}
        role="employer"
      />

      {profileBubbleContact && (
        <MessagesProfilePanel
          contact={profileBubbleContact}
          onClose={() => setProfileBubbleContact(null)}
          chatContainerRef={chatContainerRef}
          scrollToInput={handleProfileBubbleChat}
        />
      )}

      {/* ── ADD JOB MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-[#0d1426] rounded-2xl border border-white/10 p-4 sm:p-6 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[16px] font-black text-white">Шинэ зар нэмэх</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <input value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50 placeholder:text-white/25" placeholder="Ажлын нэр" required />
            <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById("jobImageInput")?.click()}
                  className="h-16 w-24 overflow-hidden rounded-lg bg-[#0d1426] border border-white/10 flex items-center justify-center shrink-0"
                >
                  {jobImage ? (
                    <img src={jobImage} alt="job" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={20} className="text-[#4F67FF]" />
                  )}
                </button>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-white">Ажлын зарын зураг</p>
                  <p className="text-[11px] text-white/35">Кандидат дэлгэрэнгүй үзэхэд харагдана.</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("jobImageInput")?.click()}
                    className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:text-white"
                  >
                    Зураг сонгох
                  </button>
                </div>
                <input id="jobImageInput" type="file" accept="image/*" className="hidden" onChange={handleJobImage} />
              </div>
            </div>
            <div>
              <input value={jobForm.salary} onChange={e => setJobForm({ ...jobForm, salary: e.target.value })} type="number" className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50 placeholder:text-white/25" placeholder="Цалин (₮)" required />
              {jobForm.salary && <p className="text-[10px] text-[#4F67FF] mt-1 pl-1">→ {formatSalary(Number(jobForm.salary))}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={jobForm.category} onChange={e => setJobForm({ ...jobForm, category: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50" required>
                <option value="IT">IT / Технологи</option>
                <option value="Marketing">Маркетинг</option>
                <option value="Design">Дизайн</option>
                <option value="Finance">Санхүү</option>
                <option value="Sales">Борлуулалт</option>
                <option value="Operations">Үйл ажиллагаа</option>
              </select>
              <select value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50" required>
                <option value="Улаанбаатар">Улаанбаатар</option>
                <option value="Дархан">Дархан</option>
                <option value="Эрдэнэт">Эрдэнэт</option>
                <option value="Онлайн">Онлайн</option>
                <option value="Орон нутаг">Орон нутаг</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={jobForm.jobType} onChange={e => setJobForm({ ...jobForm, jobType: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50" required>
                <option value="FULL_TIME">Бүтэн цагийн</option>
                <option value="PART_TIME">Хагас цагийн</option>
                <option value="REMOTE">Гэрээс ажиллах</option>
                <option value="TEMPORARY">Түр хугацааны</option>
                <option value="INTERNSHIP">Дадлага</option>
              </select>
              <select value={jobForm.experience} onChange={e => setJobForm({ ...jobForm, experience: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50" required>
                <option value="0-1">0-1 жил</option>
                <option value="1-3">1-3 жил</option>
                <option value="3-5">3-5 жил</option>
                <option value="5+">5+ жил</option>
              </select>
            </div>
            <textarea value={jobForm.requirements} onChange={e => setJobForm({ ...jobForm, requirements: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50 placeholder:text-white/25 resize-none" placeholder="Тавигдах шаардлага" rows={2} required />
            <textarea value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl p-3.5 text-[12px] text-white outline-none focus:border-[#4F67FF]/50 placeholder:text-white/25 resize-none" placeholder="Тайлбар" rows={3} required />
            <button type="submit" className="w-full bg-[#4F67FF] hover:bg-[#3d52e0] text-white py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all">Нийтлэх</button>
          </form>
        </div>
      )}

      {/* ── EMPLOYER PROFILE MODAL ── */}
      {showProfile && (
        <EmployerProfileModal
          userId={(session?.user as any)?.id}
          onClose={() => setShowProfile(false)}
          onSaved={fetchProfileCompletion}
        />
      )}
      {showSettings && (
        <AccountSettingsModal
          userId={(session?.user as any)?.id}
          role="employer"
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── CV PREVIEW MODAL ── */}
      {selectedCandidate && (
        <CVPreviewModal
          cvData={selectedCandidate.cvText || selectedCandidate.cv || ""}
          cvFileName={selectedCandidate.cvFileName}
          candidateName={selectedCandidate.fullName || selectedCandidate.email || "Unknown"}
          onClose={() => setSelectedCandidate(null)}
          applicationStatus={selectedCandidate.applicationStatus}
          isProcessing={processingApplicationId === selectedCandidate.applicationId}
          onApprove={selectedCandidate.applicationId ? () => handleApproveCandidate(selectedCandidate.applicationId) : undefined}
          onReject={selectedCandidate.applicationId ? () => handleRejectCandidate(selectedCandidate.applicationId) : undefined}
        />
      )}


      {/* ── MOBILE BOTTOM NAV (Employer) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#0d1426] border-t border-white/[0.06]">
        <div className="grid grid-cols-5">
          {[
            { key: "home", label: "Нүүр", Icon: Home },
            { key: "jobs", label: "Ажлын байр", Icon: Briefcase },
            { key: "candidates", label: "Кандидат", Icon: Users },
            { key: "messages", label: "Чат", Icon: MessageSquare },
            { key: "interviews", label: "Ярилцлага", Icon: Calendar },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => router.push(`?tab=${key}`)}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-1 px-1.5 py-2 text-[11px] transition-all ${
                tab === key
                  ? "text-[#4F67FF]"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </DashboardLayout>
  );
}

function StatCard({ label, value, sub, subColor, color, bg, icon }: {
  label: string; value: string | number; sub: string;
  subColor: string; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${bg}15`, color: bg }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate">{label}</p>
        <h4 className="text-[26px] font-black leading-none mt-1" style={{ color }}>{value}</h4>
        <p className="text-[10px] font-semibold mt-1 break-words" style={{ color: subColor }}>{sub}</p>
      </div>
    </div>
  );
}

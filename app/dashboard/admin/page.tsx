"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import DashboardLayout from "../DashboardLayout";
import { 
  Users, 
  Briefcase, 
  ShieldAlert, 
  Loader2, 
  RefreshCcw, 
  Search, 
  Trash2, 
  Cpu, 
  HardDrive, 
  Activity, 
  ShieldCheck, 
  Sparkles,
  Lock
} from "lucide-react";
import { useSession } from "next-auth/react";
import { notFound, useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { io } from "socket.io-client";
import { authenticatedFetch, authenticatedPost, authenticatedDelete, resetAxiosClient } from "@/lib/axiosClient";

function AdminDashboardContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // URL-аас tab-ыг унших
  const currentTab = searchParams.get("tab") || "dashboard";
  const view = currentTab === "users" ? "users" : "dashboard";

  const fetchData = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [statsRes, usersRes] = await Promise.all([
        authenticatedFetch("http://localhost:5001/api/auth/admin/stats"),
        authenticatedFetch("http://localhost:5001/api/auth/admin/users")
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    
    if (status === "authenticated") {
      const s = session as any;
      const isAdmin = s?.user?.userType === "ADMIN" || s?.user?.email === "azzayabayartai07@gmail.com";
      const token = s?.user?.accessToken || s?.accessToken;

      if (isAdmin && token) {
        fetchData();
      } else {
        setLoading(false);
      }
    }
  }, [session, status]);

  const refreshInFlightRef = useRef(false);

  // Auto-refresh users/stats so admin changes appear without pressing the refresh button
  useEffect(() => {
    if (status !== "authenticated") return;

    const s = session as any;
    const isAdminNow =
      !!s?.user &&
      (s.user.userType === "ADMIN" || s.user.email === "azzayabayartai07@gmail.com");
    
    const token = s?.user?.accessToken || s?.accessToken;

    if (!isAdminNow || !token) return;

    const intervalMs = 3000; // 5s -> 3s for more "real-time" feel
    const id = window.setInterval(() => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      fetchData(true).finally(() => {
        refreshInFlightRef.current = false;
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [status, session]);

  // Socket.io for real-time updates
  useEffect(() => {
    const s = session as any;
    const isAdmin = s?.user?.userType === "ADMIN" || s?.user?.email === "azzayabayartai07@gmail.com";
    if (!isAdmin) return;

    const socket = io("http://localhost:5001");
    
    socket.on("connect", () => {
      socket.emit("join-admin");
      console.log("Connected to Auth Socket as Admin");
    });

    socket.on("admin-data-updated", () => {
      console.log("Admin data updated event received");
      fetchData(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [session]);

  const handleUpdateCredits = async (userId: number, currentCredits: number) => {
    const newCredits = prompt("Шинэ кредит оруулна уу:", currentCredits.toString());
    if (newCredits === null) return;

    try {
      await authenticatedPost("http://localhost:5001/api/auth/admin/update-credits", {
        userId,
        credits: parseInt(newCredits)
      });
      alert("Амжилттай шинэчлэгдлээ");
      fetchData();
    } catch (error) {
      alert("Алдаа гарлаа");
    }
  };

  const handleUpdateRole = async (userId: number, currentRole: string) => {
    const newRole = prompt("Шинэ эрх оруулна уу (ADMIN, EMPLOYER, CANDIDATE):", currentRole);
    if (!newRole || newRole === currentRole) return;

    try {
      await authenticatedPost("http://localhost:5001/api/auth/admin/update-role", {
        userId,
        userType: newRole.toUpperCase()
      });
      alert("Амжилттай шинэчлэгдлээ");
      fetchData();
    } catch (error) {
      alert("Алдаа гарлаа");
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!confirm(`${email} хэрэглэгчийг устгахдаа итгэлтэй байна уу?`)) return;

    try {
      await authenticatedDelete(`http://localhost:5001/api/auth/admin/users/${userId}`);
      alert("Амжилттай устгагдлаа");
      fetchData();
    } catch (error) {
      alert("Устгахад алдаа гарлаа");
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleView = () => {
    const nextTab = view === "dashboard" ? "users" : "dashboard";
    router.push(`/dashboard/admin${nextTab === "users" ? "?tab=users" : ""}`);
  };

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050810]">
        <Loader2 className="animate-spin text-[#EF4444]" />
      </div>
    );
  }

  const isAdmin = session?.user && ((session.user as any).userType === "ADMIN" || session.user.email === "azzayabayartai07@gmail.com");

  if (!isAdmin && status === "authenticated") {
    return notFound();
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050810]">
        <Loader2 className="animate-spin text-[#EF4444]" />
      </div>
    );
  }

  return (
    <DashboardLayout role="admin">
      {/* Header Banner */}
      <div className="mb-6 md:mb-10 flex flex-col md:flex-row items-center justify-between bg-card p-6 md:p-10 rounded-[24px] md:rounded-[40px] border border-white/5 relative overflow-hidden group shadow-2xl glass-card">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#EF4444] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-3 md:mb-4">
            <span className="px-3 py-1 bg-[#EF4444]/10 text-[#EF4444] text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#EF4444]/20">System Administrator</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black mb-2 text-foreground tracking-tight leading-tight uppercase">
            {view === "dashboard" ? "Систем" : "Хэрэглэгчид"} <span className="text-[#EF4444]">{view === "dashboard" ? "Удирдлага" : "Жагсаалт"}</span>
          </h2>
          <p className="text-secondary-text text-xs md:text-sm max-w-md mx-auto md:mx-0 leading-relaxed">
            {view === "dashboard" ? "Системийн нөөц ашиглалт болон аюулгүй байдлын төлөв." : "Системийн нийт хэрэглэгчдийг удирдах, эрх болон кредитийг өөрчлөх."}
          </p>
        </div>
        <div className="flex gap-4 relative z-10 mt-6 md:mt-0">
          <button 
            onClick={toggleView} 
            className="px-6 py-3 bg-[#EF4444] text-white rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#EF4444]/20 hover:scale-105 transition-all"
          >
             {view === "dashboard" ? <Users size={16} /> : <Activity size={16} />}
             {view === "dashboard" ? "Хэрэглэгчид үзэх" : "Систем төлөв"}
          </button>
          <button
            onClick={() => fetchData(false)}
            title="Өгөгдөл шинэчлэх"
            aria-label="Өгөгдөл шинэчлэх"
            className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-secondary-text hover:text-foreground transition-all border border-white/5 hover:border-white/10 shadow-xl active:scale-90"
          >
             <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {view === "dashboard" ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
            <StatCard title="Нийт хэрэглэгчид" value={stats?.totalUsers || 0} icon={<Users size={18} />} color="#4F67FF" />
            <StatCard title="Идэвхтэй зар" value={stats?.activeJobs || 0} icon={<Briefcase size={18} />} color="#10B981" />
            <StatCard title="Системийн Лог" value={stats?.totalCreditsUsed || 124} icon={<Activity size={18} />} color="#F59E0B" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2 space-y-6">
              {/* System Security & Resource Section */}
              <div className="bg-card rounded-[32px] border border-white/5 p-8 shadow-2xl glass-card">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black flex items-center gap-3">
                      <Cpu size={22} className="text-[#EF4444]" /> Системийн Нөөц Ашиглалт
                    </h3>
                    <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-green-500/20 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                       System Stable
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <StatusProgress label="CPU Usage" percentage={32} color="#EF4444" icon={<Activity size={14}/>} />
                       <StatusProgress label="RAM Usage" percentage={58} color="#10B981" icon={<Activity size={14}/>} />
                       <StatusProgress label="Disk Storage" percentage={45} color="#4F67FF" icon={<HardDrive size={14}/>} />
                    </div>
                    <div className="bg-white/[0.02] rounded-[24px] border border-white/5 p-6 flex flex-col justify-center text-center">
                       <ShieldCheck size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
                       <h4 className="text-sm font-black mb-2 uppercase tracking-widest">Аюулгүй байдлын шалгалт</h4>
                       <p className="text-[10px] text-secondary-text mb-6">Сүүлийн шалгалт: 12 минутын өмнө. Алдаа олдсонгүй.</p>
                       <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">Scan Database</button>
                    </div>
                 </div>
              </div>

              {/* Security Logs placeholder */}
              <div className="bg-card rounded-[32px] border border-white/5 p-8 shadow-2xl glass-card">
                 <h3 className="text-xl font-black flex items-center gap-3 mb-6">
                    <Lock size={22} className="text-[#F59E0B]" /> Аюулгүй байдлын лог
                 </h3>
                 <div className="space-y-4">
                    {[
                      { msg: "Admin login successful", time: "2 mins ago", ip: "192.168.1.1" },
                      { msg: "User registration attempted", time: "15 mins ago", ip: "103.21.164.2" },
                      { msg: "Credit update performed", time: "1 hour ago", ip: "192.168.1.1" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                           <div>
                              <p className="text-xs font-bold text-foreground">{log.msg}</p>
                              <p className="text-[10px] text-secondary-text">{log.ip}</p>
                           </div>
                        </div>
                        <span className="text-[10px] font-medium text-secondary-text">{log.time}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="xl:col-span-1 space-y-6">
              <div className="bg-[#EF4444] p-8 rounded-[32px] text-white overflow-hidden relative group shadow-xl h-full flex flex-col justify-center">
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <h4 className="text-2xl font-black mb-3 relative z-10 uppercase tracking-tighter">Аюулгүй байдал</h4>
                <p className="text-white/80 text-xs mb-8 relative z-10 leading-relaxed font-medium">Системийн бүх логуудыг шалгаж, сэжигтэй үйлдлүүдийг эндээс хянах боломжтой.</p>
                <button className="bg-white text-[#EF4444] px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-2xl transition-all active:scale-95 relative z-10 w-fit">
                  Лог файл татах
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card rounded-[32px] border border-white/5 overflow-hidden shadow-2xl glass-card">
            <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <h3 className="text-xl font-black flex items-center gap-3">
                <Users size={24} className="text-[#EF4444]" /> Системийн Хэрэглэгчид
              </h3>
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" size={16} />
                 <input 
                    type="text" 
                    placeholder="Имэйлээр хайх..." 
                    className="bg-background border border-white/5 rounded-2xl pl-10 pr-6 py-3 text-sm outline-none focus:border-[#EF4444]/30 w-full sm:w-64 text-foreground" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-secondary-text text-[10px] font-black uppercase tracking-[0.2em] bg-white/[0.01]">
                    <th className="px-8 py-6">Хэрэглэгч</th>
                    <th className="px-8 py-6">Эрх</th>
                    <th className="px-8 py-6">Кредит</th>
                    <th className="px-8 py-6 text-right">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black border border-white/10 group-hover:border-[#EF4444]/30 transition-colors shrink-0">
                             {user.email[0].toUpperCase()}
                           </div>
                           <span className="font-bold text-foreground opacity-80 group-hover:text-foreground group-hover:opacity-100 truncate max-w-[200px]">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest ${
                          user.userType === 'ADMIN' ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20' :
                          user.userType === 'EMPLOYER' ? 'bg-[#4F67FF]/10 text-[#4F67FF] border border-[#4F67FF]/20' :
                          'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                        }`}>
                          {user.userType}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2">
                            <span className="font-black text-foreground text-lg">{user.credits}</span>
                            <Sparkles size={14} className="text-[#F59E0B]" />
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleUpdateCredits(user.id, user.credits)}
                            className="w-10 h-10 bg-white/5 rounded-xl text-secondary-text hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-all flex items-center justify-center"
                            title="Кредит өөрчлөх"
                          >
                            <Sparkles size={18} />
                          </button>
                          <button 
                            onClick={() => handleUpdateRole(user.id, user.userType)}
                            className="w-10 h-10 bg-white/5 rounded-xl text-secondary-text hover:text-[#4F67FF] hover:bg-[#4F67FF]/10 transition-all flex items-center justify-center"
                            title="Эрх солих"
                          >
                            <ShieldAlert size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="w-10 h-10 bg-white/5 rounded-xl text-secondary-text hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all flex items-center justify-center"
                            title="Устгах"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#050810]">
          <Loader2 className="animate-spin text-[#EF4444]" />
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-card p-8 rounded-[32px] border border-white/5 group hover:border-white/10 transition-all shadow-xl glass-card">
      <div className="flex items-center justify-between mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}10`, color }}>{icon}</div>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
      </div>
      <p className="text-secondary-text text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
      <h4 className="text-3xl font-black text-foreground">{value}</h4>
    </div>
  );
}

function StatusProgress({ label, percentage, color, icon }: any) {
  return (
    <div>
      <div className="flex justify-between mb-3 items-center">
        <div className="flex items-center gap-2">
           <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5" style={{ color }}>{icon}</div>
           <span className="text-[10px] font-black text-secondary-text uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-[10px] font-black" style={{ color }}>{percentage}%</span>
      </div>
      <div className="w-full bg-[#050810] h-2.5 rounded-full overflow-hidden border border-white/5 p-[2px]">
        <div className="h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

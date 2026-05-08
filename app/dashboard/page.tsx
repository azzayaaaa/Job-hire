"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.push("/login"); return; }

    if (status === "authenticated" && session?.user) {
      const userType = (session.user as any).userType?.toUpperCase();
      const email = session.user.email;

      if (email === "azzayabayartai07@gmail.com") {
        router.replace("/dashboard/admin");
        return;
      }

      if (userType === "ADMIN") router.replace("/dashboard/admin");
      else if (userType === "EMPLOYER") router.replace("/dashboard/employer");
      else if (userType === "CANDIDATE") router.replace("/dashboard/candidate");
      else router.replace("/dashboard/candidate");
    }
  }, [session, status, router]);
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#080D1D] text-white">
      <Loader2 className="w-10 h-10 animate-spin text-[#4F67FF] mb-4" />
      <p className="text-sm font-medium">Шилжүүлж байна, түр хүлээнэ үү...</p>
    </div>
  );
}
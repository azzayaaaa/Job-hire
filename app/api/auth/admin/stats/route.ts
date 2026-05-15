import { prisma } from "@/lib/prisma";
import { json } from "../../../_lib/response";

export async function GET() {
  const [totalUsers, activeJobs, users] = await Promise.all([
    prisma.user.count(),
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({
      where: { userType: "EMPLOYER" },
      select: { id: true, email: true, fullName: true, credits: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return json({
    totalUsers,
    activeJobs,
    totalCreditsUsed: 0,
    complaints: 0,
    recentCompanies: users.map((user) => ({
      id: user.id,
      name: user.fullName || user.email.split("@")[0],
      industry: "Technology",
      credits: user.credits || 0,
    })),
  });
}

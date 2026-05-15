import { prisma } from "@/lib/prisma";
import { error, json } from "../../../_lib/response";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      userType: true,
      credits: true,
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return json(users);
}

export async function DELETE(_request: Request) {
  return error("Use /api/auth/admin/users/:id", 400);
}

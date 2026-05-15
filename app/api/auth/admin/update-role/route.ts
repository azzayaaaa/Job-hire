import { prisma } from "@/lib/prisma";
import { json, readJson } from "../../../_lib/response";

export async function POST(request: Request) {
  const body = await readJson(request);
  const user = await prisma.user.update({
    where: { id: Number(body?.userId) },
    data: { userType: String(body?.userType || "CANDIDATE").toUpperCase() },
  });
  return json({ success: true, user });
}

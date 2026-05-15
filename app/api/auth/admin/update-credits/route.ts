import { prisma } from "@/lib/prisma";
import { json, readJson } from "../../../_lib/response";

export async function POST(request: Request) {
  const body = await readJson(request);
  const user = await prisma.user.update({
    where: { id: Number(body?.userId) },
    data: { credits: Number(body?.credits) },
  });
  return json({ success: true, user });
}

import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../_lib/response";
import { publicUserSelect } from "../../_lib/users";

export async function POST(request: Request) {
  const body = await readJson(request);
  const id = Number(body?.id || body?.userId);
  if (!Number.isInteger(id)) return error("id required", 400);

  const data: Record<string, unknown> = {};
  for (const key of ["fullName", "email", "phone", "website", "location", "description", "logo", "image", "cvText", "cvFileName", "skills"]) {
    if (typeof body?.[key] === "string") data[key] = body[key];
  }
  const user = await prisma.user.update({ where: { id }, data, select: publicUserSelect });
  return json(user);
}

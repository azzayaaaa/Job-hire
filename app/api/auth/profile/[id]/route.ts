import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../../_lib/response";
import { publicUserSelect } from "../../../_lib/users";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await prisma.user.findUnique({ where: { id: Number(id) }, select: publicUserSelect });
  if (!user) return error("User not found", 404);
  return json(user);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readJson(request);
  const data: Record<string, unknown> = {};
  for (const key of ["fullName", "email", "phone", "website", "location", "description", "logo", "image", "cvText", "cvFileName", "skills"]) {
    if (typeof body?.[key] === "string") data[key] = body[key];
  }
  const user = await prisma.user.update({ where: { id: Number(id) }, data, select: publicUserSelect });
  return json(user);
}

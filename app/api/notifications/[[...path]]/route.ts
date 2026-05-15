import { prisma } from "@/lib/prisma";
import { error, json, readJson } from "../../_lib/response";

export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const [userId, action] = path;
  if (!userId) return error("userId required", 400);

  if (action === "unread") {
    const count = await prisma.notification.count({ where: { receiverId: Number(userId), isRead: false } });
    return json({ count });
  }

  const notifications = await prisma.notification.findMany({
    where: { receiverId: Number(userId) },
    include: { sender: { select: { id: true, email: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json(notifications);
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const notification = await prisma.notification.create({
    data: {
      senderId: Number(body?.senderId),
      receiverId: Number(body?.receiverId),
      type: String(body?.type || "JOB_OFFER"),
      title: String(body?.title || "Notification"),
      message: String(body?.message || ""),
      link: body?.link ? String(body.link) : null,
    },
  });
  return json(notification, 201);
}

export async function PUT(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  const body = await readJson(request);
  if (path[1] === "read") {
    const notification = await prisma.notification.update({ where: { id: Number(path[0]) }, data: { isRead: true } });
    return json(notification);
  }
  if (path[1] === "preferences") {
    const user = await prisma.user.update({ where: { id: Number(path[0]) }, data: { emailNotifications: body?.emailNotifications !== false } });
    return json({ success: true, emailNotifications: user.emailNotifications });
  }
  return error(`Unknown notifications route: ${path.join("/")}`, 404);
}

export async function DELETE(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path || [];
  await prisma.notification.delete({ where: { id: Number(path[0]) } });
  return json({ success: true });
}

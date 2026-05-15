import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeMessage, getConversationPreview } from "../../_lib";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const currentUserId = Number(userId);

  if (!Number.isInteger(currentUserId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      },
      orderBy: { createdAt: "desc" },
    });

    const latestMessageByContactId = new Map<number, (typeof messages)[number]>();
    const unreadCountByContactId = new Map<number, number>();

    messages.forEach((message) => {
      const contactId = message.senderId !== currentUserId ? message.senderId : message.receiverId;
      if (!latestMessageByContactId.has(contactId)) {
        latestMessageByContactId.set(contactId, message);
      }
      if (message.receiverId === currentUserId && !message.isRead) {
        unreadCountByContactId.set(contactId, (unreadCountByContactId.get(contactId) || 0) + 1);
      }
    });

    const contactIds = Array.from(latestMessageByContactId.keys());
    const contacts = contactIds.length
      ? await prisma.user.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, email: true, fullName: true, phone: true, userType: true },
        })
      : [];

    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    const conversations = contactIds
      .map((contactId) => {
        const contact = contactById.get(contactId);
        const lastMessage = latestMessageByContactId.get(contactId);
        if (!contact) return null;

        return {
          id: contactId,
          participantId: contact.id,
          participantEmail: contact.email,
          participantName: contact.fullName,
          email: contact.email,
          fullName: contact.fullName,
          phone: contact.phone,
          userType: contact.userType,
          lastMessage: getConversationPreview(decodeMessage(lastMessage?.message || "")),
          lastMessageAt: lastMessage?.createdAt,
          unreadCount: unreadCountByContactId.get(contactId) || 0,
          isOnline: false,
          lastActiveAt: null,
        };
      })
      .filter(Boolean);

    return NextResponse.json(conversations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params;
  const parsedMessageId = Number(messageId);

  if (!Number.isInteger(parsedMessageId)) {
    return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
  }

  try {
    const existing = await prisma.chatMessage.findUnique({
      where: { id: parsedMessageId },
    });

    if (!existing) {
      return NextResponse.json({ success: true, skipped: true, reason: "Message not found" });
    }

    const message = await prisma.chatMessage.update({
      where: { id: existing.id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark message as seen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

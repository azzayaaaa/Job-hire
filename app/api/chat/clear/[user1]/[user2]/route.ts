import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ user1: string; user2: string }> },
) {
  const { user1, user2 } = await context.params;
  const firstUserId = Number(user1);
  const secondUserId = Number(user2);

  if (!Number.isInteger(firstUserId) || !Number.isInteger(secondUserId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: firstUserId, receiverId: secondUserId },
          { senderId: secondUserId, receiverId: firstUserId },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear chat";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

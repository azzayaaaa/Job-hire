import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatMessageForClient } from "../../../_lib";

export async function GET(
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
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: firstUserId, receiverId: secondUserId },
          { senderId: secondUserId, receiverId: firstUserId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages.map(formatMessageForClient));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chat history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

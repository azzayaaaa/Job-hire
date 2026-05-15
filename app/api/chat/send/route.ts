import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encodeMessage, formatMessageForClient } from "../_lib";
import { readJson } from "../../_lib/response";

export async function POST(request: Request) {
  const body = await readJson(request);
  const senderId = Number(body?.senderId);
  const receiverId = Number(body?.receiverId);
  const message = String(body?.message || "");

  if (!Number.isInteger(senderId) || !Number.isInteger(receiverId) || !message) {
    return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
  }

  try {
    const newMessage = await prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        message: encodeMessage(message, body?.replyToId, body?.replyPreview),
      },
    });

    return NextResponse.json(formatMessageForClient(newMessage), { status: 201 });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}

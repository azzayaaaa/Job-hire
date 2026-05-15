import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeMessage, encodeMessage } from "../../../_lib";
import { readJson } from "../../../../_lib/response";

export async function POST(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params;
  const body = await readJson(request);
  const parsedMessageId = Number(messageId);
  const parsedUserId = Number(body?.userId);
  const reaction = body?.reaction ? String(body.reaction).slice(0, 16) : null;

  if (!Number.isInteger(parsedMessageId) || !Number.isInteger(parsedUserId)) {
    return NextResponse.json({ error: "Invalid message or user ID" }, { status: 400 });
  }

  try {
    const existingMessage = await prisma.chatMessage.findUnique({
      where: { id: parsedMessageId },
      select: { message: true },
    });

    if (existingMessage) {
      const decoded = decodeMessage(existingMessage.message);
      await prisma.chatMessage.update({
        where: { id: parsedMessageId },
        data: {
          message: encodeMessage(
            decoded.text,
            decoded.replyToId,
            decoded.replyPreview,
            reaction,
            reaction ? parsedUserId : null,
          ),
        },
      });
    }

    return NextResponse.json({
      success: true,
      messageId: parsedMessageId,
      reaction,
      reactionById: reaction ? parsedUserId : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save reaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

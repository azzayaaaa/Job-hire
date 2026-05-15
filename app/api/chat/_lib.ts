const CHAT_META_PREFIX = "__JOBHUB_CHAT_META__:";
const CHAT_ATTACHMENT_PREFIX = "__JOBHUB_CHAT_ATTACHMENT__:";

export function decodeAttachmentPayload(text: string) {
  if (!text?.startsWith(CHAT_ATTACHMENT_PREFIX)) {
    return {
      text,
      imageDataUrl: null,
      videoDataUrl: null,
      fileDataUrl: null,
      fileName: null,
      fileSizeBytes: null,
      fileMimeType: null,
    };
  }

  try {
    const parsed = JSON.parse(text.slice(CHAT_ATTACHMENT_PREFIX.length));
    return {
      text: String(parsed?.text || ""),
      imageDataUrl: parsed?.imageDataUrl ? String(parsed.imageDataUrl) : null,
      videoDataUrl: parsed?.videoDataUrl ? String(parsed.videoDataUrl) : null,
      fileDataUrl: parsed?.fileDataUrl ? String(parsed.fileDataUrl) : null,
      fileName: parsed?.fileName ? String(parsed.fileName) : null,
      fileSizeBytes: Number.isFinite(Number(parsed?.fileSizeBytes)) ? Number(parsed.fileSizeBytes) : null,
      fileMimeType: parsed?.fileMimeType ? String(parsed.fileMimeType) : null,
    };
  } catch {
    return {
      text,
      imageDataUrl: null,
      videoDataUrl: null,
      fileDataUrl: null,
      fileName: null,
      fileSizeBytes: null,
      fileMimeType: null,
    };
  }
}

export function getConversationPreview(decoded: ReturnType<typeof decodeMessage>) {
  if (decoded?.text) return decoded.text;
  if (decoded?.imageDataUrl) return "Зураг";
  if (decoded?.videoDataUrl) return "Бичлэг";
  if (decoded?.fileName) return decoded.fileName;
  return "";
}

export function encodeMessage(
  message: string,
  replyToId?: unknown,
  replyPreview?: unknown,
  reaction?: unknown,
  reactionById?: unknown,
) {
  if (!replyToId && !replyPreview && !reaction) return message;

  return `${CHAT_META_PREFIX}${JSON.stringify({
    text: message,
    replyToId: replyToId ? Number(replyToId) : null,
    replyPreview: replyPreview ? String(replyPreview).slice(0, 160) : null,
    reaction: reaction ? String(reaction).slice(0, 16) : null,
    reactionById: reactionById ? Number(reactionById) : null,
  })}`;
}

export function decodeMessage(message: string) {
  if (!message?.startsWith(CHAT_META_PREFIX)) {
    return {
      ...decodeAttachmentPayload(message || ""),
      replyToId: null,
      replyPreview: null,
      reaction: null,
      reactionById: null,
    };
  }

  try {
    const parsed = JSON.parse(message.slice(CHAT_META_PREFIX.length));
    const attachment = decodeAttachmentPayload(String(parsed?.text || ""));
    return {
      ...attachment,
      replyToId: parsed?.replyToId ? Number(parsed.replyToId) : null,
      replyPreview: parsed?.replyPreview ? String(parsed.replyPreview) : null,
      reaction: parsed?.reaction ? String(parsed.reaction) : null,
      reactionById: parsed?.reactionById ? Number(parsed.reactionById) : null,
    };
  } catch {
    return {
      text: message,
      imageDataUrl: null,
      videoDataUrl: null,
      fileDataUrl: null,
      fileName: null,
      fileSizeBytes: null,
      fileMimeType: null,
      replyToId: null,
      replyPreview: null,
      reaction: null,
      reactionById: null,
    };
  }
}

export function formatMessageForClient<T extends { message: string }>(message: T) {
  const decoded = decodeMessage(message?.message || "");

  return {
    ...message,
    message: decoded.text,
    imageDataUrl: decoded.imageDataUrl,
    videoDataUrl: decoded.videoDataUrl,
    fileDataUrl: decoded.fileDataUrl,
    fileName: decoded.fileName,
    fileSizeBytes: decoded.fileSizeBytes,
    fileMimeType: decoded.fileMimeType,
    replyToId: decoded.replyToId,
    replyPreview: decoded.replyPreview,
    reaction: decoded.reaction,
    reactionById: decoded.reactionById,
  };
}

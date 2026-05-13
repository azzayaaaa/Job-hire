"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  Image as ImageIcon,
  FileText,
  Download,
  Loader2,
  Reply,
  Send,
  Smile,
  X,
} from "lucide-react";
import { authenticatedFetch, authenticatedPost } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import { useAlert } from "@/components/AlertProvider";

type ChatMessage = {
  id: number;
  senderId: number;
  receiverId: number;
  message?: string | null;
  createdAt?: string;
  seen?: boolean;
  isRead?: boolean;
  replyToId?: number | null;
  replyPreview?: string | null;
  reaction?: string | null;
  reactionById?: number | null;

  // Attachments
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  videoDataUrl?: string | null;

  fileUrl?: string | null;
  fileDataUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileMimeType?: string | null;

  // Optional future fields (safe to render if present)
};

const CHAT_ATTACHMENT_PREFIX = "__JOBHUB_CHAT_ATTACHMENT__:";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function getMessageText(msg: ChatMessage) {
  return (msg.message ?? "").toString();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildAttachmentMessage(payload: Partial<ChatMessage>) {
  return `${CHAT_ATTACHMENT_PREFIX}${JSON.stringify({
    text: payload.message || "",
    imageDataUrl: payload.imageDataUrl || null,
    videoDataUrl: payload.videoDataUrl || null,
    fileDataUrl: payload.fileDataUrl || null,
    fileName: payload.fileName || null,
    fileSizeBytes: payload.fileSizeBytes || null,
    fileMimeType: payload.fileMimeType || null,
  })}`;
}

function isLocalTempMessageId(messageId?: number | null) {
  return Number(messageId) > 1_000_000_000_000;
}

function formatTime(createdAt?: string) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

function formatPresence(lastActiveAt?: string | null, isOnline?: boolean) {
  if (isOnline) return "Идэвхтэй байна";
  if (!lastActiveAt) return "Офлайн";

  const date = new Date(lastActiveAt);
  if (Number.isNaN(date.getTime())) return "Офлайн";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Саяхан идэвхтэй байсан";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} мин өмнө идэвхтэй байсан`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} цаг өмнө идэвхтэй байсан`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Өчигдөр идэвхтэй байсан";

  return `${date.toLocaleDateString("mn-MN", { month: "short", day: "numeric" })} идэвхтэй байсан`;
}

function formatBytes(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  const n = Number(bytes);
  if (Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export default function ChatWindow({
  receiver,
  senderId,
  socket,
  onProfileClick,
  onChatContainerRef,
  onScrollToInput,
  onBackMobile,
  embedded = false,
}: {
  receiver: any;
  senderId: number;
  socket: any;
  onProfileClick: () => void;
  onChatContainerRef?: (ref: React.RefObject<HTMLDivElement | null>) => void;
  onScrollToInput?: (fn: () => void) => void;
  onBackMobile?: () => void;
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
  const [presence, setPresence] = useState<{ isOnline: boolean; lastActiveAt: string | null }>({
    isOnline: Boolean(receiver?.isOnline),
    lastActiveAt: receiver?.lastActiveAt || null,
  });
  const { showAlert } = useAlert();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const senderIdNum = useMemo(() => Number(senderId), [senderId]);
  const chatStorageKey = useMemo(() => {
    if (!senderIdNum || !receiver?.id) return "";
    const ids = [senderIdNum, Number(receiver.id)].sort((a, b) => a - b);
    return `jobhub-chat-${ids[0]}-${ids[1]}`;
  }, [senderIdNum, receiver?.id]);

  const saveCachedMessages = (nextMessages: ChatMessage[]) => {
    if (!chatStorageKey || typeof window === "undefined") return;
    localStorage.setItem(chatStorageKey, JSON.stringify(nextMessages.slice(-200)));
  };

  const getReplyPreview = (msg: ChatMessage) => {
    const text = getMessageText(msg).trim();
    if (text) return text.length > 90 ? `${text.slice(0, 90)}...` : text;
    if (msg.imageUrl || msg.imageDataUrl) return "Зураг";
    if (msg.videoDataUrl) return "Бичлэг";
    if (msg.fileName) return msg.fileName;
    return "Мессеж";
  };

  const mergeMessages = (base: ChatMessage[], incoming: ChatMessage[]) => {
    const seen = new Set<string>();
    return [...base, ...incoming].filter((msg, index) => {
      const key = msg.id ? `id-${msg.id}` : `tmp-${msg.senderId}-${msg.receiverId}-${msg.createdAt}-${index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  // Expose refs and methods to parent
  useEffect(() => {
    if (onChatContainerRef) onChatContainerRef(containerRef);
    if (!onScrollToInput) return;

    onScrollToInput(() => {
      inputRef.current?.focus();
      scrollToBottom();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChatContainerRef, onScrollToInput]);

  useEffect(() => {
    setPresence({
      isOnline: Boolean(receiver?.isOnline),
      lastActiveAt: receiver?.lastActiveAt || null,
    });
  }, [receiver?.id, receiver?.isOnline, receiver?.lastActiveAt]);

  useEffect(() => {
    if (!socket || !receiver?.id) return;

    const onPresence = (data: any) => {
      if (Number(data?.userId) !== Number(receiver.id)) return;
      setPresence({
        isOnline: Boolean(data.isOnline),
        lastActiveAt: data.lastActiveAt || null,
      });
    };

    socket.emit("presence-check", receiver.id);
    socket.on("user-presence", onPresence);

    return () => {
      socket.off("user-presence", onPresence);
    };
  }, [socket, receiver?.id]);

  // Close fullscreen on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFullscreenImage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch chat history
  useEffect(() => {
    if (!receiver?.id) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        let cachedMessages: ChatMessage[] = [];
        if (chatStorageKey && typeof window !== "undefined") {
          try {
            cachedMessages = JSON.parse(localStorage.getItem(chatStorageKey) || "[]");
            if (cachedMessages.length) setMessages(cachedMessages);
          } catch {
            cachedMessages = [];
          }
        }
        const res = await authenticatedFetch(API_URLS.chat.history(senderIdNum, receiver.id));
        const mergedMessages = mergeMessages(cachedMessages, (res.data || []) as ChatMessage[]);
        setMessages(mergedMessages);
        saveCachedMessages(mergedMessages);
        mergedMessages
          .filter(
            (msg) =>
              msg.id &&
              !isLocalTempMessageId(msg.id) &&
              Number(msg.senderId) === Number(receiver.id) &&
              Number(msg.receiverId) === senderIdNum &&
              !(msg.seen ?? msg.isRead),
          )
          .forEach((msg) => markAsSeen(msg.id));
        scrollToBottom();
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [receiver?.id, senderIdNum, chatStorageKey]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !receiver?.id) return;

    const onNewMessage = (msg: any) => {
      const matches =
        (msg.senderId === senderIdNum && msg.receiverId === Number(receiver.id)) ||
        (msg.senderId === Number(receiver.id) && msg.receiverId === senderIdNum);

      if (!matches) return;

      const normalizedMessage: ChatMessage = {
        ...msg,
        seen: msg.seen ?? msg.isRead ?? false,
        isRead: msg.isRead ?? msg.seen ?? false,
      };

      setMessages((prev) => {
        const next =
          normalizedMessage.id && prev.some((m) => m.id === normalizedMessage.id)
            ? prev
            : [...prev, normalizedMessage];
        saveCachedMessages(next);
        return next;
      });
      scrollToBottom();

      // Mark as seen if receiver
      if (msg.receiverId === senderIdNum && msg.id && !isLocalTempMessageId(msg.id)) {
        markAsSeen(msg.id);
      }
    };

    socket.on("new-message", onNewMessage);
    return () => {
      socket.off("new-message", onNewMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, receiver?.id, senderIdNum]);

  // Mark message as seen
  const markAsSeen = async (messageId: number) => {
    if (isLocalTempMessageId(messageId)) return;
    try {
      await authenticatedPost(API_URLS.chat.seen(messageId), {});
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, seen: true, isRead: true } : m))
      );
    } catch (error) {
      console.error("Failed to mark as seen:", error);
    }
  };

  // Listen for seen receipts
  useEffect(() => {
    if (!socket) return;

    const onSeen = (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId && m.senderId === senderIdNum
            ? { ...m, seen: true, isRead: true }
            : m,
        )
      );
    };

    socket.on("message-seen", onSeen);
    return () => {
      socket.off("message-seen", onSeen);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onReaction = (data: any) => {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === Number(data.messageId)
            ? {
                ...m,
                reaction: data.reaction || null,
                reactionById: data.reactionById || null,
              }
            : m,
        );
        saveCachedMessages(next);
        return next;
      });
    };

    socket.on("message-reaction", onReaction);
    return () => {
      socket.off("message-reaction", onReaction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Send text message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const msgText = input;
    setInput("");

    try {
      const res = await authenticatedPost(API_URLS.chat.send(), {
        senderId: senderIdNum,
        receiverId: receiver.id,
        message: msgText,
        replyToId: replyTo?.id || null,
        replyPreview: replyTo ? getReplyPreview(replyTo) : null,
      });

      const newMsg: ChatMessage = {
        ...(res.data as ChatMessage),
        id: (res.data as any)?.id ?? (res.data as any)?.messageId,
        senderId: senderIdNum,
        receiverId: receiver.id,
        message: msgText,
        createdAt: (res.data as any)?.createdAt || new Date().toISOString(),
        seen: (res.data as any)?.seen ?? (res.data as any)?.isRead ?? false,
        isRead: (res.data as any)?.isRead ?? (res.data as any)?.seen ?? false,
        replyToId: (res.data as any)?.replyToId ?? replyTo?.id ?? null,
        replyPreview: (res.data as any)?.replyPreview ?? (replyTo ? getReplyPreview(replyTo) : null),
      };

      setReplyTo(null);
      setMessages((prev) => {
        const next = newMsg.id && prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg];
        saveCachedMessages(next);
        return next;
      });
      scrollToBottom();
    } catch (error) {
      console.error("Failed to send message:", error);
      setInput(msgText);
    } finally {
      setSending(false);
    }
  };

  const handlePickAttachmentsClick = () => {
    fileInputRef.current?.click();
  };

  const startReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    setActiveMessageId(null);
    inputRef.current?.focus();
  };

  const reactToMessage = async (msg: ChatMessage, reaction: string) => {
    const nextReaction = msg.reaction === reaction ? null : reaction;
    setActiveMessageId(null);
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === msg.id
          ? { ...m, reaction: nextReaction, reactionById: nextReaction ? senderIdNum : null }
          : m,
      );
      saveCachedMessages(next);
      return next;
    });

    try {
      await authenticatedPost(API_URLS.chat.reaction(msg.id), {
        reaction: nextReaction,
        userId: senderIdNum,
        receiverId: msg.senderId === senderIdNum ? msg.receiverId : msg.senderId,
      });
    } catch (error) {
      console.error("Failed to react to message:", error);
    }
  };

  const startLongPress = (msg: ChatMessage) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(msg.id);
    }, 450);
  };

  const stopLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleAttachmentsChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      showAlert("Файл 8MB-аас их байна. Жижиг файл сонгоно уу.", "warning");
      e.target.value = "";
      return;
    }

    const tempId = Date.now();
    const dataUrl = await readFileAsDataUrl(file);
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: senderIdNum,
      receiverId: receiver.id,
      message: "",
      createdAt: new Date().toISOString(),
      imageDataUrl: file.type.startsWith("image/") ? dataUrl : null,
      videoDataUrl: file.type.startsWith("video/") ? dataUrl : null,
      fileDataUrl: !file.type.startsWith("image/") && !file.type.startsWith("video/") ? dataUrl : null,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileMimeType: file.type || "application/octet-stream",
      seen: false,
      isRead: false,
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      saveCachedMessages(next);
      return next;
    });
    scrollToBottom();
    e.target.value = "";

    try {
      const res = await authenticatedPost(API_URLS.chat.send(), {
        senderId: senderIdNum,
        receiverId: receiver.id,
        message: buildAttachmentMessage(newMsg),
        replyToId: replyTo?.id || null,
        replyPreview: replyTo ? getReplyPreview(replyTo) : null,
      });

      const savedMsg: ChatMessage = {
        ...(res.data as ChatMessage),
        id: (res.data as any)?.id ?? tempId,
        senderId: senderIdNum,
        receiverId: receiver.id,
        createdAt: (res.data as any)?.createdAt || newMsg.createdAt,
        imageDataUrl: (res.data as any)?.imageDataUrl ?? newMsg.imageDataUrl,
        videoDataUrl: (res.data as any)?.videoDataUrl ?? newMsg.videoDataUrl,
        fileDataUrl: (res.data as any)?.fileDataUrl ?? newMsg.fileDataUrl,
        fileName: (res.data as any)?.fileName ?? newMsg.fileName,
        fileSizeBytes: (res.data as any)?.fileSizeBytes ?? newMsg.fileSizeBytes,
        fileMimeType: (res.data as any)?.fileMimeType ?? newMsg.fileMimeType,
        seen: (res.data as any)?.seen ?? (res.data as any)?.isRead ?? false,
        isRead: (res.data as any)?.isRead ?? (res.data as any)?.seen ?? false,
        replyToId: (res.data as any)?.replyToId ?? replyTo?.id ?? null,
        replyPreview: (res.data as any)?.replyPreview ?? (replyTo ? getReplyPreview(replyTo) : null),
      };

      setReplyTo(null);
      setMessages((prev) => {
        const withoutTempAndDuplicate = prev.filter((msg) => msg.id !== tempId && msg.id !== savedMsg.id);
        const next = [...withoutTempAndDuplicate, savedMsg];
        saveCachedMessages(next);
        return next;
      });
    } catch (error) {
      console.error("Failed to send attachment:", error);
      setMessages((prev) => {
        const next = prev.filter((msg) => msg.id !== tempId);
        saveCachedMessages(next);
        return next;
      });
      showAlert("Файл илгээхэд алдаа гарлаа.", "error");
    }
  };

  const renderSeenText = (msg: ChatMessage) => {
    const isSender = msg.senderId === senderIdNum;
    if (!isSender) return null;

    const seenVal = msg.seen ?? msg.isRead ?? false;
    return (
      <div className="mt-1 opacity-70 text-right whitespace-nowrap">
        <div className="text-[10px] flex items-center justify-end gap-2px whitespace-nowrap">
          {seenVal ? "✓✓" : "✓"}
          <span> {seenVal ? "Seen" : "Sent"}</span>
        </div>
      </div>
    );
  };

  const AttachmentBubble = ({
    msg,
    isSender,
  }: {
    msg: ChatMessage;
    isSender: boolean;
  }) => {
    const imageSrc = msg.imageUrl || msg.imageDataUrl || null;
    const videoSrc = msg.videoDataUrl || null;
    const fileName = msg.fileName || null;
    const fileSizeBytes = msg.fileSizeBytes ?? null;

    if (imageSrc) {
      return (
        <div className={`overflow-hidden ${embedded ? "w-full max-w-full" : ""}`}>
          <button
            type="button"
            onClick={() => setFullscreenImage(imageSrc)}
            className={`block overflow-hidden rounded-2xl transition-opacity hover:opacity-90 ${
              embedded ? "w-full max-w-full" : ""
            }`}
            aria-label="Open image"
          >
            <img
              src={imageSrc}
              alt="attachment"
              className={`block rounded-2xl object-contain ${
                embedded
                  ? "h-auto max-h-[220px] w-auto max-w-full"
                  : "max-h-[340px] max-w-[320px]"
              }`}
            />
          </button>
          <p className={`mt-2 px-1 text-[11px] font-medium ${isSender ? "text-right" : "text-left"} text-slate-400`}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      );
    }

    if (videoSrc) {
      return (
        <div className="p-0 rounded-xl overflow-hidden">
          <video
            src={videoSrc}
            controls
            className="max-h-[280px] max-w-[280px] rounded-xl bg-slate-950"
          />
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-white/85">
              {fileName || "Бичлэг"} • {formatBytes(fileSizeBytes)}
            </p>
            <p className={`text-xs mt-1 ${isSender ? "text-right" : "text-left"} opacity-70`}>
              {formatTime(msg.createdAt)}
            </p>
          </div>
        </div>
      );
    }

    // File bubble
    if (fileName) {
      const downloadUrl = msg.fileUrl || msg.fileDataUrl || "#";
      return (
        <div className="flex flex-col gap-2 p-3">
          <a
            href={downloadUrl}
            download={fileName}
            className={`flex items-center gap-3 hover:opacity-80 transition-opacity group`}
          >
            <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${isSender ? "bg-blue-500/30" : "bg-slate-700/50"}`}>
              <FileText size={18} className={isSender ? "text-white" : "text-blue-400"} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white break-words group-hover:underline">
                {fileName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatBytes(fileSizeBytes)}
              </p>
            </div>
            <Download size={16} className="text-slate-400 group-hover:text-white flex-shrink-0" />
          </a>
          <p className={`text-xs opacity-60 ${isSender ? "text-right" : "text-left"}`}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      );
    }

    return null;
  };

  if (!receiver?.id) {
    return (
      <div className="h-full flex items-center justify-center text-white/40 text-[12px]">
        Select a conversation to start messaging
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-700/50 overflow-hidden relative"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-900/95 to-slate-800/95 flex items-center justify-between backdrop-blur-md">
        <button
          type="button"
          onClick={onBackMobile}
          className="md:hidden h-9 w-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          aria-label="Back to messages"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={onProfileClick}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all flex-1 md:ml-0 group rounded-lg p-2 hover:bg-white/5"
        >
          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(receiver.fullName?.[0] || receiver.email[0]).toUpperCase()}
            {presence?.isOnline && (
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-800 bg-green-500 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {receiver.fullName || receiver.email.split("@")[0]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{formatPresence(presence.lastActiveAt, presence.isOnline)}</p>
          </div>
        </button>

        <button className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
          {/* menu icon removed intentionally - keep layout simple */}
        </button>
      </div>

      {/* Hidden attachment input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleAttachmentsChange}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 md:pb-4 scrollbar-hide" ref={scrollRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-sm text-slate-400">Чат түүх ачаалж байна...</p>
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg, idx) => {
            const isSender = msg.senderId === senderIdNum;

            const imageSrc = msg.imageUrl || msg.imageDataUrl || null;
            const videoSrc = msg.videoDataUrl || null;
            const fileName = msg.fileName || null;

            const text = getMessageText(msg);
            const hasAttachment = Boolean(imageSrc || videoSrc || fileName);
            const isActive = activeMessageId === msg.id;

            return (
              <div
                key={msg.id ?? idx}
                className={`flex ${isSender ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300 group`}
              >
                <div
                  className={`flex w-full flex-col gap-1 ${
                    embedded
                      ? hasAttachment
                        ? "max-w-full"
                        : "max-w-[92%]"
                      : "max-w-[85%] md:max-w-[75%]"
                  }`}
                >
                  <div
                    className={`relative w-fit rounded-2xl transition-all ${
                      isSender
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 self-end"
                        : "bg-slate-800 text-white border border-slate-700 self-start hover:bg-slate-700"
                    } ${hasAttachment ? "!bg-transparent !border-0 !shadow-none hover:!bg-transparent" : ""} ${isActive ? "ring-2 ring-blue-400" : ""}`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setActiveMessageId((prev) => (prev === msg.id ? null : msg.id));
                    }}
                    onTouchStart={() => startLongPress(msg)}
                    onTouchEnd={stopLongPress}
                    onTouchMove={stopLongPress}
                  >
                    {isActive && (
                      <div
                        className={`absolute -top-12 ${isSender ? "right-0" : "left-0"} z-10 flex items-center gap-1.5 rounded-2xl border border-slate-600 bg-slate-900 p-2 shadow-2xl backdrop-blur-sm animate-in fade-in scale-in-95 duration-200`}
                      >
                        {["👍", "❤️", "😂", "😮", "🔥"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => reactToMessage(msg, emoji)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-slate-800 transition-colors"
                            aria-label={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="h-6 w-px bg-slate-700" />
                        <button
                          type="button"
                          onClick={() => startReply(msg)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          aria-label="Reply"
                        >
                          <Reply size={16} />
                        </button>
                      </div>
                    )}
                    {hasAttachment ? (
                      <AttachmentBubble msg={msg} isSender={isSender} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMessageId((prev) => (prev === msg.id ? null : msg.id));
                        }}
                        className="relative text-left text-sm leading-relaxed break-words w-fit"
                        style={{ padding: "10px 14px" }}
                        aria-label="Message actions"
                      >
                        {msg.replyPreview && (
                          <div className={`mb-2 rounded-lg border-l-3 px-3 py-2 text-xs opacity-90 font-medium ${isSender ? "border-blue-400 bg-blue-900/30" : "border-blue-500 bg-slate-900/50"}`}>
                            {msg.replyPreview}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{text || ""}</div>

                        {msg.reaction && (
                          <span className={`absolute -bottom-4 ${isSender ? "left-2" : "right-2"} rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-base shadow-lg`}>
                            {msg.reaction}
                          </span>
                        )}

                        <div className={`mt-2 text-xs opacity-60 flex items-center gap-1 ${isSender ? "text-right" : ""}`}>
                          {formatTime(msg.createdAt)}
                          {isSender && (
                            <span className="ml-1 opacity-70">
                              {msg.seen || msg.isRead ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Send size={32} className="text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Одоогоор сэтгэгдэл байхгүй</p>
              <p className="text-xs text-slate-500 mt-1">Яриалагчаас эхэлье!</p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen image overlay */}
      {fullscreenImage && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreenImage(null);
          }}
        >
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <a
              href={fullscreenImage}
              download
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-blue-800 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} />
              Татах
            </a>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenImage(null);
              }}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex h-full w-full items-center justify-center">
            <img
              src={fullscreenImage}
              alt="fullscreen"
              className="max-h-[88vh] max-w-[92vw] object-contain rounded-2xl border border-slate-600/50 shadow-2xl"
            />
          </div>
        </div>
      , document.body)}

      {/* Input (FIX 3: fixed bar on mobile) */}
      <form
        onSubmit={handleSend}
        className={
          embedded
            ? "static bg-slate-800/50 p-4 py-3 border-t border-slate-700/50"
            : "fixed bottom-[56px] left-0 right-0 z-40 bg-slate-800/80 border-t border-slate-700/50 px-3 py-2 min-h-[60px] md:static md:min-h-0 md:bg-slate-800/50 md:p-4 md:py-3 md:border-t-0 backdrop-blur-md"
        }
        style={{ paddingBottom: embedded ? undefined : "env(safe-area-inset-bottom)" }}
      >
        {replyTo && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 animate-in fade-in slide-in-from-top-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300 mb-1">
                <Reply size={13} />
                Хариулт
              </div>
              <p className="truncate text-sm text-slate-300">{getReplyPreview(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
              aria-label="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-transparent">
          {/* Attachment button */}
          <button
            type="button"
            aria-label="Pick image or file"
            onClick={handlePickAttachmentsClick}
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shrink-0 shadow-lg shadow-blue-500/20"
          >
            <ImageIcon size={20} />
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Сэтгэгдэл бичээрэй..."
            disabled={sending}
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-blue-500/50 focus:bg-slate-700/70 text-white placeholder:text-slate-500 disabled:opacity-50 transition-colors h-11 resize-none"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 shadow-lg shadow-blue-500/20"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}

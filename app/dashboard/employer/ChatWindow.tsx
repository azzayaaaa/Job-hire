"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

  fileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;

  // Optional future fields (safe to render if present)
};

function getMessageText(msg: ChatMessage) {
  return (msg.message ?? "").toString();
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
      if (msg.receiverId === senderIdNum && msg.id) {
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
      await authenticatedPost(`http://localhost:5007/api/chat/messages/${msg.id}/reaction`, {
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

    const tempId = Date.now();

    // Image -> show as image bubble
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);

        const newMsg: ChatMessage = {
          id: tempId,
          senderId: senderIdNum,
          receiverId: receiver.id,
          message: "",
          createdAt: new Date().toISOString(),
          imageDataUrl: dataUrl,
          seen: false,
          isRead: false,
        };

        setMessages((prev) => {
          const next = [...prev, newMsg];
          saveCachedMessages(next);
          return next;
        });
        scrollToBottom();
      };
      reader.readAsDataURL(file);
    } else {
      // Non-image -> show as file bubble (name + size)
      const newMsg: ChatMessage = {
        id: tempId,
        senderId: senderIdNum,
        receiverId: receiver.id,
        message: "",
        createdAt: new Date().toISOString(),
        fileName: file.name,
        fileSizeBytes: file.size,
        seen: false,
        isRead: false,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        saveCachedMessages(next);
        return next;
      });
      scrollToBottom();
    }

    e.target.value = "";
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
    const fileName = msg.fileName || null;
    const fileSizeBytes = msg.fileSizeBytes ?? null;

    if (imageSrc) {
      return (
        <div className="p-0">
          <button
            type="button"
            onClick={() => setFullscreenImage(imageSrc)}
            className="block"
            aria-label="Open image"
          >
            <img
              src={imageSrc}
              alt="attachment"
              className="max-w-[200px] max-h-[200px] object-cover rounded-[12px]"
            />
          </button>
          <p className={`text-[9px] mt-1 ${isSender ? "text-right" : "text-left"} opacity-70`}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      );
    }

    // File bubble
    if (fileName) {
      return (
        <div className="flex flex-col gap-1" style={{ padding: "8px 12px" }}>
          <div className="flex items-center gap-2">
            <FileText size={14} className={isSender ? "text-white" : "text-[#4F67FF]"} />
            <p
              className={`text-[11px] font-black ${
                isSender ? "text-white" : "text-white"
              } break-words`}
              style={{ maxWidth: 220 }}
            >
              {fileName}
            </p>
          </div>
          <div className={`text-[9px] opacity-70 ${isSender ? "text-right" : "text-left"}`}>
            {formatBytes(fileSizeBytes)}
          </div>
          <div className={`text-[9px] opacity-70 ${isSender ? "text-right" : "text-left"}`}>
            {formatTime(msg.createdAt)}
          </div>
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
      className="flex flex-col h-full bg-[#111827] rounded-2xl border border-white/[0.06] overflow-hidden relative"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
        <button
          type="button"
          onClick={onBackMobile}
          className="md:hidden w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          aria-label="Back to messages"
        >
          <ChevronLeft size={16} />
        </button>

        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all md:ml-0"
          onClick={onProfileClick}
        >
          <div className="w-8 h-8 rounded-full bg-[#4F67FF]/20 flex items-center justify-center text-[#4F67FF] font-black text-xs">
            {(receiver.fullName?.[0] || receiver.email[0]).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white uppercase truncate">
              {receiver.fullName || receiver.email.split("@")[0]}
            </p>
            <p className="text-[9px] text-white/30">{formatPresence(presence.lastActiveAt, presence.isOnline)}</p>
          </div>
        </div>

        <button className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 md:pb-4 scrollbar-hide" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-[#4F67FF]" size={20} />
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg, idx) => {
            const isSender = msg.senderId === senderIdNum;

            const imageSrc = msg.imageUrl || msg.imageDataUrl || null;
            const fileName = msg.fileName || null;

            const text = getMessageText(msg);
            const hasAttachment = Boolean(imageSrc || fileName);
            const isActive = activeMessageId === msg.id;

            return (
              <div
                key={msg.id ?? idx}
                className={`flex ${isSender ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`relative w-fit max-w-[75%] md:max-w-[70%] rounded-2xl ${
                    isSender
                      ? "bg-[#4F67FF] text-white"
                      : "bg-[#1a2035] text-white border border-white/5"
                  }`}
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
                      className={`absolute -top-10 ${isSender ? "right-0" : "left-0"} z-10 flex items-center gap-1 rounded-full border border-white/10 bg-[#0d1117] p-1 shadow-2xl`}
                    >
                      {["👍", "❤️", "😂", "😮"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => reactToMessage(msg, emoji)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-white/10"
                          aria-label={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => startReply(msg)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="Reply"
                      >
                        <Reply size={13} />
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
                      className="relative text-left text-[11px] font-medium leading-relaxed break-words w-fit"
                      style={{ padding: "8px 12px" }}
                      aria-label="Message actions"
                    >
                      {msg.replyPreview && (
                        <div className={`mb-1 rounded-lg border-l-2 px-2 py-1 text-[10px] opacity-80 ${isSender ? "border-white/60 bg-white/10" : "border-[#4F67FF] bg-black/10"}`}>
                          {msg.replyPreview}
                        </div>
                      )}
                      <div>{text || ""}</div>

                      {msg.reaction && (
                        <span className={`absolute -bottom-3 ${isSender ? "left-2" : "right-2"} rounded-full border border-white/10 bg-[#0d1117] px-1.5 py-0.5 text-[11px] shadow-lg`}>
                          {msg.reaction}
                        </span>
                      )}

                      <div className="mt-1 text-[9px] opacity-70">{formatTime(msg.createdAt)}</div>
                      {isSender && renderSeenText(msg)}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-white/30 text-[11px]">
            No messages yet. Start the conversation!
          </div>
        )}
      </div>

      {/* Fullscreen image overlay */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreenImage(null);
          }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <img
              src={fullscreenImage}
              alt="fullscreen"
              className="max-w-full max-h-[70vh] object-contain rounded-2xl border border-white/10"
            />

            <div className="mt-auto w-full flex gap-3">
              <a
                href={fullscreenImage}
                download
                className="flex-1 bg-[#4F67FF] text-white rounded-xl px-3 py-3 text-[12px] font-black text-center inline-flex items-center justify-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={14} />
                Татах
              </a>

              <button
                type="button"
                className="flex-1 bg-white/10 text-white rounded-xl px-3 py-3 text-[12px] font-black text-center inline-flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(null);
                }}
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input (FIX 3: fixed bar on mobile) */}
      <form
        onSubmit={handleSend}
        className={
          embedded
            ? "static bg-transparent p-3 py-3 border-t border-white/[0.05]"
            : "fixed bottom-[56px] left-0 right-0 z-[60] bg-[#0f1117] border-t border-white/[0.05] px-2 py-2 min-h-[56px] md:static md:min-h-0 md:bg-transparent md:p-3 md:py-3 md:border-t-0"
        }
        style={{ paddingBottom: embedded ? undefined : "env(safe-area-inset-bottom)" }}
      >
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#9aa8ff]">
                <Reply size={11} />
                Reply
              </div>
              <p className="truncate text-[11px] text-white/70">{getReplyPreview(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Cancel reply"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-[#0f1117] h-full">
          {/* image-icon 44px */}
          <button
            type="button"
            aria-label="Pick image or file"
            onClick={handlePickAttachmentsClick}
            className="w-[44px] h-[44px] flex items-center justify-center rounded-xl bg-white/[0.04] text-white hover:bg-white/[0.07] transition-all shrink-0"
          >
            <ImageIcon size={18} />
          </button>

          {/* input flex-1 */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Бичих..."
            disabled={sending}
            className="flex-1 bg-[#1a2035] border border-white/5 rounded-xl py-2 px-4 text-xs outline-none focus:border-[#4F67FF]/30 text-white placeholder:text-white/30 disabled:opacity-50 h-[44px] min-h-[44px]"
          />

          {/* send button 44px purple circle */}
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#6c63ff] text-white hover:bg-[#5a52ff] disabled:opacity-50 transition-all shrink-0"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
}

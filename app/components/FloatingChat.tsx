"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { authenticatedFetch } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";
import ChatWindow from "../dashboard/employer/ChatWindow";

type Conversation = {
  id: number;
  participantId?: number;
  participantEmail?: string;
  participantName?: string;
  email?: string;
  fullName?: string;
  lastMessage?: string;
  unreadCount?: number;
};

function getParticipant(conv: Conversation) {
  return {
    id: Number(conv.participantId ?? conv.id),
    email: conv.participantEmail ?? conv.email ?? "",
    fullName: conv.participantName ?? conv.fullName ?? "",
  };
}

function getInitial(contact: { fullName?: string; email?: string }) {
  return (contact.fullName?.[0] || contact.email?.[0] || "?").toUpperCase();
}

export default function FloatingChat({
  enabled = false,
}: {
  enabled?: boolean;
}) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as number | undefined;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [panelOpen, setPanelOpen] = useState(false);

  // unread badge (simple heuristic: count conversations without lastMessage seen is not available)
  const unreadCount = useMemo(() => {
    const count = conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
    return panelOpen ? 0 : count;
  }, [conversations, panelOpen]);

  const bubbleSize = 56;

  // Bubble visibility + hover state (BUG 4)
  const [bubbleVisible, setBubbleVisible] = useState(enabled);
  const [showDesktopClose, setShowDesktopClose] = useState(false);

  // Bubble position (fixed bottom-right by default)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    return {
      x: Math.max(12, window.innerWidth - 72),
      y: Math.max(12, window.innerHeight - 96),
    };
  });

  useEffect(() => {
    const clampPosition = () => {
      setPos((current) => ({
        x: Math.max(12, Math.min(current.x || window.innerWidth - 72, window.innerWidth - bubbleSize - 12)),
        y: Math.max(12, Math.min(current.y || window.innerHeight - 96, window.innerHeight - bubbleSize - 12)),
      }));
    };

    clampPosition();
    window.addEventListener("resize", clampPosition);
    return () => window.removeEventListener("resize", clampPosition);
  }, [bubbleSize]);

  useEffect(() => {
    setBubbleVisible(enabled);
    if (!enabled) {
      setPanelOpen(false);
      setSelectedContact(null);
    }
  }, [enabled]);

  // Desktop dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const [chatAvailable, setChatAvailable] = useState(false);
  const socketReady = chatAvailable;

  const scrollToInputFnRef = useRef<() => void>(() => {});
  const containerRef = useRef<HTMLDivElement | null>(null);

  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const [showDropZone, setShowDropZone] = useState(false);
  const [bubbleY, setBubbleY] = useState(0);

  // Mobile touch drag state
  const mobileIsDraggingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const res = await authenticatedFetch(API_URLS.chat.conversations(userId));
        if (cancelled) return;
        setConversations(res.data || []);
        setChatAvailable(true);
      } catch (e) {
        if (!cancelled) {
          setConversations([]);
          setChatAvailable(false);
        }
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  const ensurePanelAndSelectFirst = () => {
    if (panelOpen) return;

    setPanelOpen(true);
    setConversations((prev) => prev.map((conversation) => ({ ...conversation, unreadCount: 0 })));

    setSelectedContact((prev: any) => {
      if (prev?.id) return prev;
      const first = conversations[0];
      if (!first) return prev;
      const p = getParticipant(first);
      return { id: p.id, email: p.email, fullName: p.fullName };
    });
  };

  const handleBubbleOpen = () => {
    if (hasMoved) return;
    if (!userId) return;
    ensurePanelAndSelectFirst();
  };

  const handleClose = () => {
    setPanelOpen(false);
    setSelectedContact(null);
  };

  const closeBubbleAndPanel = () => {
    setBubbleVisible(false);
    setPanelOpen(false);
    setSelectedContact(null);
  };

  // Bubble drag (desktop)
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setHasMoved(true);
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - bubbleSize));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - bubbleSize));
      setPos({ x: newX, y: newY });
    };

    const onUp = () => setIsDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, dragOffset]);

  // Mobile: drag downward to dismiss (>= 80px) (required bubbleY logic)
  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    mobileIsDraggingRef.current = true;
    setBubbleY(0);
    setShowDropZone(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!mobileIsDraggingRef.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;

    dragCurrentY.current = delta;

    if (delta > 0) {
      setBubbleY(delta);
      if (delta > 60) setShowDropZone(true);
    }
  };

  const onTouchEnd = () => {
    if (!mobileIsDraggingRef.current) return;
    mobileIsDraggingRef.current = false;

    if (dragCurrentY.current > 100) setBubbleVisible(false); // dropped far enough
    else setBubbleY(0); // snap back

    setShowDropZone(false);
    dragStartY.current = 0;
    dragCurrentY.current = 0;

    if (bubbleVisible) {
      // If bubble just got hidden, also close panel
      // (bubbleVisible state update is async; safe to also close UI here)
      // closeBubbleAndPanel() calls setBubbleVisible(false) anyway; keep it consistent:
      if (bubbleY > 100) closeBubbleAndPanel();
    }
  };

  const selectedParticipant = useMemo(() => {
    if (!selectedContact?.id) return null;
    return selectedContact;
  }, [selectedContact]);

  const filteredConversations = useMemo(() => {
    return conversations.map((conv) => {
      const p = getParticipant(conv);
      return {
        convId: conv.id,
        ...p,
        lastMessage: conv.lastMessage ?? "Мессеж байхгүй...",
        unreadCount: Number(conv.unreadCount || 0),
      };
    });
  }, [conversations]);

  return (
    <>
      {/* Mobile dismiss indicator (red X circle) */}
      {bubbleVisible && showDropZone && (
        <div
          className="fixed z-[10000] left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ bottom: 80 }}
        >
          <div className="w-14 h-14 rounded-full bg-red-500 border-2 border-[#0a0f1e] flex items-center justify-center shadow-2xl">
            <X size={18} className="text-white" />
          </div>
        </div>
      )}

      {/* Bubble */}
      {bubbleVisible && (
        <div
          className="fixed z-[9999] select-none"
          style={{
            left: pos.x,
            top: pos.y,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            transform: `translateY(${bubbleY}px)`,
            transition: mobileIsDraggingRef.current ? "none" : "transform 150ms ease-out",
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={handleBubbleOpen}
          onMouseEnter={() => setShowDesktopClose(true)}
          onMouseLeave={() => setShowDesktopClose(false)}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#4F67FF] animate-ping opacity-20 pointer-events-none" />

            <div className="w-14 h-14 rounded-full bg-[#4F67FF] flex items-center justify-center shadow-2xl shadow-[#4F67FF]/40 border-2 border-white/20 transition-transform hover:scale-105">
              <span className="text-white font-black text-lg">C</span>
            </div>

            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#0a0f1e]">
              <MessageCircle size={10} className="text-white" />
            </div>

            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2 border-[#0a0f1e]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}

            {/* Desktop hover close button */}
            {showDesktopClose && (
              <button
                aria-label="Close chat bubble"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  closeBubbleAndPanel();
                }}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 border-2 border-[#0a0f1e] flex items-center justify-center shadow-lg"
              >
                <X size={14} className="text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sliding Panel */}
      <div className="pointer-events-none fixed right-2 bottom-20 z-[9998] w-[calc(100vw-16px)] sm:right-3 sm:w-[min(420px,calc(100vw-24px))] md:right-[18px] md:bottom-[18px] md:w-[400px]">
        <div
          className={`bg-[#0d1426] border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden transition-all duration-400 ${
            panelOpen ? "translate-y-0 opacity-100" : "translate-y-[20px] opacity-0"
          }`}
          style={{
            height: "min(500px, calc(100dvh - 120px))",
            pointerEvents: panelOpen ? ("auto" as const) : ("none" as const),
            transformOrigin: "bottom right",
          }}
        >
          {/* Header */}
          <div className="h-[56px] border-b border-white/[0.06] flex items-center justify-between px-4 bg-white/[0.02]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#4F67FF]/20 flex items-center justify-center text-[#4F67FF] font-black text-xs shrink-0">
                {selectedParticipant ? getInitial(selectedParticipant) : "C"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">Chat</p>
                <p className="text-[9px] text-white/30 truncate">
                  {socketReady ? "Online" : "Connecting..."}
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="h-[calc(100%-56px)] flex overflow-hidden">
            {/* Left: Conversations */}
            <div className="w-[108px] overflow-y-auto border-r border-white/[0.06] bg-[#0b1223] sm:w-[140px] md:w-[160px]">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-white/30 text-[11px]">Яриа байхгүй</div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = Number(selectedContact?.id) === Number(c.id);
                  return (
                    <button
                      key={c.convId}
                      onClick={() =>
                        setSelectedContact({ id: c.id, email: c.email, fullName: c.fullName })
                      }
                      className={`w-full text-left px-3 py-2.5 border-b border-white/[0.04] transition-all ${
                        isSelected
                          ? "bg-[#4F67FF]/10 border-l-2 border-l-[#4F67FF]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#4F67FF]/20 flex items-center justify-center text-[9px] font-black text-[#4F67FF] shrink-0">
                          {(c.fullName?.[0] || c.email?.[0] || "U").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">
                              {c.fullName || c.email.split("@")[0]}
                            </p>
                            {c.unreadCount > 0 && (
                              <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                                {c.unreadCount > 9 ? "9+" : c.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-white/40 truncate">{c.lastMessage}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right: Messages */}
            <div className="flex-1 overflow-hidden" ref={containerRef}>
              <ChatWindow
                receiver={selectedParticipant}
                senderId={Number(userId)}
                socket={null}
                onProfileClick={() => {}}
                embedded
                onScrollToInput={(fn: () => void) => {
                  scrollToInputFnRef.current = fn;
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

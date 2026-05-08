"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, MessageCircle } from "lucide-react";

export default function MessagesProfilePanel({
  contact,
  onClose,
  chatContainerRef,
  scrollToInput,
}: {
  contact: any;
  onClose: () => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollToInput: () => void;
}) {
  // Bubble position — fixed, дэлгэцийн хаана ч байж болно
  const [pos, setPos] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false); // drag vs click ялгах
  const bubbleRef = useRef<HTMLDivElement>(null);

  // ── Mouse down: drag эхлэх ──────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  // ── Mouse move: bubble зөөх ─────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setHasMoved(true);
      const bubbleSize = 56;
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

  // ── Touch support (mobile) ──────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({
      x: touch.clientX - pos.x,
      y: touch.clientY - pos.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      setHasMoved(true);
      const bubbleSize = 56;
      const newX = Math.max(0, Math.min(touch.clientX - dragOffset.x, window.innerWidth - bubbleSize));
      const newY = Math.max(0, Math.min(touch.clientY - dragOffset.y, window.innerHeight - bubbleSize));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [isDragging, dragOffset]);

  // ── Click: drag хийгдээгүй бол chat нээх ───────────────────────────────
  const handleClick = () => {
    if (hasMoved) return;
    scrollToInput(); // page.tsx: setSelectedContact + router.push + bubble хаах
  };

  const initial = (contact.fullName?.[0] || contact.email?.[0] || "?").toUpperCase();

  return (
    <>
      {/* ── Floating bubble ─────────────────────────────────────────────── */}
      <div
        ref={bubbleRef}
        className="fixed z-[9999] select-none"
        style={{
          left: pos.x,
          top: pos.y,
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
      >
        {/* Bubble */}
        <div className="relative">
          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-full bg-[#4F67FF] animate-ping opacity-20 pointer-events-none" />

          {/* Avatar circle */}
          <div
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#4F67FF] to-[#3d52e0] flex items-center justify-center shadow-2xl shadow-[#4F67FF]/40 border-2 border-white/20 transition-transform hover:scale-105"
          >
            <span className="text-white font-black text-lg">{initial}</span>
          </div>

          {/* Chat icon badge */}
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#0a0f1e]">
            <MessageCircle size={10} className="text-white" />
          </div>

          {/* X button — bubble-ийн дээр */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute -top-1 -left-1 w-5 h-5 bg-[#1e2535] border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500/80 transition-all"
          >
            <X size={10} />
          </button>
        </div>

        {/* Name tooltip — hover дээр гарч ирнэ */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100">
          <div className="bg-[#0d1117] border border-[#1e2535] rounded-lg px-2.5 py-1.5 text-center shadow-xl">
            <p className="text-[10px] font-bold text-white">
              {contact.fullName || contact.email?.split("@")[0]}
            </p>
            <p className="text-[8px] text-white/40">{contact.email}</p>
          </div>
        </div>
      </div>

      {/* Tooltip always visible next to bubble */}
      <div
        className="fixed z-[9998] pointer-events-none"
        style={{
          left: pos.x + 64,
          top: pos.y + 8,
        }}
      >
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl px-3 py-2 shadow-xl max-w-[160px]">
          <p className="text-[10px] font-bold text-white truncate">
            {contact.fullName || contact.email?.split("@")[0]}
          </p>
          <p className="text-[8px] text-[#4F67FF] mt-0.5">Дарж чатлах →</p>
        </div>
      </div>
    </>
  );
}
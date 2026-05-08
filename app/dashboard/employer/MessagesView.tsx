"use client";

import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, MoreVertical, Trash2, Edit2, User, ChevronLeft, MessageSquare } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { authenticatedDelete } from "@/lib/axiosClient";

export default function MessagesView({
  conversations,
  selectedContact,
  onSelectContact,
  senderId,
  socket,
  onOpenProfile,
  onScrollToInputReady,
}: any) {
  const [searchTerm, setSearchTerm]   = useState("");
  const [contextMenu, setContextMenu] = useState<{ convId: number; contact: any; x: number; y: number } | null>(null);
  const [renaming, setRenaming]       = useState<number | null>(null);
  const [newName, setNewName]         = useState("");
  const contextMenuRef   = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Mobile-only view switching (md+ keeps desktop two-column)
  const [mobileShowList, setMobileShowList] = useState(true);

  useEffect(() => {
    setMobileShowList(!selectedContact);
  }, [selectedContact]);

  const getParticipant = (conv: any) => ({
    id:       conv.participantId    ?? conv.id,
    email:    conv.participantEmail ?? conv.email    ?? "",
    fullName: conv.participantName  ?? conv.fullName ?? "",
  });

  const getDisplayName = (conv: any) => {
    const p = getParticipant(conv);
    return localStorage.getItem(`conv-name-${conv.id}`) || p.fullName || p.email.split("@")[0];
  };

  const filteredConversations = (conversations || []).filter((conv: any) => {
    const p = getParticipant(conv);
    return (p.fullName || p.email).toLowerCase().includes(searchTerm.toLowerCase());
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node))
        setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openContextMenu = (e: React.MouseEvent, conv: any) => {
    e.preventDefault(); e.stopPropagation();
    const p = getParticipant(conv);
    setContextMenu({ convId: conv.id, contact: { id: p.id, email: p.email, fullName: p.fullName }, x: e.clientX, y: e.clientY });
  };

  const handleRename = (convId: number, currentName: string) => {
    setRenaming(convId); setNewName(currentName); setContextMenu(null);
  };

  const handleSaveRename = (convId: number) => {
    if (newName.trim()) localStorage.setItem(`conv-name-${convId}`, newName.trim());
    setRenaming(null);
  };

  const handleDelete = async (convId: number) => {
    setContextMenu(null);
    if (!window.confirm("Энэ чатыг устгах уу?")) return;
    try {
      await authenticatedDelete(`http://localhost:5007/api/chat/clear/${senderId}/${convId}`);
      window.location.reload();
    } catch (err) { console.error("Delete failed:", err); }
  };

  // ── Bubble-ийг page.tsx-д нээнэ — tab солигдоход алга болохгүй ─────────
  const handleOpenProfile = (contact: any) => {
    setContextMenu(null);
    if (!selectedContact || Number(selectedContact.id) !== Number(contact.id))
      onSelectContact(contact);
    onOpenProfile?.(contact);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-transparent">
      {/* LEFT */}
      <div
        className={`w-[280px] border-r border-white/[0.06] bg-[#111827] flex flex-col overflow-hidden ${mobileShowList ? "block fixed inset-0" : "hidden"} md:static md:flex md:rounded-2xl md:border-0 md:bg-[#111827]`}
      >
        <div className="p-4 border-b border-white/[0.05] space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Мессежүүд</h3>
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2">
            <Search size={11} className="text-white/30 shrink-0" />
            <input placeholder="Хайх..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-white/25" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? filteredConversations.map((conv: any) => {
            const p = getParticipant(conv);
            const isSelected  = Number(selectedContact?.id) === Number(p.id);
            const displayName = getDisplayName(conv);
            return (
              <div key={conv.id} className="relative group">
                <div onClick={() => onSelectContact({ id: p.id, email: p.email, fullName: p.fullName })}
                  className={`p-3 border-b border-white/[0.03] cursor-pointer transition-all ${isSelected ? "bg-[#4F67FF]/10 border-l-2 border-l-[#4F67FF]" : "hover:bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-[#4F67FF]/20 rounded-lg flex items-center justify-center text-[9px] font-black text-[#4F67FF] shrink-0">
                      {(displayName?.[0] || p.email?.[0] || "U").toUpperCase()}
                    </div>
                    {renaming === conv.id ? (
                      <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                        onBlur={() => handleSaveRename(conv.id)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveRename(conv.id); if (e.key === "Escape") setRenaming(null); }}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 bg-[#1a2035] border border-[#4F67FF]/30 rounded px-2 py-1 text-[9px] text-white outline-none" />
                    ) : (
                      <p className="text-[11px] font-bold text-white truncate flex-1">{displayName}</p>
                    )}
                    <button onClick={e => openContextMenu(e, conv)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                      <MoreVertical size={13} className="text-white/40" />
                    </button>
                  </div>
                  <p className="text-[9px] text-white/40 truncate pl-9">{conv.lastMessage || "Мессеж байхгүй..."}</p>
                </div>
              </div>
            );
          }) : (
            <div className="flex items-center justify-center h-full text-white/40 text-[11px]">Яриа байхгүй</div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div ref={contextMenuRef} className="fixed z-[200] bg-[#0d1117] border border-[#1e2535] rounded-xl shadow-2xl py-1 w-44"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => handleRename(contextMenu.convId, getDisplayName(conversations.find((c: any) => c.id === contextMenu.convId) || {}))}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-white hover:bg-white/5 transition-all">
            <Edit2 size={12} className="text-white/50" /> Нэр солих
          </button>
          <button onClick={() => handleOpenProfile(contextMenu.contact)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-white hover:bg-white/5 transition-all border-t border-white/[0.04]">
            <User size={12} className="text-white/50" /> Дэлгэцэнд нэмэх
          </button>
          <button onClick={() => handleDelete(contextMenu.convId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-all border-t border-white/[0.04]">
            <Trash2 size={12} /> Чат устгах
          </button>
        </div>
      )}

      {/* RIGHT: Chat */}
      <div
        className={`flex-1 flex flex-col overflow-hidden relative ${mobileShowList ? "hidden" : "block"} md:flex md:static md:relative`}
        ref={chatContainerRef}
      >
        <AnimatePresence mode="wait" initial={false}>
          {selectedContact ? (
            <motion.div
              key={String(selectedContact.id ?? selectedContact)}
              className="h-full w-full"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <ChatWindow
                receiver={selectedContact}
                senderId={senderId}
                socket={socket}
                onProfileClick={() => handleOpenProfile(selectedContact)}
                onScrollToInput={(fn: () => void) => onScrollToInputReady?.(fn)}
                onBackMobile={() => onSelectContact(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="h-full w-full hidden md:flex items-center justify-center bg-[#111827] border border-white/[0.06] rounded-2xl text-white/40 text-[11px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <MessageSquare size={18} className="text-white/30" />
                <span>Яриа сонгоно уу</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

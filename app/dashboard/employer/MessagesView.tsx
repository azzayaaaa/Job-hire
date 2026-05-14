"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Circle, Edit2, MessageSquare, MoreVertical, Search, Trash2, User } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [contextMenu, setContextMenu] = useState<{ convId: number; contact: any; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [mobileShowList, setMobileShowList] = useState(true);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileShowList(!selectedContact);
  }, [selectedContact]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getParticipant = (conv: any) => ({
    id: conv.participantId ?? conv.id,
    email: conv.participantEmail ?? conv.email ?? "",
    fullName: conv.participantName ?? conv.fullName ?? "",
  });

  const getDisplayName = (conv: any) => {
    const p = getParticipant(conv);
    return localStorage.getItem(`conv-name-${conv.id}`) || p.fullName || p.email.split("@")[0];
  };

  const filteredConversations = (conversations || []).filter((conv: any) => {
    const p = getParticipant(conv);
    return (p.fullName || p.email || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  const openContextMenu = (e: React.MouseEvent, conv: any) => {
    e.preventDefault();
    e.stopPropagation();
    const p = getParticipant(conv);
    setContextMenu({
      convId: conv.id,
      contact: { id: p.id, email: p.email, fullName: p.fullName },
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleRename = (convId: number, currentName: string) => {
    setRenaming(convId);
    setNewName(currentName);
    setContextMenu(null);
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
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleOpenProfile = (contact: any) => {
    setContextMenu(null);
    if (!selectedContact || Number(selectedContact.id) !== Number(contact.id)) {
      onSelectContact(contact);
    }
    onOpenProfile?.(contact);
  };

  return (
    <div className="flex h-[calc(100dvh-116px)] min-h-0 w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b1120] shadow-2xl shadow-black/20 md:h-[calc(100dvh-112px)] md:rounded-3xl lg:h-[calc(100dvh-124px)]">
      <div
        className={`w-full border-r border-white/[0.06] bg-[#0d1426] flex flex-col overflow-hidden ${mobileShowList ? "block" : "hidden"} md:w-[320px] md:static md:flex`}
      >
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-white">Мессежүүд</h3>
            <p className="mt-1 text-[10px] font-semibold text-white/35">{filteredConversations.length} яриа</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#111827] px-3 py-2.5">
            <Search size={13} className="text-white/30 shrink-0" />
            <input
              placeholder="Хайх..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv: any) => {
              const p = getParticipant(conv);
              const isSelected = Number(selectedContact?.id) === Number(p.id);
              const displayName = getDisplayName(conv);

              return (
                <div key={conv.id} className="relative group">
                  <div
                    onClick={() => onSelectContact({ id: p.id, email: p.email, fullName: p.fullName })}
                    className={`cursor-pointer rounded-2xl p-3 transition-all ${isSelected ? "bg-[#4F67FF]/12 ring-1 ring-[#4F67FF]/25" : "hover:bg-white/[0.04]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#4F67FF]/18 text-[12px] font-black text-[#8fa0ff]">
                        {(displayName?.[0] || p.email?.[0] || "U").toUpperCase()}
                        {conv.isOnline && <Circle size={9} className="absolute bottom-0 right-0 fill-emerald-400 text-emerald-400" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {renaming === conv.id ? (
                            <input
                              autoFocus
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onBlur={() => handleSaveRename(conv.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename(conv.id);
                                if (e.key === "Escape") setRenaming(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 rounded-lg border border-[#4F67FF]/30 bg-[#1a2035] px-2 py-1 text-[11px] text-white outline-none"
                            />
                          ) : (
                            <p className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{displayName}</p>
                          )}
                          {Number(conv.unreadCount || 0) > 0 && (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                              {Number(conv.unreadCount || 0) > 9 ? "9+" : Number(conv.unreadCount || 0)}
                            </span>
                          )}
                          <button
                            onClick={(e) => openContextMenu(e, conv)}
                            className="rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                            aria-label="Conversation menu"
                          >
                            <MoreVertical size={14} className="text-white/45" />
                          </button>
                        </div>
                        <p className="truncate text-[11px] text-white/40">{conv.lastMessage || "Мессеж байхгүй..."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                <MessageSquare size={18} />
              </div>
              <p className="text-[12px] font-semibold">Яриа байхгүй</p>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] w-44 rounded-xl border border-[#1e2535] bg-[#0d1117] py-1 shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleRename(contextMenu.convId, getDisplayName(conversations.find((c: any) => c.id === contextMenu.convId) || {}))}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[11px] text-white transition-all hover:bg-white/5"
          >
            <Edit2 size={12} className="text-white/50" /> Нэр солих
          </button>
          <button
            onClick={() => handleOpenProfile(contextMenu.contact)}
            className="flex w-full items-center gap-2.5 border-t border-white/[0.04] px-3 py-2.5 text-[11px] text-white transition-all hover:bg-white/5"
          >
            <User size={12} className="text-white/50" /> Дэлгэцэнд нэмэх
          </button>
          <button
            onClick={() => handleDelete(contextMenu.convId)}
            className="flex w-full items-center gap-2.5 border-t border-white/[0.04] px-3 py-2.5 text-[11px] text-red-400 transition-all hover:bg-red-500/10"
          >
            <Trash2 size={12} /> Чат устгах
          </button>
        </div>
      )}

      <div
        className={`relative flex-1 flex-col overflow-hidden ${mobileShowList ? "hidden" : "block"} md:static md:relative md:flex`}
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
              className="hidden h-full w-full items-center justify-center bg-[#111827] text-[11px] text-white/40 md:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <MessageSquare size={22} className="text-white/30" />
                <span>Яриа сонгоно уу</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

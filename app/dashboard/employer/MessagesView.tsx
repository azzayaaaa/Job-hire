"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Circle, Edit2, MessageSquare, MoreVertical, Search, Star, Trash2, User } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { authenticatedDelete } from "@/lib/axiosClient";
import { API_URLS } from "@/lib/apiConfig";

type ChatFilter = "all" | "unread" | "marked";

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
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");
  const [markedConversationIds, setMarkedConversationIds] = useState<Set<number>>(new Set());
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
    try {
      const saved = JSON.parse(localStorage.getItem("jobhub-marked-conversations") || "[]");
      setMarkedConversationIds(new Set(Array.isArray(saved) ? saved.map(Number).filter(Number.isFinite) : []));
    } catch {
      setMarkedConversationIds(new Set());
    }
  }, []);

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

  const toggleMarked = (convId: number) => {
    setMarkedConversationIds((prev) => {
      const next = new Set(prev);
      const numericId = Number(convId);
      if (next.has(numericId)) next.delete(numericId);
      else next.add(numericId);
      localStorage.setItem("jobhub-marked-conversations", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filterTabs = [
    { key: "all" as const, label: "Бүх", count: conversations?.length || 0 },
    {
      key: "unread" as const,
      label: "Уншаагүй",
      count: (conversations || []).filter((conv: any) => Number(conv.unreadCount || 0) > 0).length,
    },
    {
      key: "marked" as const,
      label: "Тэмдэглэсэн",
      count: (conversations || []).filter((conv: any) => markedConversationIds.has(Number(conv.id))).length,
    },
  ];

  const filteredConversations = (conversations || []).filter((conv: any) => {
    const p = getParticipant(conv);
    const matchesSearch = (p.fullName || p.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "unread" && Number(conv.unreadCount || 0) > 0) ||
      (activeFilter === "marked" && markedConversationIds.has(Number(conv.id)));
    return matchesSearch && matchesFilter;
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
      await authenticatedDelete(API_URLS.chat.clear(senderId, convId));
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
    <div className="flex h-[calc(100dvh-116px)] min-h-0 w-full overflow-hidden rounded-none border border-[#1a2440]/80 bg-[#070c18] shadow-2xl shadow-black/30 md:h-[calc(100dvh-112px)] md:rounded-[10px] lg:h-[calc(100dvh-124px)]">
      <div
        className={`w-full border-r border-[#18223b] bg-[#080e1d] flex flex-col overflow-hidden ${mobileShowList ? "block" : "hidden"} md:w-[338px] md:static md:flex`}
      >
        <div className="border-b border-[#18223b] bg-[#090f20] p-4">
          <div className="mb-4">
            <h3 className="text-[20px] font-black tracking-[-0.01em] text-white">Мессежүүд</h3>
            <div className="mt-4 flex items-center gap-5 border-b border-[#1b2642] text-[12px] font-semibold">
              {filterTabs.map((tab) => {
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={`border-b-2 pb-2 transition ${
                      isActive
                        ? "border-[#7c5cff] text-[#a997ff]"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[8px] border border-[#1c2845] bg-[#0d1528] px-3 py-2.5 shadow-inner shadow-black/20">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Хайх..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[12px] text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv: any) => {
              const p = getParticipant(conv);
              const isSelected = Number(selectedContact?.id) === Number(p.id);
              const displayName = getDisplayName(conv);
              const isMarked = markedConversationIds.has(Number(conv.id));

              return (
                <div key={conv.id} className="relative group">
                  <div
                    onClick={() => onSelectContact({ id: p.id, email: p.email, fullName: p.fullName })}
                    className={`cursor-pointer rounded-[10px] p-3 transition-all ${isSelected ? "bg-[#131b34] ring-1 ring-[#2b3761]" : "hover:bg-[#10182d]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7357f6] to-[#4c35bc] text-[12px] font-black text-white shadow-lg shadow-[#6d50ef]/15">
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
                              className="flex-1 rounded-lg border border-[#6d50ef]/40 bg-[#10182d] px-2 py-1 text-[11px] text-white outline-none"
                            />
                          ) : (
                            <p className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{displayName}</p>
                          )}
                          {Number(conv.unreadCount || 0) > 0 && (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#7c5cff] px-1.5 py-0.5 text-[10px] font-black text-white">
                              {Number(conv.unreadCount || 0) > 9 ? "9+" : Number(conv.unreadCount || 0)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMarked(conv.id);
                            }}
                            className={`rounded-lg p-1 transition ${
                              isMarked
                                ? "text-[#a997ff]"
                                : "text-slate-600 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                            }`}
                            aria-label={isMarked ? "Unmark conversation" : "Mark conversation"}
                          >
                            <Star size={14} className={isMarked ? "fill-current" : ""} />
                          </button>
                          <button
                            onClick={(e) => openContextMenu(e, conv)}
                            className="rounded-lg p-1 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                            aria-label="Conversation menu"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                        <p className="truncate text-[11px] text-slate-500">{conv.lastMessage || "Мессеж байхгүй..."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#111a31]">
                <MessageSquare size={18} />
              </div>
              <p className="text-[12px] font-semibold">
                {activeFilter === "unread"
                  ? "Уншаагүй яриа байхгүй"
                  : activeFilter === "marked"
                    ? "Тэмдэглэсэн яриа байхгүй"
                    : "Яриа байхгүй"}
              </p>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] w-44 rounded-xl border border-[#1e2535] bg-[#0b1020] py-1 shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleRename(contextMenu.convId, getDisplayName(conversations.find((c: any) => c.id === contextMenu.convId) || {}))}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[11px] text-white transition-all hover:bg-white/5"
          >
            <Edit2 size={12} className="text-white/50" /> Нэр солих
          </button>
          <button
            onClick={() => {
              toggleMarked(contextMenu.convId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 border-t border-white/[0.04] px-3 py-2.5 text-[11px] text-white transition-all hover:bg-white/5"
          >
            <Star
              size={12}
              className={markedConversationIds.has(Number(contextMenu.convId)) ? "fill-[#a997ff] text-[#a997ff]" : "text-white/50"}
            />
            {markedConversationIds.has(Number(contextMenu.convId)) ? "Тэмдэглэгээ авах" : "Тэмдэглэх"}
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
              className="hidden h-full w-full items-center justify-center bg-[#070c18] text-[11px] text-slate-500 md:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <MessageSquare size={22} className="text-slate-600" />
                <span>Яриа сонгоно уу</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, Eye, Trash2, X } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { API_URLS } from "@/lib/apiConfig";

type Notification = {
  id: number;
  senderId: number;
  receiverId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  sender?: {
    id: number;
    fullName?: string;
    image?: string;
  };
  createdAt: string;
};

export default function NotificationCenter() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const userId = (session?.user as any)?.id;
  const hasLogged404Ref = useRef(false);

  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(API_URLS.notifications.list(userId));
      setNotifications(res.data || []);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        if (!hasLogged404Ref.current) {
          console.warn("Notifications endpoint returned 404 (treating as empty).");
          hasLogged404Ref.current = true;
        }
        setNotifications([]);
        return;
      }
      console.error("Failed to fetch notifications:", error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(API_URLS.notifications.unreadCount(userId));
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        if (!hasLogged404Ref.current) {
          console.warn("Unread-count endpoint returned 404 (treating as 0 unread).");
          hasLogged404Ref.current = true;
        }
        setUnreadCount(0);
        return;
      }
      console.error("Failed to fetch unread count:", error);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchUnreadCount();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await axios.put(API_URLS.notifications.markAsRead(notificationId));
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleDelete = async (notificationId: number) => {
    try {
      await axios.delete(API_URLS.notifications.delete(notificationId));
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      setUnreadCount((prev) => {
        const deleted = notifications.find((item) => item.id === notificationId);
        return deleted && !deleted.isRead ? Math.max(0, prev - 1) : prev;
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleOpenNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    if (!notification.link) return;

    const target = notification.link.startsWith("http")
      ? `${new URL(notification.link).pathname}${new URL(notification.link).search}`
      : notification.link;

    router.push(target);
    setShowDropdown(false);
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "JOB_OFFER":
        return "border-l-blue-500 bg-blue-500/5";
      case "JOB_SELECTED":
        return "border-l-green-500 bg-green-500/5";
      case "JOB_REJECTED":
        return "border-l-red-500 bg-red-500/5";
      case "MESSAGE":
        return "border-l-purple-500 bg-purple-500/5";
      default:
        return "border-l-gray-500 bg-gray-500/5";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        className="relative grid h-9 w-9 place-items-center rounded-xl text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 z-50 mt-2 max-h-[520px] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#111827] shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#111827] px-4 py-3">
            <h3 className="text-sm font-black text-white">Мэдэгдлүүд</h3>
            <button onClick={() => setShowDropdown(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Мэдэгдэл байхгүй байна</div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-l-4 p-4 transition-colors hover:bg-white/5 ${getNotificationColor(notification.type)} ${
                    !notification.isRead ? "bg-white/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notification.sender?.image ? (
                      <img
                        src={notification.sender.image}
                        alt={notification.sender.fullName || "sender"}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-500/15 text-sm font-black text-blue-300">
                        {(notification.sender?.fullName?.[0] || "J").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{notification.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-400">{notification.message}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString("mn-MN")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Уншсан болгох"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
                        title="Устгах"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {notification.link && (
                    <button
                      onClick={() => handleOpenNotification(notification)}
                      className="mt-3 inline-flex items-center rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-500/20"
                    >
                      Дэлгэрэнгүй →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

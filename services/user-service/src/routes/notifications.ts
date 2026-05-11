import express from "express";
import { PrismaClient } from "../lib/prismaClient";

const router = express.Router();
const prisma = new PrismaClient();

// Get all notifications for a user
router.get("/api/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await prisma.notification.findMany({
      where: { receiverId: Number(userId) },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(notifications);
  } catch (error: any) {
    console.error("[Notifications] Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get unread notification count
router.get("/api/notifications/:userId/unread", async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadCount = await prisma.notification.count({
      where: {
        receiverId: Number(userId),
        isRead: false,
      },
    });
    res.json({ unreadCount });
  } catch (error: any) {
    console.error("[Notifications] Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Create a notification
router.post("/api/notifications", async (req, res) => {
  try {
    const { senderId, receiverId, type, title, message, link } = req.body;

    const notification = await prisma.notification.create({
      data: {
        senderId: Number(senderId),
        receiverId: Number(receiverId),
        type,
        title,
        message,
        link: link || null,
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
    });

    res.json(notification);
  } catch (error: any) {
    console.error("[Notifications] Create notification error:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// Mark notification as read
router.put("/api/notifications/:notificationId/read", async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.update({
      where: { id: Number(notificationId) },
      data: { isRead: true },
    });

    res.json(notification);
  } catch (error: any) {
    console.error("[Notifications] Mark as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// Update notification preferences
router.put("/api/notifications/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailNotifications } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { emailNotifications },
      select: {
        id: true,
        email: true,
        emailNotifications: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    console.error("[Notifications] Update preferences error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// Delete notification
router.delete("/api/notifications/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;

    await prisma.notification.delete({
      where: { id: Number(notificationId) },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;

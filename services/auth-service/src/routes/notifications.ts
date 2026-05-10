import express from "express";
import axios from "axios";

const router = express.Router();
const USER_SERVICE_URL = "http://127.0.0.1:5005";

// Get all notifications for a user
router.get("/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await axios.get(`${USER_SERVICE_URL}/api/notifications/${userId}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch notifications",
      details: error.message,
    });
  }
});

// Get unread notification count
router.get("/notifications/:userId/unread", async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await axios.get(`${USER_SERVICE_URL}/api/notifications/${userId}/unread`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch unread count",
      details: error.message,
    });
  }
});

// Create a notification
router.post("/notifications", async (req, res) => {
  try {
    const { senderId, receiverId, type, title, message, link } = req.body;
    const response = await axios.post(`${USER_SERVICE_URL}/api/notifications`, {
      senderId,
      receiverId,
      type,
      title,
      message,
      link,
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to create notification",
      details: error.message,
    });
  }
});

// Mark notification as read
router.put("/notifications/:notificationId/read", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const response = await axios.put(
      `${USER_SERVICE_URL}/api/notifications/${notificationId}/read`
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to mark notification as read",
      details: error.message,
    });
  }
});

// Update notification preferences
router.put("/notifications/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailNotifications } = req.body;
    const response = await axios.put(
      `${USER_SERVICE_URL}/api/notifications/${userId}/preferences`,
      { emailNotifications }
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to update preferences",
      details: error.message,
    });
  }
});

// Delete notification
router.delete("/notifications/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    await axios.delete(`${USER_SERVICE_URL}/api/notifications/${notificationId}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: "Failed to delete notification",
      details: error.message,
    });
  }
});

export default router;

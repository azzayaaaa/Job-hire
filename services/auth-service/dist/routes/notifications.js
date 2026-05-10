"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const router = express_1.default.Router();
const USER_SERVICE_URL = "http://127.0.0.1:5005";
// Get all notifications for a user
router.get("/notifications/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const response = await axios_1.default.get(`${USER_SERVICE_URL}/api/notifications/${userId}`);
        res.json(response.data);
    }
    catch (error) {
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
        const response = await axios_1.default.get(`${USER_SERVICE_URL}/api/notifications/${userId}/unread`);
        res.json(response.data);
    }
    catch (error) {
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
        const response = await axios_1.default.post(`${USER_SERVICE_URL}/api/notifications`, {
            senderId,
            receiverId,
            type,
            title,
            message,
            link,
        });
        res.json(response.data);
    }
    catch (error) {
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
        const response = await axios_1.default.put(`${USER_SERVICE_URL}/api/notifications/${notificationId}/read`);
        res.json(response.data);
    }
    catch (error) {
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
        const response = await axios_1.default.put(`${USER_SERVICE_URL}/api/notifications/${userId}/preferences`, { emailNotifications });
        res.json(response.data);
    }
    catch (error) {
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
        await axios_1.default.delete(`${USER_SERVICE_URL}/api/notifications/${notificationId}`);
        res.json({ success: true });
    }
    catch (error) {
        res.status(error.response?.status || 500).json({
            error: "Failed to delete notification",
            details: error.message,
        });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = void 0;
const axios_1 = __importDefault(require("axios"));
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://127.0.0.1:5007/api/chat';
const sendMessage = async (req, res) => {
    try {
        const response = await axios_1.default.post(CHAT_SERVICE_URL, req.body);
        return res.status(200).json(response.data);
    }
    catch (error) {
        console.error("Chat Service Error:", error.message);
        res.status(500).json({ error: "Chat Service-тэй холбогдож чадсангүй" });
    }
};
exports.sendMessage = sendMessage;

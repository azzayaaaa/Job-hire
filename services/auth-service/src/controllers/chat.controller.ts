import { Request, Response } from 'express';
import axios from 'axios';

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://127.0.0.1:5007/api/chat';

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(CHAT_SERVICE_URL, req.body);
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Chat Service Error:", error.message);
    res.status(500).json({ error: "Chat Service-тэй холбогдож чадсангүй" });
  }
};

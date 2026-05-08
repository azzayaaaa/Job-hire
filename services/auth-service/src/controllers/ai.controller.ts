import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5004/api/ai';

export const askAi = async (req: Request, res: Response) => {
  const { prompt, userRole } = req.body;
  if (!prompt) return res.status(400).json({ error: "Асуулт илгээнэ үү" });

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/ask`, { prompt, userRole });
    res.status(200).json({ success: true, answer: response.data.answer });
  } catch (error: any) {
    console.error("AI Service Error:", error.message);
    res.status(500).json({ error: "AI Service-тэй холбогдож чадсангүй" });
  }
};

export const generateAiCV = async (req: Request, res: Response) => {
  const { userData, userId } = req.body;

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/cv`, { userData });
    const cvText = response.data.cvText || "";
    
    // Хэрэглэгчийн CV-г өгөгдлийн санд хадгалах
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { cvText }
    });

    res.status(200).json({ success: true, cvText });
  } catch (error: any) {
    console.error("AI Service Error (CV):", error.message);
    res.status(500).json({ error: "CV үүсгэхэд алдаа гарлаа" });
  }
};

export const getStudyPlan = async (req: Request, res: Response) => {
  const { userId, targetJobId } = req.body;
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/study-plan`, { userId, targetJobId });
    res.status(201).json({ success: true, studyPlan: response.data.studyPlan });
  } catch (error: any) {
    res.status(500).json({ error: "Төлөвлөгөө гаргахад алдаа гарлаа" });
  }
};

export const getMarketInsights = async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/market-insights`);
    res.status(200).json({ success: true, insights: response.data.insights });
  } catch (error: any) {
    res.status(500).json({ error: "Insights алдаа" });
  }
};

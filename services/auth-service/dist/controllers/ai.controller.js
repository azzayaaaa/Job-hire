"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketInsights = exports.getStudyPlan = exports.generateAiCV = exports.askAi = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5004/api/ai';
const askAi = async (req, res) => {
    const { prompt, userRole } = req.body;
    if (!prompt)
        return res.status(400).json({ error: "Асуулт илгээнэ үү" });
    try {
        const response = await axios_1.default.post(`${AI_SERVICE_URL}/ask`, { prompt, userRole });
        res.status(200).json({ success: true, answer: response.data.answer });
    }
    catch (error) {
        console.error("AI Service Error:", error.message);
        res.status(500).json({ error: "AI Service-тэй холбогдож чадсангүй" });
    }
};
exports.askAi = askAi;
const generateAiCV = async (req, res) => {
    const { userData, userId } = req.body;
    try {
        const response = await axios_1.default.post(`${AI_SERVICE_URL}/cv`, { userData });
        const cvText = response.data.cvText || "";
        // Хэрэглэгчийн CV-г өгөгдлийн санд хадгалах
        await prisma_1.default.user.update({
            where: { id: Number(userId) },
            data: { cvText }
        });
        res.status(200).json({ success: true, cvText });
    }
    catch (error) {
        console.error("AI Service Error (CV):", error.message);
        res.status(500).json({ error: "CV үүсгэхэд алдаа гарлаа" });
    }
};
exports.generateAiCV = generateAiCV;
const getStudyPlan = async (req, res) => {
    const { userId, targetJobId } = req.body;
    try {
        const response = await axios_1.default.post(`${AI_SERVICE_URL}/study-plan`, { userId, targetJobId });
        res.status(201).json({ success: true, studyPlan: response.data.studyPlan });
    }
    catch (error) {
        res.status(500).json({ error: "Төлөвлөгөө гаргахад алдаа гарлаа" });
    }
};
exports.getStudyPlan = getStudyPlan;
const getMarketInsights = async (req, res) => {
    try {
        const response = await axios_1.default.get(`${AI_SERVICE_URL}/market-insights`);
        res.status(200).json({ success: true, insights: response.data.insights });
    }
    catch (error) {
        res.status(500).json({ error: "Insights алдаа" });
    }
};
exports.getMarketInsights = getMarketInsights;

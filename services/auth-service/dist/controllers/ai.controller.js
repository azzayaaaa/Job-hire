"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketInsights = exports.getStudyPlan = exports.generateAiCV = exports.askAi = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
const askAi = async (req, res) => {
    const { prompt, userRole } = req.body;
    if (!prompt)
        return res.status(400).json({ error: "Асуулт илгээнэ үү" });
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Чи бол JobHub платформын ухаалаг туслах. Хэрэглэгчийн эрх: ${userRole}. Хариултыг үргэлж Монгол хэлээр, товч өг.`
                },
                { role: "user", content: prompt },
            ],
            model: "llama-3.3-70b-versatile",
        });
        res.status(200).json({ success: true, answer: chatCompletion.choices[0]?.message?.content || "" });
    }
    catch (error) {
        res.status(500).json({ error: "AI алдаа гарлаа" });
    }
};
exports.askAi = askAi;
const generateAiCV = async (req, res) => {
    const { userData, userId } = req.body;
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Чи бол мэргэжлийн CV бичигч AI. Өгөгдсөн текстийг ашиглан маш цэгцтэй, мэргэжлийн CV-ийн бүтэц (Монгол хэлээр) үүсгэж өгнө үү."
                },
                { role: "user", content: userData },
            ],
            model: "llama-3.3-70b-versatile",
        });
        const cvText = chatCompletion.choices[0]?.message?.content || "";
        // Хэрэглэгчийн CV-г хадгалах
        await prisma_1.default.user.update({
            where: { id: Number(userId) },
            data: { cvText }
        });
        res.status(200).json({ success: true, cvText });
    }
    catch (error) {
        res.status(500).json({ error: "CV үүсгэхэд алдаа гарлаа" });
    }
};
exports.generateAiCV = generateAiCV;
const getStudyPlan = async (req, res) => {
    const { userId, targetJobId } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: Number(userId) } });
        const job = await prisma_1.default.job.findUnique({ where: { id: Number(targetJobId) } });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Чи бол сургалтын ментор AI. Нэр дэвшигчийн CV болон ажлын шаардлагыг харьцуулж, яг ямар сэдвүүдийг сурах хэрэгтэйг 7 хоногийн төлөвлөгөө (Монгол хэлээр) болгон гаргана уу."
                },
                { role: "user", content: `CV: ${user?.cvText}. Ажлын шаардлага: ${job?.requirements}` },
            ],
            model: "llama-3.3-70b-versatile",
        });
        const plan = chatCompletion.choices[0]?.message?.content || "";
        const studyPlan = await prisma_1.default.studyPlan.create({
            data: {
                userId: Number(userId),
                title: `${job?.title} ажилд бэлдэх төлөвлөгөө`,
                content: plan
            }
        });
        res.status(201).json({ success: true, studyPlan });
    }
    catch (error) {
        res.status(500).json({ error: "Төлөвлөгөө гаргахад алдаа гарлаа" });
    }
};
exports.getStudyPlan = getStudyPlan;
const getMarketInsights = async (req, res) => {
    try {
        const jobs = await prisma_1.default.job.findMany({ take: 10 });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Зах зээлийн трендийг Монгол хэлээр, 3 өгүүлбэрт багтааж бичнэ үү."
                },
                { role: "user", content: JSON.stringify(jobs) },
            ],
            model: "llama-3.3-70b-versatile",
        });
        res.status(200).json({ success: true, insights: chatCompletion.choices[0]?.message?.content || "" });
    }
    catch (error) {
        res.status(500).json({ error: "Insights алдаа" });
    }
};
exports.getMarketInsights = getMarketInsights;

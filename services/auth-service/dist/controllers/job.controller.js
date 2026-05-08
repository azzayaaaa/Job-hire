"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidateStats = exports.getEmployerStats = exports.applyForJob = exports.getJobs = exports.createJob = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const createJob = async (req, res) => {
    const { title, description, requirements, location, salary, category, employerId } = req.body;
    try {
        const job = await prisma_1.default.job.create({
            data: {
                title,
                description,
                requirements,
                location,
                salary,
                category,
                employerId: Number(employerId),
            },
        });
        // IT чиглэлийн хэрэглэгчдэд мэдэгдэл илгээх (Энгийн хувилбар)
        const matchingUsers = await prisma_1.default.user.findMany({
            where: { userType: 'CANDIDATE' }, // Бодит байдал дээр энд 'category'-оор шүүнэ
            select: { email: true }
        });
        for (const user of matchingUsers) {
            transporter.sendMail({
                from: process.env.
                EMAIL_USER,
                to: user.email,
                subject: `Шинэ ажлын байр: ${title}`,
                html: `<p>Таны сонирхсон ${category} салбарт шинэ зар орлоо.</p><a href="http://localhost:3000/jobs/${job.id}">Үзэх</a>`
            }).catch(err => console.log("Email error:", err));
        }
        return res.status(201).json({ success: true, job });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Ажлын зар үүсгэхэд алдаа гарлаа" });
    }
};
exports.createJob = createJob;
const getJobs = async (req, res) => {
    try {
        const jobs = await prisma_1.default.job.findMany({
            where: { status: 'ACTIVE' },
            include: {
                employer: { select: { email: true } },
                applications: { select: { id: true } }
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json(jobs);
    }
    catch (error) {
        return res.status(500).json({ error: "Ажлын заруудыг авахад алдаа гарлаа" });
    }
};
exports.getJobs = getJobs;
const applyForJob = async (req, res) => {
    const { jobId, candidateId } = req.body;
    try {
        const job = await prisma_1.default.job.findUnique({ where: { id: Number(jobId) } });
        const user = await prisma_1.default.user.findUnique({ where: { id: Number(candidateId) } });
        if (!job || !user)
            return res.status(404).json({ error: "Мэдээлэл олдсонгүй" });
        // AI Matching Score тооцох
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Чи бол HR мэргэжилтэн AI. CV болон ажлын шаардлагыг харьцуулж 0-100 хооронд оноо өгч, юуг хөгжүүлэх хэрэгтэйг товч (Монгол хэлээр) хэлнэ үү. Хариулт ийм байх ёстой: {score: number, feedback: string}"
                },
                {
                    role: "user",
                    content: `Ажлын шаардлага: ${job.requirements}. Нэр дэвшигчийн CV: ${user.cvText || "Мэдээлэл байхгүй"}`
                },
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
        });
        const aiResponse = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
        const application = await prisma_1.default.jobApplication.create({
            data: {
                jobId: Number(jobId),
                candidateId: Number(candidateId),
                matchScore: aiResponse.score || 0,
                feedback: aiResponse.feedback || "",
            },
        });
        return res.status(201).json({ success: true, application });
    }
    catch (error) {
        if (error.code === 'P2002')
            return res.status(400).json({ error: "Та аль хэдийн хүсэлт илгээсэн байна" });
        return res.status(500).json({ error: "Хүсэлт илгээхэд алдаа гарлаа" });
    }
};
exports.applyForJob = applyForJob;
const getEmployerStats = async (req, res) => {
    const { employerId } = req.params;
    try {
        const totalJobs = await prisma_1.default.job.count({ where: { employerId: Number(employerId) } });
        return res.status(200).json({ totalJobs, totalChats: 0 });
    }
    catch (error) {
        return res.status(500).json({ error: "Статистик авахад алдаа гарлаа" });
    }
};
exports.getEmployerStats = getEmployerStats;
const getCandidateStats = async (req, res) => {
    const { candidateId } = req.params;
    try {
        const totalApplications = await prisma_1.default.jobApplication.count({ where: { candidateId: Number(candidateId) } });
        return res.status(200).json({ totalApplications });
    }
    catch (error) {
        return res.status(500).json({ error: "Статистик авахад алдаа гарлаа" });
    }
};
exports.getCandidateStats = getCandidateStats;

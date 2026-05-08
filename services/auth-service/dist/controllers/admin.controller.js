"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserRole = exports.updateUserCredits = exports.getAllUsers = exports.getAdminStats = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getAdminStats = async (req, res) => {
    try {
        // 1. Нийт хэрэглэгчдийн тоо
        const totalUsers = await prisma_1.default.user.count();
        // 2. Идэвхтэй ажлын заруудын тоо
        const activeJobs = await prisma_1.default.job.count({
            where: { status: 'ACTIVE' }
        });
        // 3. Сүүлд бүртгүүлсэн 5 компанийг (Employer) авах
        const recentCompanies = await prisma_1.default.user.findMany({
            where: { userType: 'EMPLOYER' },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                credits: true,
                createdAt: true
                // Хэрэв Profile модел байгаа бол нэрийг нь эндээс авч болно
            }
        });
        // 4. Систем хэмжээнд ашиглагдсан нийт кредитийг тооцох
        // Хэрэглэгч бүрт анх 10 кредит өгдөг гэж тооцвол:
        const users = await prisma_1.default.user.findMany({
            select: { credits: true }
        });
        // Анх өгсөн 10-аас одоо байгаа үлдэгдлийг хасаад ашигласан кредитийг гаргана
        const totalCreditsUsed = users.reduce((acc, user) => {
            const used = 10 - user.credits;
            return acc + (used > 0 ? used : 0);
        }, 0);
        // 5. Хариултаа Frontend-ийн хүлээж авах бүтцэд тааруулж илгээх
        return res.status(200).json({
            totalUsers,
            activeJobs,
            totalCreditsUsed,
            complaints: 0, // Одоогоор гомдол бүртгэх моделгүй байгаа тул 0
            recentCompanies: recentCompanies.map(company => ({
                id: company.id,
                name: company.email.split('@')[0], // Имэйлийн эхний хэсгийг нэр болгов
                industry: "Мэдээлэл технологи", // Жишээ дата
                credits: company.credits
            }))
        });
    }
    catch (error) {
        console.error("Admin stats error:", error);
        return res.status(500).json({ error: "Сервер дээр статистик боловсруулахад алдаа гарлаа." });
    }
};
exports.getAdminStats = getAdminStats;
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            select: {
                id: true,
                email: true,
                userType: true,
                credits: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(users);
    }
    catch (error) {
        return res.status(500).json({ error: "Хэрэглэгчдийг авахад алдаа гарлаа" });
    }
};
exports.getAllUsers = getAllUsers;
const updateUserCredits = async (req, res) => {
    const { userId, credits } = req.body;
    try {
        const user = await prisma_1.default.user.update({
            where: { id: Number(userId) },
            data: { credits: Number(credits) }
        });
        return res.status(200).json({ success: true, user });
    }
    catch (error) {
        return res.status(500).json({ error: "Кредит шинэчлэхэд алдаа гарлаа" });
    }
};
exports.updateUserCredits = updateUserCredits;
const updateUserRole = async (req, res) => {
    const { userId, userType } = req.body;
    try {
        const user = await prisma_1.default.user.update({
            where: { id: Number(userId) },
            data: { userType }
        });
        return res.status(200).json({ success: true, user });
    }
    catch (error) {
        return res.status(500).json({ error: "Эрх шинэчлэхэд алдаа гарлаа" });
    }
};
exports.updateUserRole = updateUserRole;

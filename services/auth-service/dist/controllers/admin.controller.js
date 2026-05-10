"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.updateUserCredits = exports.getAllUsers = exports.getAdminStats = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://127.0.0.1:5005/api/users';
const fetchAllUsersFromUserService = async () => {
    const res = await axios_1.default.get(`${USER_SERVICE_URL}/admin/all`);
    return res.data;
};
const getAdminStats = async (req, res) => {
    try {
        // jobs may still live in auth-service DB depending on your setup
        const activeJobs = await prisma_1.default.job.count({ where: { status: 'ACTIVE' } });
        const users = await fetchAllUsersFromUserService();
        const totalUsers = users?.length || 0;
        const totalCreditsUsed = (users || []).reduce((acc, user) => {
            const credits = Number(user.credits) || 0;
            const used = 10 - credits;
            return acc + (used > 0 ? used : 0);
        }, 0);
        const sortedEmployers = (users || [])
            .filter((u) => u.userType === 'EMPLOYER')
            .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        const recentCompanies = sortedEmployers.slice(0, 5).map((company) => ({
            id: company.id,
            name: company.email ? company.email.split('@')[0] : 'Unknown',
            industry: 'Мэдээлэл технологи',
            credits: company.credits || 0
        }));
        return res.status(200).json({
            totalUsers: totalUsers || 0,
            activeJobs: activeJobs || 0,
            totalCreditsUsed: totalCreditsUsed || 0,
            complaints: 0,
            recentCompanies
        });
    }
    catch (error) {
        console.error('Admin stats error:', error?.message || error);
        return res.status(500).json({
            error: 'Сервер дээр статистик боловсруулахад алдаа гарлаа.',
            details: error?.message || 'Unknown error'
        });
    }
};
exports.getAdminStats = getAdminStats;
const getAllUsers = async (req, res) => {
    try {
        const users = await fetchAllUsersFromUserService();
        return res.status(200).json(users);
    }
    catch (error) {
        console.error('Admin users error:', error?.message || error);
        return res.status(500).json({ error: 'Хэрэглэгчдийг авахад алдаа гарлаа' });
    }
};
exports.getAllUsers = getAllUsers;
const updateUserCredits = async (req, res) => {
    const { userId, credits } = req.body;
    try {
        const response = await axios_1.default.post(`${USER_SERVICE_URL}/admin/update-credits`, {
            userId,
            credits
        });
        const io = req.app.get('io');
        if (io)
            io.to('admin-room').emit('admin-data-updated');
        return res.status(200).json(response.data);
    }
    catch (error) {
        console.error('Admin updateUserCredits error:', error?.message || error);
        return res.status(500).json({ error: 'Кредит шинэчлэхэд алдаа гарлаа' });
    }
};
exports.updateUserCredits = updateUserCredits;
const updateUserRole = async (req, res) => {
    const { userId, userType } = req.body;
    try {
        const response = await axios_1.default.post(`${USER_SERVICE_URL}/admin/update-role`, {
            userId,
            userType
        });
        const io = req.app.get('io');
        if (io)
            io.to('admin-room').emit('admin-data-updated');
        return res.status(200).json(response.data);
    }
    catch (error) {
        console.error('Admin updateUserRole error:', error?.message || error);
        return res.status(500).json({ error: 'Эрх шинэчлэхэд алдаа гарлаа' });
    }
};
exports.updateUserRole = updateUserRole;
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await axios_1.default.delete(`${USER_SERVICE_URL}/admin/users/${id}`);
        const io = req.app.get('io');
        if (io)
            io.to('admin-room').emit('admin-data-updated');
        return res.status(200).json(response.data);
    }
    catch (error) {
        console.error('Admin deleteUser error:', error?.message || error);
        return res.status(500).json({ error: 'Хэрэглэгч устгахад алдаа гарлаа' });
    }
};
exports.deleteUser = deleteUser;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleLogin = exports.login = exports.register = exports.verifyCode = exports.sendCode = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
dotenv_1.default.config();
const verificationCodes = {};
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const sendCode = async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ error: "Имэйл хаяг шаардлагатай" });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: "Энэ имэйл бүртгэлтэй байна." });
        verificationCodes[email] = code;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'JobHub - Баталгаажуулах код',
            html: `<div style="padding: 20px; border: 1px solid #eee;"><h2>Код: ${code}</h2></div>`,
        });
        console.log(`Generated OTP for ${email}: ${code}`);
        return res.status(200).json({ success: true, message: "Код илгээгдлээ" });
    }
    catch (error) {
        console.error("Email send error:", error);
        // Development mode: return code even if email fails
        verificationCodes[email] = code;
        console.log(`FALLBACK OTP for ${email}: ${code}`);
        return res.status(200).json({
            success: true,
            message: "Код илгээхэд алдаа гарлаа (Dev mode: Check console)",
            debugCode: code // Түр зуур энд буцааж байна
        });
    }
};
exports.sendCode = sendCode;
const verifyCode = async (req, res) => {
    const { email, code } = req.body;
    if (verificationCodes[email] && verificationCodes[email] === code) {
        return res.status(200).json({ success: true, message: "Код баталгаажлаа" });
    }
    return res.status(400).json({ error: "Код буруу эсвэл хугацаа нь дууссан байна" });
};
exports.verifyCode = verifyCode;
const register = async (req, res) => {
    const { email, password, userType, code, invitedByCode } = req.body;
    if (!verificationCodes[email] || verificationCodes[email] !== code) {
        return res.status(400).json({ error: "Код буруу байна" });
    }
    try {
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const myReferralCode = crypto_1.default.randomBytes(4).toString('hex');
        let inviterId = null;
        if (invitedByCode) {
            const inviter = await prisma_1.default.user.findUnique({ where: { referralCode: invitedByCode } });
            if (inviter) {
                inviterId = inviter.id;
            }
        }
        const newUser = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                userType,
                credits: 10,
                referralCode: myReferralCode,
                referredBy: inviterId
            },
        });
        if (inviterId) {
            await prisma_1.default.user.update({
                where: { id: inviterId },
                data: { credits: { increment: 5 } }
            });
        }
        delete verificationCodes[email];
        return res.status(201).json({
            success: true,
            user: { id: newUser.id, email: newUser.email, credits: newUser.credits }
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Бүртгэл амжилтгүй" });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "Энэ имэйл хаяг бүртгэлгүй байна." });
        }
        if (!user.password) {
            return res.status(400).json({ error: "Энэ хэрэглэгч нууц үг тохируулаагүй байна (Google-ээр нэвтэрнэ үү)." });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Нууц үг буруу байна." });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1d' });
        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                credits: user.credits,
                referralCode: user.referralCode
            }
        });
    }
    catch (error) {
        return res.status(500).json({ error: "Нэвтрэхэд алдаа гарлаа" });
    }
};
exports.login = login;
const googleLogin = async (req, res) => {
    const { email } = req.body;
    const isAdmin = email === "azzayabayartai07@gmail.com";
    const role = isAdmin ? "ADMIN" : "CANDIDATE";
    try {
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        const user = await prisma_1.default.user.upsert({
            where: { email },
            update: { userType: isAdmin ? "ADMIN" : undefined }, // Хэрэв админ имэйл бол эрхийг нь үргэлж ADMIN байлгана
            create: {
                email,
                userType: role,
                password: "",
                credits: 10,
                referralCode: crypto_1.default.randomBytes(4).toString('hex')
            },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1d' });
        return res.status(200).json({ success: true, token, user });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Google нэвтрэлт амжилтгүй" });
    }
};
exports.googleLogin = googleLogin;

import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://127.0.0.1:5005/api/users';
const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL || 'http://127.0.0.1:5006/api/notify';

const verificationCodes: Record<string, { code: string, expiresAt: number }> = {};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function verificationEmailTemplate(title: string, code: string, description: string) {
  return `
    <div style="margin:0;padding:32px;background:#f3f6fb;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden">
        <div style="padding:28px;background:linear-gradient(135deg,#0f172a,#2563eb);color:#ffffff">
          <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.8">JobHub security</div>
          <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:30px;text-align:center">
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4b5563">${escapeHtml(description)}</p>
          <div style="display:inline-block;letter-spacing:10px;font-size:34px;font-weight:900;color:#111827;background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;padding:18px 20px 18px 30px">
            ${escapeHtml(code)}
          </div>
          <p style="margin:22px 0 0;font-size:13px;color:#6b7280">Код 2 минутын хугацаанд хүчинтэй.</p>
          <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тооно уу.</p>
        </div>
      </div>
    </div>
  `;
}

// NOTE: send-code/register primarily relies on in-memory codes + notify-service email.
// This endpoint previously swallowed the upstream error; now it returns details.
export const sendCode = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Имэйл хаяг шаардлагатай" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 2 * 60 * 1000;

// NOTE: use user-service as the source of truth for whether email is already registered.
  try {
    try {
      await axios.get(`${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`);
      return res.status(400).json({ error: "Энэ имэйл бүртгэлтэй байна." });
    } catch (e: any) {
      if (e?.response?.status !== 404) throw e;
      // 404 => not found => ok to register/send code
    }

    verificationCodes[email] = { code, expiresAt };

    await axios.post(`${NOTIFY_SERVICE_URL}/send-email`, {
      to: email,
      subject: 'JobHub - Баталгаажуулах код',
      html: verificationEmailTemplate(
        'Бүртгэлийн код',
        code,
        'JobHub бүртгэлээ баталгаажуулахын тулд доорх кодыг оруулна уу.',
      )
    });

    return res.status(200).json({ success: true, message: "Код илгээгдлээ" });
  } catch (error: any) {
    const details =
      error?.response?.data?.error ||
      error?.response?.data ||
      error?.message ||
      "Unknown notify-service error";

    console.error("sendCode error:", { details, email });

    return res.status(500).json({
      error: "Имэйл илгээхэд алдаа гарлаа.",
      details,
    });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, userType, code, invitedByCode } = req.body;
  const entry = verificationCodes[email];

  if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
    return res.status(400).json({ error: "Код буруу эсвэл хугацаа нь дууссан байна" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const myReferralCode = crypto.randomBytes(4).toString('hex');

    let inviterId: number | null = null;
    if (invitedByCode) {
      const inviterRes = await axios.get(
        `${USER_SERVICE_URL}/by-referral/${encodeURIComponent(invitedByCode)}`
      );
      inviterId = inviterRes.data?.id ?? null;
    }

    // 1. USER SERVICE РҮҮ ХҮСЭЛТ ЯВУУЛЖ ХЭРЭГЛЭГЧ ҮҮСГЭХ
    const userRes = await axios.post(`${USER_SERVICE_URL}/create`, {
      email,
      password: hashedPassword,
      userType,
      credits: inviterId ? 15 : 10,
      referralCode: myReferralCode,
      referredBy: inviterId
    });

    if (userRes.status === 201 || userRes.status === 200) {
      console.log(`[User Service] 200 OK - New user created successfully`);
      console.log(`[Auth Service] 200 OK - Registration process completed`);
      const newUser = userRes.data.user;

      const io = req.app.get('io');
      if (io) io.to('admin-room').emit('admin-data-updated');

      // 2. БАЯР ХҮРГЭХ ИМЭЙЛ (NOTIFY SERVICE)
      await axios.post(`${NOTIFY_SERVICE_URL}/send-email`, {
        to: email,
        subject: 'JobHub-д тавтай морил! 🎁',
        html: `<h1>Бүртгэл амжилттай боллоо!</h1><p>Танд ${newUser.credits} кредит бэлэглэлээ.</p>`
      });

      delete verificationCodes[email];
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, userType: newUser.userType }, 
        process.env.JWT_SECRET || 'Azzaya0707@1', 
        { expiresIn: '1d' }
      );

      return res.status(201).json({ success: true, token, user: newUser });
    }
  } catch (error: any) {
    console.error("Register Error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Бүртгэл амжилтгүй боллоо" });
  }
};

// Credentials login should use user-service DB (where register created users).
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const userRes = await axios.get(`${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`);
    let user = userRes.data;

    if (!user || !user.password) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Нууц үг буруу байна" });

    if (email === "azzayabayartai07@gmail.com" && user.userType !== "ADMIN") {
      await axios.post(`${USER_SERVICE_URL}/admin/update-role`, {
        userId: user.id,
        userType: "ADMIN",
      });
      const refreshedRes = await axios.get(`${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`);
      user = refreshedRes.data;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET || 'Azzaya0707@1',
      { expiresIn: '1d' }
    );

    return res.status(200).json({ success: true, token, user });
  } catch (error: any) {
    if (error?.response?.status === 404) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    return res.status(500).json({ error: "Нэвтрэхэд алдаа гарлаа" });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;
  
  // 1. Санах ойноос шалгах (Бүртгэлд зориулсан)
  const entry = verificationCodes[email];
  if (entry && entry.code === code && Date.now() <= entry.expiresAt) {
    return res.status(200).json({ success: true, message: "Бүртгэлийн код баталгаажлаа" });
  }

  // 2. User-service өгөгдлийн сангаас шалгах (Нууц үг сэргээхэд зориулсан)
  try {
    const userRes = await axios.get(`${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`);
    const user = userRes.data;
    if (user && user.verificationCode === code) {
      return res.status(200).json({ success: true, message: "Сэргээх код баталгаажлаа" });
    }
  } catch (error) {
    console.error("Verify Code Error:", error);
  }

  return res.status(400).json({ error: "Код буруу эсвэл хугацаа нь дууссан байна" });
};

// Google login must use user-service DB (where the user records live).
export const googleLogin = async (req: Request, res: Response) => {
  const { email, name, image, userType: requestedUserType } = req.body;
  try {
    console.log(`[Auth Service] Google login attempt for: ${email}`);

    // 1) If user exists => update profile in user-service
    try {
      const existingRes = await axios.get(
        `${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`
      );
      const existingUser = existingRes.data;
      const shouldForceAdmin = email === "azzayabayartai07@gmail.com";

      await axios.post(`${USER_SERVICE_URL}/update-profile`, {
        id: existingUser.id,
        fullName: name ?? undefined,
        image: image ?? undefined
      });

      if (shouldForceAdmin && existingUser.userType !== "ADMIN") {
        await axios.post(`${USER_SERVICE_URL}/admin/update-role`, {
          userId: existingUser.id,
          userType: "ADMIN",
        });
      }

      const refreshedRes = await axios.get(
        `${USER_SERVICE_URL}/profile/${existingUser.id}`
      );

      const user = refreshedRes.data;

      const token = jwt.sign(
        { id: user.id, email: user.email, userType: user.userType },
        process.env.JWT_SECRET || "Azzaya0707@1",
        { expiresIn: "1d" }
      );

      return res.status(200).json({ success: true, token, user });
    } catch (e: any) {
      if (e?.response?.status !== 404) throw e;
      // 404 => create new user below
    }

    // 2) Create new user in user-service
    let newUserType = "CANDIDATE";
    if (email === "azzayabayartai07@gmail.com") {
      newUserType = "ADMIN";
    } else if (
      requestedUserType &&
      ["CANDIDATE", "EMPLOYER", "ADMIN"].includes(String(requestedUserType).toUpperCase())
    ) {
      newUserType = String(requestedUserType).toUpperCase();
    }

    const referralCode = crypto.randomBytes(4).toString("hex");

    const createRes = await axios.post(`${USER_SERVICE_URL}/create`, {
      email,
      password: "",
      userType: newUserType,
      credits: 10,
      referralCode,
      referredBy: null,
    });

    const newUser = createRes.data?.user;

    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin-data-updated');

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, userType: newUser.userType },
      process.env.JWT_SECRET || "Azzaya0707@1",
      { expiresIn: "1d" }
    );

    return res.status(200).json({ success: true, token, user: newUser });
  } catch (error: any) {
    console.error("Google login controller error:", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      url: error?.config?.url,
    });
    return res.status(500).json({ error: "Google login failed", details: error?.response?.data || error?.message });
  }
};

export const getUserProfile = async (req: any, res: Response) => {
  const { id } = req.params;
  
  // SECURITY FIX: Verify that the authenticated user is requesting their own profile
  if (!req.user || Number(req.user.id) !== Number(id)) {
    return res.status(403).json({ error: "Өөрийнхөө профайл л харах боломжтой" });
  }

  try {
    const response = await axios.get(`${USER_SERVICE_URL}/profile/${id}`);
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ error: "Мэдээлэл авахад алдаа гарлаа" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const userRes = await axios.get(`${USER_SERVICE_URL}/by-email/${encodeURIComponent(email)}`);
    const user = userRes.data;
    if (!user) return res.status(404).json({ error: "Бүртгэлгүй имэйл" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await axios.post(`${USER_SERVICE_URL}/internal/set-verification-code`, {
      email,
      code
    });

    await axios.post(`${NOTIFY_SERVICE_URL}/send-email`, {
      to: email,
      subject: "Нууц үг сэргээх",
      html: verificationEmailTemplate(
        'Нууц үг сэргээх код',
        code,
        'Нууц үгээ шинэчлэхийн тулд доорх баталгаажуулах кодыг ашиглана уу.',
      )
    });

    return res.status(200).json({ success: true, message: "Код имэйлээр илгээгдлээ" });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return res.status(404).json({ error: "Бүртгэлгүй имэйл" });
    }

    console.error("Forgot Password Error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Алдаа гарлаа", details: error.response?.data || error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const resetRes = await axios.post(`${USER_SERVICE_URL}/internal/reset-password`, {
      email,
      code,
      password: hashedPassword
    });

    return res.status(200).json({
      success: true,
      message: "Нууц үг амжилттай шинэчлэгдлээ",
      user: resetRes.data?.user
    });
  } catch (error: any) {
    if (error?.response?.status === 400) {
      return res.status(400).json({ error: error.response.data?.error || "Код буруу" });
    }
    if (error?.response?.status === 404) {
      return res.status(404).json({ error: "Хэрэглэгч олдсонгүй" });
    }

    console.error("Reset Password Error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Алдаа гарлаа", details: error.response?.data || error.message });
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  const { userId: bodyUserId, fullName, email, phone, website, location, description, logo, cvText, cvFileName } = req.body;
  const userId = bodyUserId || req.params.id;
  
  if (!userId) {
    return res.status(400).json({ error: "userId шаардлагатай" });
  }

  console.log(`[Auth Service] updateUserProfile called for user ${userId}:`, {
    hasCVText: !!cvText,
    cvTextLength: cvText?.length || 0,
    cvFileName: cvFileName || "(none)",
    fullName: fullName || "(none)",
    website: website || "(none)",
    location: location || "(none)",
  });

  try {
    // Forward to user-service for profile update
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;
    if (cvText !== undefined) updateData.cvText = cvText;
    if (cvFileName !== undefined) updateData.cvFileName = cvFileName;

    console.log(`[Auth Service] Forwarding update to user-service:`, {
      id: userId,
      updateFields: Object.keys(updateData),
      hasCVText: !!updateData.cvText,
    });

    const response = await axios.post(`${USER_SERVICE_URL}/update-profile`, {
      id: userId,
      ...updateData
    });

    console.log(`[Auth Service] User-service returned:`, {
      id: response.data.id,
      hasCVText: !!response.data.cvText,
      cvFileName: response.data.cvFileName,
    });

    return res.status(200).json({ success: true, user: response.data });
  } catch (error: any) {
    console.error("Update Profile Error:", error.message);
    console.error("Error response from user-service:", error.response?.data);
    console.error("Full error:", error);
    return res.status(500).json({ 
      error: "Профайл шинэчлэхэд алдаа гарлаа", 
      details: error.response?.data?.details || error.message 
    });
  }
};

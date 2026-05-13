import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://127.0.0.1:5005/api/users';

type AdminUser = {
  id: number;
  email: string;
  userType: string;
  credits: number;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | Date | null;
  createdAt?: string | Date;
};

const fetchAllUsersFromUserService = async (): Promise<AdminUser[]> => {
  const res = await axios.get(`${USER_SERVICE_URL}/admin/all`);
  return res.data;
};

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    // jobs may still live in auth-service DB depending on your setup
    const activeJobs = await prisma.job.count({ where: { status: 'ACTIVE' } });

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
  } catch (error: any) {
    console.error('Admin stats error:', error?.message || error);
    return res.status(500).json({
      error: 'Сервер дээр статистик боловсруулахад алдаа гарлаа.',
      details: error?.message || 'Unknown error'
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await fetchAllUsersFromUserService();
    return res.status(200).json(users);
  } catch (error: any) {
    console.error('Admin users error:', error?.message || error);
    return res.status(500).json({ error: 'Хэрэглэгчдийг авахад алдаа гарлаа' });
  }
};

export const updateUserCredits = async (req: Request, res: Response) => {
  const { userId, credits } = req.body;

  try {
    const response = await axios.post(`${USER_SERVICE_URL}/admin/update-credits`, {
      userId,
      credits
    });

    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin-data-updated');

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Admin updateUserCredits error:', error?.message || error);
    return res.status(500).json({ error: 'Кредит шинэчлэхэд алдаа гарлаа' });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  const { userId, userType } = req.body;

  try {
    const response = await axios.post(`${USER_SERVICE_URL}/admin/update-role`, {
      userId,
      userType
    });

    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin-data-updated');

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Admin updateUserRole error:', error?.message || error);
    return res.status(500).json({ error: 'Эрх шинэчлэхэд алдаа гарлаа' });
  }
};

export const updateUserPlan = async (req: Request, res: Response) => {
  const { userId, plan, duration } = req.body;

  try {
    const response = await axios.post(`${USER_SERVICE_URL}/admin/update-plan`, {
      userId,
      plan,
      duration,
    });

    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin-data-updated');

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Admin updateUserPlan error:', error?.message || error);
    return res.status(500).json({ error: 'Plan шинэчлэхэд алдаа гарлаа' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const response = await axios.delete(`${USER_SERVICE_URL}/admin/users/${id}`);

    const io = req.app.get('io');
    if (io) io.to('admin-room').emit('admin-data-updated');

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Admin deleteUser error:', error?.message || error);
    return res.status(500).json({ error: 'Хэрэглэгч устгахад алдаа гарлаа' });
  }
};

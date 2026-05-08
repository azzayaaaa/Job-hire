import { Router } from 'express';
import { 
    sendCode, 
    verifyCode, 
    register, 
    login, 
    googleLogin, 
    getUserProfile,
    updateUserProfile,
    forgotPassword, 
    resetPassword 
} from '../controllers/auth.controller';
import { 
    getAllUsers, 
    getAdminStats, 
    updateUserCredits, 
    updateUserRole, 
    deleteUser 
} from '../controllers/admin.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Auth routes
router.post('/send-code', sendCode);
router.post('/verify', verifyCode);
router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/profile/:id', authMiddleware, getUserProfile); // SECURITY FIX: Added authMiddleware
router.patch('/profile/:id', authMiddleware, updateUserProfile);
router.post('/update-profile', authMiddleware, updateUserProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Admin routes - PROTECTED
router.get('/admin/stats', authMiddleware, adminMiddleware, getAdminStats);
router.get('/admin/users', authMiddleware, adminMiddleware, getAllUsers);
router.post('/admin/update-credits', authMiddleware, adminMiddleware, updateUserCredits);
router.post('/admin/update-role', authMiddleware, adminMiddleware, updateUserRole);
router.delete('/admin/users/:id', authMiddleware, adminMiddleware, deleteUser);

export default router;

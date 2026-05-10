"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Auth routes
router.post('/send-code', auth_controller_1.sendCode);
router.post('/verify', auth_controller_1.verifyCode);
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/google-login', auth_controller_1.googleLogin);
router.get('/profile/:id', auth_middleware_1.authMiddleware, auth_controller_1.getUserProfile); // SECURITY FIX: Added authMiddleware
router.patch('/profile/:id', auth_middleware_1.authMiddleware, auth_controller_1.updateUserProfile);
router.post('/update-profile', auth_middleware_1.authMiddleware, auth_controller_1.updateUserProfile);
router.post('/forgot-password', auth_controller_1.forgotPassword);
router.post('/reset-password', auth_controller_1.resetPassword);
// Admin routes - PROTECTED
router.get('/admin/stats', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, admin_controller_1.getAdminStats);
router.get('/admin/users', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, admin_controller_1.getAllUsers);
router.post('/admin/update-credits', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, admin_controller_1.updateUserCredits);
router.post('/admin/update-role', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, admin_controller_1.updateUserRole);
router.delete('/admin/users/:id', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, admin_controller_1.deleteUser);
exports.default = router;

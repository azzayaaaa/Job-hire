"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const auth_controller_1 = require("./controllers/auth.controller");
const admin_controller_1 = require("./controllers/admin.controller");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Core Auth Routes
app.post('/api/auth/send-code', auth_controller_1.sendCode);
app.post('/api/auth/register', auth_controller_1.register);
app.post('/api/auth/login', auth_controller_1.login);
app.post('/api/auth/google-login', auth_controller_1.googleLogin);
// Admin Routes (Manage Users)
app.get('/api/admin/stats', admin_controller_1.getAdminStats);
app.get('/api/admin/users', admin_controller_1.getAllUsers);
app.post('/api/admin/update-credits', admin_controller_1.updateUserCredits);
app.post('/api/admin/update-role', admin_controller_1.updateUserRole);
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Auth Service running on http://localhost:${PORT}`);
});

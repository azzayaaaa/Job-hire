"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const hpp_1 = __importDefault(require("hpp"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const job_routes_1 = __importDefault(require("./routes/job.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const notifications_1 = __importDefault(require("./routes/notifications"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    }
});
// Attach io to app so it can be used in controllers
app.set('io', io);
io.on('connection', (socket) => {
    socket.on('join-admin', () => {
        socket.join('admin-room');
        console.log('Admin joined admin-room');
    });
});
// 1. Security Headers (Helmet) - HTTP толгой мэдээллийг хамгаалах
app.use((0, helmet_1.default)());
// 2. HTTP Parameter Pollution protection
app.use((0, hpp_1.default)());
// 3. Global Rate Limiter - Нийт хүсэлтийн хязгаар
const globalLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Нэмэгдүүлсэн
    message: { error: "Хэт их хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." },
    standardHeaders: true,
    legacyHeaders: false,
});
// 4. Auth Rate Limiter - Нэвтрэх, бүртгүүлэхэд зориулсан хязгаар
const authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Нэмэгдүүлсэн
    message: { error: "Аюулгүй байдлын үүднээс түр хязгаарлалт хийлээ. 15 минутын дараа дахин оролдоно уу." },
    standardHeaders: true,
    legacyHeaders: false,
});
const corsOptions = {
    origin: (origin, callback) => {
        callback(null, origin ?? 'http://localhost:3000');
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' })); // Body parser limit to prevent large payload attacks
app.use((0, morgan_1.default)('dev'));
// API Routes
app.use('/api/auth', authLimiter, auth_routes_1.default); // Auth замууд дээр чанга limit тавьсан
app.use('/api/ai', globalLimiter, ai_routes_1.default);
app.use('/api/jobs', globalLimiter, job_routes_1.default);
app.use('/api/chat', globalLimiter, chat_routes_1.default);
app.use('/api', globalLimiter, notifications_1.default);
const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Auth Service running on http://localhost:${PORT}`);
});

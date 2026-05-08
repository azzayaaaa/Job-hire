import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan'; 
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import hpp from 'hpp';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import jobRoutes from './routes/job.routes';
import chatRoutes from './routes/chat.routes';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
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
app.use(helmet());

// 2. HTTP Parameter Pollution protection
app.use(hpp());

// 3. Global Rate Limiter - Нийт хүсэлтийн хязгаар
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Нэмэгдүүлсэн
  message: { error: "Хэт их хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Auth Rate Limiter - Нэвтрэх, бүртгүүлэхэд зориулсан хязгаар
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Нэмэгдүүлсэн
  message: { error: "Аюулгүй байдлын үүднээс түр хязгаарлалт хийлээ. 15 минутын дараа дахин оролдоно уу." },
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    callback(null, origin ?? 'http://localhost:3000');
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Body parser limit to prevent large payload attacks
app.use(morgan('dev')); 

// API Routes
app.use('/api/auth', authLimiter, authRoutes); // Auth замууд дээр чанга limit тавьсан
app.use('/api/ai', globalLimiter, aiRoutes);
app.use('/api/jobs', globalLimiter, jobRoutes);
app.use('/api/chat', globalLimiter, chatRoutes);

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Auth Service running on http://localhost:${PORT}`);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();
const app = express();
const PORT = 5000;

app.use(helmet());

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.10.76:3000',
]);

const isAllowedLocalOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    const isDevFrontend = url.protocol === 'http:' && url.port === '3000';
    const isPrivateLan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);

    return isDevFrontend && isPrivateLan;
  } catch {
    return false;
  }
};

// ✅ CORS тохиргоо
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedLocalOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));

const services = [
  { path: '/api/auth', target: 'http://127.0.0.1:5001' },
  { path: '/api/jobs', target: 'http://127.0.0.1:5003' },
  { path: '/api/ai', target: 'http://127.0.0.1:5004' },
  { path: '/api/users', target: 'http://127.0.0.1:5005' },
  { path: '/api/notify', target: 'http://127.0.0.1:5006' },
  { path: '/api/chat', target: 'http://127.0.0.1:5007' },
];

services.forEach(service => {
  app.use(service.path, createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    pathRewrite: { [`^${service.path}`]: service.path },
    onProxyRes: (proxyRes) => {
      delete proxyRes.headers['access-control-allow-origin'];
      delete proxyRes.headers['access-control-allow-credentials'];
      delete proxyRes.headers['access-control-allow-methods'];
      delete proxyRes.headers['access-control-allow-headers'];
    },
  }));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Gateway running on http://0.0.0.0:${PORT}`);
});

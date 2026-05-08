import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import hpp from 'hpp';
import nodemailer from 'nodemailer';
import Queue from 'bull';

dotenv.config();
const app = express();

// Redis Queue Setup (Message Broker)
const notificationQueue = new Queue('job-notifications', {
  redis: { port: 6379, host: '127.0.0.1' }
});

// Security
app.use(helmet());
app.use(hpp());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Worker Logic: Queue-ээс даалгавар авч гүйцэтгэх
notificationQueue.process(async (job) => {
  const { to, subject, html } = job.data;
  console.log(`[Notify Worker] Processing notification to: ${to}`);
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`[Notify Worker] Email sent successfully to: ${to}`);
  } catch (error: any) {
    console.error(`[Notify Worker] Failed to send email: ${error.message}`);
    throw error;
  }
});

app.post('/api/notify/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`[Notify Service] 200 OK - Email sent to: ${to}`);
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("[Notify Service] Email Error:", error.message);
    res.status(500).json({ error: "Failed to send email" });
  }
});

const port = process.env.PORT || 5006;
app.listen(port, () => {
  console.log(`Notify Service running on http://localhost:${port}`);
});

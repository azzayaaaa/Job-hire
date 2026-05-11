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

const emailStrictMode = process.env.EMAIL_STRICT === 'true';

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getEmailSetupMessage(error?: any) {
  const reason = error?.message ? ` ${error.message}` : '';
  return `Email not sent.${reason} For Gmail, EMAIL_PASS must be a Gmail App Password, not the normal account password.`;
}

// Worker Logic: Queue-ээс даалгавар авч гүйцэтгэх
notificationQueue.process(async (job) => {
  const { to, subject, html } = job.data;
  console.log(`[Notify Worker] Processing notification to: ${to}`);
  
  try {
    if (!isEmailConfigured()) {
      console.warn('[Notify Worker] Email skipped: EMAIL_USER or EMAIL_PASS is missing.');
      return;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`[Notify Worker] Email sent successfully to: ${to}`);
  } catch (error: any) {
    console.warn(`[Notify Worker] ${getEmailSetupMessage(error)}`);
    if (emailStrictMode) throw error;
  }
});

app.post('/api/notify/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  
  try {
    if (!isEmailConfigured()) {
      console.warn('[Notify Service] Email skipped: EMAIL_USER or EMAIL_PASS is missing.');
      return res.status(202).json({ success: false, skipped: true, message: 'Email is not configured' });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`[Notify Service] 200 OK - Email sent to: ${to}`);
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.warn(`[Notify Service] ${getEmailSetupMessage(error)}`);
    const status = emailStrictMode ? 500 : 202;
    res.status(status).json({
      success: false,
      skipped: !emailStrictMode,
      error: emailStrictMode ? 'Failed to send email' : 'Email credentials are not accepted',
    });
  }
});

const port = process.env.PORT || 5006;
app.listen(port, () => {
  console.log(`Notify Service running on http://localhost:${port}`);
});

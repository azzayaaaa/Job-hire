import { Router } from 'express';
import { sendMessage } from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/send', authMiddleware, sendMessage);

export default router;

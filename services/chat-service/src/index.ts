import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
});

const prisma = new PrismaClient();

app.use(helmet());

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room: user-${userId}`);
  });

  socket.on('message-seen', (data) => {
    if (data?.messageId && data?.senderId) {
      io.to(`user-${data.senderId}`).emit('message-seen', {
        messageId: Number(data.messageId)
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 1. Чатласан хүмүүсийн жагсаалт авах (Messenger style sidebar)
app.get('/api/chat/conversations/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: Number(userId) }, { receiverId: Number(userId) }]
      },
      orderBy: { createdAt: 'desc' }
    });

    const latestMessageByContactId = new Map<number, any>();
    messages.forEach(m => {
      const contactId = m.senderId !== Number(userId) ? m.senderId : m.receiverId;
      if (!latestMessageByContactId.has(contactId)) {
        latestMessageByContactId.set(contactId, m);
      }
    });

    const contactIds = Array.from(latestMessageByContactId.keys());

    const contacts = await prisma.user.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, email: true, fullName: true, phone: true, userType: true }
    });

    const contactById = new Map(contacts.map(contact => [contact.id, contact]));
    const conversations = contactIds
      .map((contactId) => {
        const contact = contactById.get(contactId);
        const lastMessage = latestMessageByContactId.get(contactId);

        if (!contact) return null;

        return {
          id: contactId,
          participantId: contact.id,
          participantEmail: contact.email,
          participantName: contact.fullName,
          email: contact.email,
          fullName: contact.fullName,
          phone: contact.phone,
          userType: contact.userType,
          lastMessage: lastMessage?.message || '',
          lastMessageAt: lastMessage?.createdAt,
        };
      })
      .filter(Boolean);

    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Тухайн хүнтэй чаталсан түүх авах
app.get('/api/chat/history/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: Number(user1), receiverId: Number(user2) },
          { senderId: Number(user2), receiverId: Number(user1) }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Мессеж илгээх
app.post('/api/chat/send', async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  try {
    const newMessage = await prisma.chatMessage.create({
      data: {
        senderId: Number(senderId),
        receiverId: Number(receiverId),
        message: message
      }
    });

    io.to(`user-${senderId}`).to(`user-${receiverId}`).emit('new-message', newMessage);
    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ error: "Мессеж хадгалахад алдаа гарлаа" });
  }
});

// 4. Чат бүхэлд нь устгах
app.post('/api/chat/messages/:messageId/seen', async (req, res) => {
  const { messageId } = req.params;
  const parsedMessageId = Number(messageId);

  if (isNaN(parsedMessageId)) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  try {
    const message = await prisma.chatMessage.update({
      where: { id: parsedMessageId },
      data: { isRead: true }
    });

    io.to(`user-${message.senderId}`).to(`user-${message.receiverId}`).emit('message-seen', {
      messageId: message.id
    });

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chat/clear/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: Number(user1), receiverId: Number(user2) },
          { senderId: Number(user2), receiverId: Number(user1) }
        ]
      }
    });

    // Notify both users that chat was cleared
    io.to(`user-${user1}`).to(`user-${user2}`).emit('chat-cleared', { 
      user1: Number(user1), 
      user2: Number(user2) 
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const port = 5007;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Chat Service (with Socket.io) running on port ${port}`);
});

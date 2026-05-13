import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { PrismaClient } from './lib/prismaClient';
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
const onlineSocketsByUserId = new Map<number, Set<string>>();
const lastActiveAtByUserId = new Map<number, string>();
const messageReactionsById = new Map<number, { reaction: string; reactionById: number }>();
const CHAT_META_PREFIX = '__JOBHUB_CHAT_META__:';
const CHAT_ATTACHMENT_PREFIX = '__JOBHUB_CHAT_ATTACHMENT__:';

async function ensureChatMessageCapacity() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE ChatMessage MODIFY message LONGTEXT NOT NULL');
  } catch (error) {
    console.warn('Could not ensure ChatMessage.message LONGTEXT:', error);
  }
}

function decodeAttachmentPayload(text: string) {
  if (!text?.startsWith(CHAT_ATTACHMENT_PREFIX)) {
    return {
      text,
      imageDataUrl: null,
      videoDataUrl: null,
      fileDataUrl: null,
      fileName: null,
      fileSizeBytes: null,
      fileMimeType: null,
    };
  }

  try {
    const parsed = JSON.parse(text.slice(CHAT_ATTACHMENT_PREFIX.length));
    return {
      text: String(parsed?.text || ''),
      imageDataUrl: parsed?.imageDataUrl ? String(parsed.imageDataUrl) : null,
      videoDataUrl: parsed?.videoDataUrl ? String(parsed.videoDataUrl) : null,
      fileDataUrl: parsed?.fileDataUrl ? String(parsed.fileDataUrl) : null,
      fileName: parsed?.fileName ? String(parsed.fileName) : null,
      fileSizeBytes: Number.isFinite(Number(parsed?.fileSizeBytes)) ? Number(parsed.fileSizeBytes) : null,
      fileMimeType: parsed?.fileMimeType ? String(parsed.fileMimeType) : null,
    };
  } catch {
    return {
      text,
      imageDataUrl: null,
      videoDataUrl: null,
      fileDataUrl: null,
      fileName: null,
      fileSizeBytes: null,
      fileMimeType: null,
    };
  }
}

function getConversationPreview(decoded: any) {
  if (decoded?.text) return decoded.text;
  if (decoded?.imageDataUrl) return 'Зураг';
  if (decoded?.videoDataUrl) return 'Бичлэг';
  if (decoded?.fileName) return decoded.fileName;
  return '';
}

function encodeMessage(
  message: string,
  replyToId?: unknown,
  replyPreview?: unknown,
  reaction?: unknown,
  reactionById?: unknown,
) {
  if (!replyToId && !replyPreview && !reaction) return message;

  return `${CHAT_META_PREFIX}${JSON.stringify({
    text: message,
    replyToId: replyToId ? Number(replyToId) : null,
    replyPreview: replyPreview ? String(replyPreview).slice(0, 160) : null,
    reaction: reaction ? String(reaction).slice(0, 16) : null,
    reactionById: reactionById ? Number(reactionById) : null,
  })}`;
}

function decodeMessage(message: string) {
  if (!message?.startsWith(CHAT_META_PREFIX)) {
    return { ...decodeAttachmentPayload(message || ''), replyToId: null, replyPreview: null, reaction: null, reactionById: null };
  }

  try {
    const parsed = JSON.parse(message.slice(CHAT_META_PREFIX.length));
    const attachment = decodeAttachmentPayload(String(parsed?.text || ''));
    return {
      ...attachment,
      replyToId: parsed?.replyToId ? Number(parsed.replyToId) : null,
      replyPreview: parsed?.replyPreview ? String(parsed.replyPreview) : null,
      reaction: parsed?.reaction ? String(parsed.reaction) : null,
      reactionById: parsed?.reactionById ? Number(parsed.reactionById) : null,
    };
  } catch {
    return { text: message, replyToId: null, replyPreview: null, reaction: null, reactionById: null };
  }
}

function formatMessageForClient(message: any) {
  const decoded = decodeMessage(message?.message || '');
  const reaction = messageReactionsById.get(Number(message.id));

  return {
    ...message,
    message: decoded.text,
    imageDataUrl: decoded.imageDataUrl,
    videoDataUrl: decoded.videoDataUrl,
    fileDataUrl: decoded.fileDataUrl,
    fileName: decoded.fileName,
    fileSizeBytes: decoded.fileSizeBytes,
    fileMimeType: decoded.fileMimeType,
    replyToId: decoded.replyToId,
    replyPreview: decoded.replyPreview,
    reaction: reaction?.reaction || decoded.reaction || null,
    reactionById: reaction?.reactionById || decoded.reactionById || null,
  };
}

function getPresence(userId: number) {
  return {
    userId,
    isOnline: Boolean(onlineSocketsByUserId.get(userId)?.size),
    lastActiveAt: lastActiveAtByUserId.get(userId) || null,
  };
}

function emitPresence(userId: number) {
  io.emit('user-presence', getPresence(userId));
}

app.use(helmet());

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (userId) => {
    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId)) return;

    socket.data.userId = parsedUserId;
    socket.join(`user-${parsedUserId}`);
    const sockets = onlineSocketsByUserId.get(parsedUserId) || new Set<string>();
    sockets.add(socket.id);
    onlineSocketsByUserId.set(parsedUserId, sockets);
    lastActiveAtByUserId.set(parsedUserId, new Date().toISOString());
    emitPresence(parsedUserId);
    console.log(`User ${parsedUserId} joined room: user-${parsedUserId}`);
  });

  socket.on('presence-check', (userId) => {
    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId)) return;
    socket.emit('user-presence', getPresence(parsedUserId));
  });

  socket.on('message-seen', (data) => {
    if (data?.messageId && data?.senderId) {
      io.to(`user-${data.senderId}`).emit('message-seen', {
        messageId: Number(data.messageId)
      });
    }
  });

  socket.on('disconnect', () => {
    const userId = Number(socket.data.userId);
    if (Number.isFinite(userId)) {
      const sockets = onlineSocketsByUserId.get(userId);
      sockets?.delete(socket.id);
      if (!sockets || sockets.size === 0) {
        onlineSocketsByUserId.delete(userId);
        lastActiveAtByUserId.set(userId, new Date().toISOString());
      }
      emitPresence(userId);
    }
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
    const unreadCountByContactId = new Map<number, number>();
    messages.forEach(m => {
      const contactId = m.senderId !== Number(userId) ? m.senderId : m.receiverId;
      if (!latestMessageByContactId.has(contactId)) {
        latestMessageByContactId.set(contactId, m);
      }
      if (m.receiverId === Number(userId) && !m.isRead) {
        unreadCountByContactId.set(contactId, (unreadCountByContactId.get(contactId) || 0) + 1);
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
          lastMessage: getConversationPreview(decodeMessage(lastMessage?.message || '')),
          lastMessageAt: lastMessage?.createdAt,
          unreadCount: unreadCountByContactId.get(contactId) || 0,
          isOnline: getPresence(contact.id).isOnline,
          lastActiveAt: getPresence(contact.id).lastActiveAt,
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
    res.json(messages.map(formatMessageForClient));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Мессеж илгээх
app.post('/api/chat/send', async (req, res) => {
  const { senderId, receiverId, message, replyToId, replyPreview } = req.body;
  try {
    const newMessage = await prisma.chatMessage.create({
      data: {
        senderId: Number(senderId),
        receiverId: Number(receiverId),
        message: encodeMessage(message, replyToId, replyPreview)
      }
    });

    const enrichedMessage = formatMessageForClient(newMessage);

    lastActiveAtByUserId.set(Number(senderId), new Date().toISOString());
    emitPresence(Number(senderId));
    io.to(`user-${senderId}`).to(`user-${receiverId}`).emit('new-message', enrichedMessage);
    res.status(201).json(enrichedMessage);
  } catch (error: any) {
    res.status(500).json({ error: "Мессеж хадгалахад алдаа гарлаа" });
  }
});

// 4. Чат бүхэлд нь устгах
app.post('/api/chat/messages/:messageId/reaction', async (req, res) => {
  const { messageId } = req.params;
  const { reaction, userId, receiverId } = req.body;
  const parsedMessageId = Number(messageId);
  const parsedUserId = Number(userId);

  if (!Number.isFinite(parsedMessageId) || !Number.isFinite(parsedUserId)) {
    return res.status(400).json({ error: 'Invalid message or user ID' });
  }

  const payload = {
    messageId: parsedMessageId,
    reaction: reaction ? String(reaction).slice(0, 16) : null,
    reactionById: parsedUserId,
  };

  if (payload.reaction) {
    messageReactionsById.set(parsedMessageId, {
      reaction: payload.reaction,
      reactionById: parsedUserId,
    });
  } else {
    messageReactionsById.delete(parsedMessageId);
  }

  try {
    const existingMessage = await prisma.chatMessage.findUnique({
      where: { id: parsedMessageId },
      select: { message: true },
    });

    if (existingMessage) {
      const decoded = decodeMessage(existingMessage.message);
      await prisma.chatMessage.update({
        where: { id: parsedMessageId },
        data: {
          message: encodeMessage(
            decoded.text,
            decoded.replyToId,
            decoded.replyPreview,
            payload.reaction,
            payload.reactionById,
          ),
        },
      });
    }
  } catch (error) {
    console.error('Failed to persist reaction:', error);
  }

  [parsedUserId, Number(receiverId)]
    .filter(Number.isFinite)
    .forEach((id) => io.to(`user-${id}`).emit('message-reaction', payload));

  res.json({ success: true, ...payload });
});

app.post('/api/chat/messages/:messageId/seen', async (req, res) => {
  const { messageId } = req.params;
  const parsedMessageId = Number(messageId);

  if (isNaN(parsedMessageId)) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  try {
    const existing = await prisma.chatMessage.findUnique({
      where: { id: parsedMessageId },
    });

    if (!existing) {
      return res.status(200).json({ success: true, skipped: true, reason: 'Message not found' });
    }

    const message = await prisma.chatMessage.update({
      where: { id: existing.id },
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
ensureChatMessageCapacity().finally(() => {
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Chat Service (with Socket.io) running on port ${port}`);
  });
});

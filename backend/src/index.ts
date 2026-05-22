import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import path from 'path';
import fs from 'fs';

import { connectDB, getDbStats } from './config/database';
import { setupWebSocket } from './services/websocket';
import uploadRouter from './api/uploadResume';
import chatRouter from './api/chat';
import sessionRouter from './api/session';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Ensure uploads dir exists ──
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Middleware ──
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req, res) => {
  const db = getDbStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: db.status,
    dbHost: db.host,
    dbName: db.dbName,
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// ── API Routes ──
app.use('/api/upload-resume', uploadRouter);
app.use('/api/chat', chatRouter);
app.use('/api/session', sessionRouter);

// ── 404 handler ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ──
async function start() {
  await connectDB();

  const server = http.createServer(app);
  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`\n🚀 Resume Assistant Backend`);
    console.log(`   HTTP  → http://localhost:${PORT}`);
    console.log(`   WS    → ws://localhost:${PORT}/ws`);
    console.log(`   Health→ http://localhost:${PORT}/health\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

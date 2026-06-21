import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import connectDB from './config/db';
import competitionRoutes from './routes/competitionRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const requiredEnvironment = ['MONGO_URI', 'JWT_SECRET'];
const missing = requiredEnvironment.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`缺少必要環境變數：${missing.join(', ')}`);
}

connectDB();
const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200')
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) =>
    !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)
      ? callback(null, true)
      : callback(new Error('不允許的網站來源')),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/users', userRoutes);
app.use('/api/competitions', competitionRoutes);

const clientPath = path.resolve(__dirname, '../../client/dist/client/browser');
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath, { maxAge: '1d', index: false }));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const status = error?.name === 'MulterError' ? 400 : 500;
  res.status(status).json({
    message: status === 400 ? error.message : '伺服器發生未預期錯誤'
  });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Track system is running on port ${PORT}`);
});

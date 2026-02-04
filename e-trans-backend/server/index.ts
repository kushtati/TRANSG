// server/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { env, isProduction } from './config/env.js';
import { prisma } from './config/prisma.js';
import { log } from './config/logger.js';

// Routes
import authRoutes from './routes/auth.js';
import shipmentRoutes from './routes/shipments.js';
import financeRoutes from './routes/finance.js';
import aiRoutes from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy (Railway, Vercel)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Security
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
}));

// CORS
const allowedOrigins = isProduction
  ? [env.FRONTEND_URL, /\.vercel\.app$/, /\.railway\.app$/]
  : [/localhost/, /127\.0\.0\.1/];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => 
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    
    callback(null, isAllowed);
  },
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: { success: false, message: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 100,
  message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.http(`${req.method} ${req.path}`, { status: res.statusCode, duration: `${duration}ms` });
  });
  next();
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      success: true, 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  } catch (error) {
    res.status(503).json({ 
      success: false, 
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/ai', aiRoutes);

// Serve static files in production
if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log.error('Unhandled error', err);
  res.status(500).json({ 
    success: false, 
    message: isProduction ? 'Erreur interne du serveur' : err.message,
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  log.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  log.info(`🚀 Server running on port ${PORT}`);
  log.info(`📍 Environment: ${env.NODE_ENV}`);
});

export default app;

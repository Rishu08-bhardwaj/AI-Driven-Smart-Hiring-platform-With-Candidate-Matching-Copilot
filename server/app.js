import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_ROOT } from './services/storage.service.js';
import apiRoutes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../client/dist');

const app = express();

// Behind a reverse proxy in production (correct client IPs for rate-limit/audit).
app.set('trust proxy', 1);

// ── Security & parsing ─────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// ── Rate limiting (all API routes) ─────────────────────────
app.use('/api', apiLimiter);

// ── Static: uploaded files ─────────────────────────────────
app.use('/uploads', express.static(UPLOAD_ROOT));

// ── API ────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Serve the built SPA (single-port deployment) ───────────
// When client/dist exists, serve it and fall back to index.html for
// client-side routes so the whole app runs from this one server/port.
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ── 404 + error handling ───────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;

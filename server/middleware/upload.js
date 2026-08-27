import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { UPLOAD_ROOT } from '../services/storage.service.js';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // group by logical entity provided on the route (defaults to "misc")
    const sub = req.uploadSubdir || 'misc';
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest(`File type not allowed: ${file.mimetype}`));
  }
  cb(null, true);
}

/** Factory: configure an upload middleware with a logical subdirectory. */
export function uploader(subdir) {
  const mw = multer({
    storage,
    fileFilter,
    limits: { fileSize: env.uploads.maxSizeMb * 1024 * 1024 },
  });
  return {
    single: (field) => [setSubdir(subdir), mw.single(field)],
    array: (field, max = 10) => [setSubdir(subdir), mw.array(field, max)],
  };
}

function setSubdir(subdir) {
  return (req, res, next) => {
    req.uploadSubdir = typeof subdir === 'function' ? subdir(req) : subdir;
    next();
  };
}

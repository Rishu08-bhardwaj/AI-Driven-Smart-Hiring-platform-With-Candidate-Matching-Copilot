import dotenv from 'dotenv';
dotenv.config();

/** Read an env var, falling back to a default; throws if required and missing. */
function read(key, { required = false, fallback = undefined } = {}) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (required) throw new Error(`Missing required environment variable: ${key}`);
    return fallback;
  }
  return value;
}

const isProd = read('NODE_ENV', { fallback: 'development' }) === 'production';

export const env = {
  isProd,
  nodeEnv: read('NODE_ENV', { fallback: 'development' }),
  port: Number(read('PORT', { fallback: '5000' })),
  clientUrl: read('CLIENT_URL', { fallback: 'http://localhost:5173' }),

  db: {
    host: read('DB_HOST', { fallback: '127.0.0.1' }),
    port: Number(read('DB_PORT', { fallback: '3306' })),
    user: read('DB_USER', { required: isProd, fallback: 'hrms_user' }),
    password: read('DB_PASSWORD', { required: isProd, fallback: 'hrms_pass' }),
    name: read('DB_NAME', { fallback: 'hrms_db' }),
    connectionLimit: Number(read('DB_CONNECTION_LIMIT', { fallback: '10' })),
  },

  jwt: {
    accessSecret: read('JWT_ACCESS_SECRET', { required: isProd, fallback: 'dev_access_secret' }),
    refreshSecret: read('JWT_REFRESH_SECRET', { required: isProd, fallback: 'dev_refresh_secret' }),
    accessExpires: read('JWT_ACCESS_EXPIRES', { fallback: '15m' }),
    refreshExpires: read('JWT_REFRESH_EXPIRES', { fallback: '7d' }),
  },

  uploads: {
    dir: read('UPLOAD_DIR', { fallback: 'uploads' }),
    maxSizeMb: Number(read('MAX_UPLOAD_SIZE_MB', { fallback: '5' })),
    driver: read('STORAGE_DRIVER', { fallback: 'local' }),
    cloudinary: {
      cloudName: read('CLOUDINARY_CLOUD_NAME', { fallback: '' }),
      apiKey: read('CLOUDINARY_API_KEY', { fallback: '' }),
      apiSecret: read('CLOUDINARY_API_SECRET', { fallback: '' }),
    },
  },

  mail: {
    host: read('MAIL_HOST', { fallback: '' }),
    port: Number(read('MAIL_PORT', { fallback: '587' })),
    user: read('MAIL_USER', { fallback: '' }),
    password: read('MAIL_PASSWORD', { fallback: '' }),
    from: read('MAIL_FROM', { fallback: 'HRMS <no-reply@hrms.local>' }),
  },

  rateLimit: {
    windowMin: Number(read('RATE_LIMIT_WINDOW_MIN', { fallback: '15' })),
    max: Number(read('RATE_LIMIT_MAX', { fallback: '300' })),
    authMax: Number(read('AUTH_RATE_LIMIT_MAX', { fallback: '20' })),
  },
};

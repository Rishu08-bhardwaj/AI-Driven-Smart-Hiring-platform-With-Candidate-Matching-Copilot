import app from './app.js';
import { env } from './config/env.js';
import { assertDbConnection, pool } from './config/db.js';
import { ensureUploadDir } from './services/storage.service.js';

async function start() {
  try {
    await assertDbConnection();
    // eslint-disable-next-line no-console
    console.log('✓ Database connected');

    await ensureUploadDir();

    const server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`✓ HRMS API running on http://localhost:${env.port} (${env.nodeEnv})`);
    });

    const shutdown = async (signal) => {
      // eslint-disable-next-line no-console
      console.log(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

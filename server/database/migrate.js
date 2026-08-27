/**
 * Apply the schema to the configured database.
 * Usage: npm run db:init
 * (Assumes the database + user already exist; see README for provisioning.)
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    // eslint-disable-next-line no-console
    console.log('✓ Schema applied successfully.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('✗ Migration failed:', err.message);
  process.exit(1);
});

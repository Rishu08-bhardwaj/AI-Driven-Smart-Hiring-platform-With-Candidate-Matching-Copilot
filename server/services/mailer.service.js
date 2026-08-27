import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

/**
 * Lazily build a nodemailer transport. If SMTP isn't configured (common in
 * dev), we fall back to logging the email to the console so flows still work
 * end-to-end without a mail server.
 */
function getTransporter() {
  if (transporter) return transporter;
  if (!env.mail.host) return null;
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
  });
  return transporter;
}

/** Send an email; logs to console when SMTP is not configured. */
export async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) {
    // eslint-disable-next-line no-console
    console.info(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { delivered: false, dev: true };
  }
  await tx.sendMail({ from: env.mail.from, to, subject, html, text });
  return { delivered: true };
}

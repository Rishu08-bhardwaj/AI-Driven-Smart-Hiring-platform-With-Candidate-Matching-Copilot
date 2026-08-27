import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

/**
 * Storage abstraction so the upload destination can switch between local disk
 * and Cloudinary via the STORAGE_DRIVER env var — without touching callers.
 *
 * Currently the `local` driver is active. To enable Cloudinary, set
 * STORAGE_DRIVER=cloudinary and the credentials in .env; the cloudinary branch
 * uploads the buffered file and returns its secure URL.
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploads.dir);

/** Public URL path for a stored local file. */
function localPublicUrl(relativePath) {
  return `/uploads/${relativePath.split(path.sep).join('/')}`;
}

/**
 * Persist an uploaded file (already written to disk by multer) and return its
 * canonical URL. For local storage this is a no-op transform; for cloudinary it
 * would upload and unlink the temp file.
 * @param {Express.Multer.File} file
 * @param {string} subdir  logical folder (e.g. "employees/123")
 */
export async function persistFile(file, subdir = '') {
  if (env.uploads.driver === 'cloudinary') {
    // Lazy import to avoid loading the SDK when unused.
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: env.uploads.cloudinary.cloudName,
      api_key: env.uploads.cloudinary.apiKey,
      api_secret: env.uploads.cloudinary.apiSecret,
    });
    const res = await cloudinary.uploader.upload(file.path, {
      folder: `hrms/${subdir}`.replace(/\/+$/, ''),
      resource_type: 'auto',
    });
    await fs.unlink(file.path).catch(() => {});
    return { url: res.secure_url, provider: 'cloudinary', publicId: res.public_id };
  }

  // local: file is already at file.path under UPLOAD_ROOT
  const relative = path.relative(UPLOAD_ROOT, file.path);
  return { url: localPublicUrl(relative), provider: 'local', publicId: relative };
}

/** Remove a previously stored file (best-effort). */
export async function removeFile(publicId, provider = env.uploads.driver) {
  try {
    if (provider === 'cloudinary') {
      const { v2: cloudinary } = await import('cloudinary');
      cloudinary.config({
        cloud_name: env.uploads.cloudinary.cloudName,
        api_key: env.uploads.cloudinary.apiKey,
        api_secret: env.uploads.cloudinary.apiSecret,
      });
      await cloudinary.uploader.destroy(publicId);
    } else {
      await fs.unlink(path.join(UPLOAD_ROOT, publicId));
    }
  } catch {
    // best-effort: a missing file is not fatal
  }
}

/** Ensure the upload root exists at boot. */
export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

export { UPLOAD_ROOT };

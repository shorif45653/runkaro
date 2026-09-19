/** Multer file-upload configuration for Runkaro.
 *
 *  Local mode → files land in ./uploads (disk storage), as before.
 *  Cloud mode → files land in memory, then storeUploaded() pushes them to
 *               Cloudinary under the exact same generated names, so every
 *               URL keeps its /uploads/<name> shape and the frontend
 *               needs no changes at all.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cloud = require('./cloud');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 150 * 1024 * 1024; // 150 MB per file

/** Images + videos only (tutorial videos & thumbnails). */
const mediaFileFilter = (req, file, cb) => {
  const isImage = /^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(file.mimetype);
  const isVideo = /^video\/(mp4|webm|ogg|quicktime|x-matroska)$/.test(file.mimetype);
  if (isImage || isVideo) return cb(null, true);
  cb(new Error('Unsupported file type — images (jpg, png, webp, gif) and videos (mp4, webm, ogg) only.'));
};

/** Generates the stored name used by BOTH modes, so URLs never change. */
function makeFilename(originalname, { readable = false } = {}) {
  const ext = (path.extname(originalname || '') || '').toLowerCase();
  const stamp = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  if (!readable) return `${stamp}${ext}`;
  const safe = (path.basename(originalname || 'file') || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  return `${stamp}-${safe}`;
}

/**
 * Builds a matched pair of multer instances — disk (local mode) + memory
 * (cloud mode) — with a custom naming rule and optional file filter.
 */
function makeUploaders({ fileFilter = null, limits = { fileSize: MAX_BYTES }, nameStyle = null } = {}) {
  const style = nameStyle || ((file) => makeFilename(file.originalname));
  const common = { limits, ...(fileFilter ? { fileFilter } : {}) };
  const disk = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, style(file)),
    }),
    ...common,
  });
  const memory = multer({ storage: multer.memoryStorage(), ...common });
  return {
    disk,
    memory,
    /** Middleware that picks the right storage at request time. */
    dynamic(build) {
      return (req, res, next) => build(cloud.status().files ? memory : disk)(req, res, next);
    },
  };
}

/* Default pair for tutorial uploads (video + thumbnail). */
const uploads = makeUploaders({ fileFilter: mediaFileFilter });

/**
 * Persists one uploaded file. Disk mode already wrote it (filename is set);
 * cloud mode uploads the buffer to Cloudinary under the same name scheme.
 */
async function storeUploaded(file, { readable = false } = {}) {
  if (cloud.status().files) {
    const name = makeFilename(file.originalname, { readable });
    await cloud.uploadFile(file.buffer, name);
    return name;
  }
  return file.filename;
}

/** Collects every uploaded file regardless of the multer mode used. */
function allFiles(req) {
  if (!req.files) return [];
  return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
}

/**
 * Guard used right before storing files in cloud mode: enforces the
 * Cloudinary free-plan caps (images 10 MB, video/audio 100 MB, other 10 MB).
 * Sends a 413 response and returns false when a file is too large.
 */
function withinCloudLimits(req, res) {
  if (!cloud.status().files) return true;
  for (const f of allFiles(req)) {
    const max = cloud.maxSizeFor(f.originalname);
    if (f.size > max) {
      const ext = path.extname(f.originalname || '').toLowerCase() || 'this type of';
      res.status(413).json({
        message: `"${f.originalname}" is too large — the Cloudinary free plan allows ${Math.round(max / (1024 * 1024))} MB for ${ext} files. Use a smaller file, a YouTube link for videos, or upgrade the plan.`,
      });
      return false;
    }
  }
  return true;
}

module.exports = {
  UPLOAD_DIR,
  MAX_BYTES,
  makeFilename,
  makeUploaders,
  uploads,
  storeUploaded,
  withinCloudLimits,
};



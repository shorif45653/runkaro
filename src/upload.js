/** Multer file-upload configuration for Runkaro (images + videos). */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isImage = /^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(file.mimetype);
  const isVideo = /^video\/(mp4|webm|ogg|quicktime|x-matroska)$/.test(file.mimetype);
  if (isImage || isVideo) return cb(null, true);
  cb(new Error('Unsupported file type — images (jpg, png, webp, gif) and videos (mp4, webm, ogg) only.'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
});

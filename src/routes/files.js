/** Admin file manager: upload, browse and delete files (local /uploads or Cloudinary). */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const cloud = require('../cloud');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { makeUploaders, makeFilename, storeUploaded, withinCloudLimits, UPLOAD_DIR } = require('../upload');

// Storage that preserves readable (sanitized) original file names.
const up = makeUploaders({ nameStyle: (file) => makeFilename(file.originalname, { readable: true }) });

/** Async route wrapper. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate, requireAdmin);

function fileKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.ogg', '.mov', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a'].includes(ext)) return 'audio';
  if (ext === '.pdf') return 'pdf';
  if (['.zip', '.rar', '.7z'].includes(ext)) return 'archive';
  if (['.doc', '.docx'].includes(ext)) return 'doc';
  if (['.ppt', '.pptx'].includes(ext)) return 'slides';
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return 'sheet';
  return 'other';
}

function fmtSize(bytes) {
  if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

// List all uploaded files (newest first) — from Cloudinary in cloud mode, from disk otherwise.
router.get('/', wrap(async (req, res) => {
  let raw;
  if (cloud.status().files) {
    raw = await cloud.listFiles(); // [{ name, size, modified }]
  } else {
    const entries = await fs.promises.readdir(UPLOAD_DIR, { withFileTypes: true });
    raw = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const st = await fs.promises.stat(path.join(UPLOAD_DIR, e.name));
      raw.push({ name: e.name, size: st.size, modified: st.mtime.toISOString() });
    }
  }
  const files = raw.map((f) => ({
    name: f.name,
    url: '/uploads/' + f.name,
    size: f.size,
    sizeLabel: fmtSize(f.size),
    kind: fileKind(f.name),
    modified: f.modified,
  }));
  files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  res.json({ files });
}));

// Upload up to 10 files per request.
router.post('/', up.dynamic((u) => u.array('files', 10)), wrap(async (req, res) => {
  if (!withinCloudLimits(req, res)) return;
  const files = [];
  for (const f of req.files || []) {
    const name = await storeUploaded(f, { readable: true });
    files.push({
      name,
      url: '/uploads/' + name,
      size: f.size,
      kind: fileKind(name),
    });
  }
  res.status(201).json({ message: `Uploaded ${files.length} file(s)`, files });
}));

// Delete one uploaded file.
router.delete('/:name', wrap(async (req, res) => {
  const name = path.basename(req.params.name);
  if (!name || name.startsWith('.')) {
    return res.status(400).json({ message: 'Invalid file name' });
  }
  try {
    if (cloud.status().files) {
      await cloud.deleteFile(name);
      return res.json({ ok: true });
    }
    const full = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(full)) return res.status(404).json({ message: 'File not found' });
    await fs.promises.unlink(full);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not delete file' });
  }
}));

module.exports = router;

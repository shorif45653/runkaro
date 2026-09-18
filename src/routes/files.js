/** Admin file manager: upload, browse and delete files in /uploads. */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');
const uploadSvc = require('../upload');

const UPLOAD_DIR = uploadSvc.UPLOAD_DIR;

// Storage that preserves readable (sanitized) original file names.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (path.basename(file.originalname || 'file') || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-80);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB per file
});

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

// List all uploaded files (newest first).
router.get('/', async (req, res) => {
  try {
    const entries = await fs.promises.readdir(UPLOAD_DIR, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const st = await fs.promises.stat(path.join(UPLOAD_DIR, e.name));
      files.push({
        name: e.name,
        url: '/uploads/' + e.name,
        size: st.size,
        sizeLabel: fmtSize(st.size),
        kind: fileKind(e.name),
        modified: st.mtime.toISOString(),
      });
    }
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not list files' });
  }
});

// Upload up to 10 files per request.
router.post('/', upload.array('files', 10), (req, res) => {
  const files = (req.files || []).map((f) => ({
    name: f.filename,
    url: '/uploads/' + f.filename,
    size: f.size,
    kind: fileKind(f.filename),
  }));
  res.status(201).json({ message: `Uploaded ${files.length} file(s)`, files });
});

// Delete one uploaded file.
router.delete('/:name', async (req, res) => {
  const name = path.basename(req.params.name);
  if (!name || name.startsWith('.')) {
    return res.status(400).json({ message: 'Invalid file name' });
  }
  const full = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'File not found' });
  try {
    await fs.promises.unlink(full);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not delete file' });
  }
});

module.exports = router;

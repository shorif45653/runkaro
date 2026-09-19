/** Tutorial routes: public browse, admin manage (YouTube link or uploaded video). */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const dbSvc = require('../db');
const cloud = require('../cloud');
const { uploads, storeUploaded, withinCloudLimits, UPLOAD_DIR } = require('../upload');
const { authenticate, requireAdmin } = require('../middleware/auth');

/** Async route wrapper. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function removeUpload(p) {
  if (!p || typeof p !== 'string' || !p.startsWith('/uploads/')) return;
  const name = p.slice('/uploads/'.length);
  if (cloud.status().files) {
    cloud.deleteFile(name).catch((err) => console.error(`[cloud] Could not delete ${name}: ${err.message}`));
    return;
  }
  fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}

function enrich(t) {
  const db = dbSvc.get();
  const author = db.users.find((u) => u.id === t.createdBy);
  return { ...t, author: author ? author.name : 'Runkaro Team' };
}

// Public: browse + filter
router.get('/', (req, res) => {
  const db = dbSvc.get();
  let list = db.tutorials.map(enrich);
  const { search, category, level } = req.query;
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter(
      (t) => t.title.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s)
    );
  }
  if (category && category !== 'all') list = list.filter((t) => t.category === category);
  if (level && level !== 'all') list = list.filter((t) => t.level === level);
  res.json({ tutorials: list });
});

// Public: single tutorial
router.get('/:id', (req, res) => {
  const db = dbSvc.get();
  const tutorial = db.tutorials.find((t) => t.id === req.params.id);
  if (!tutorial) return res.status(404).json({ message: 'Tutorial not found' });
  res.json({ tutorial: enrich(tutorial) });
});

// Admin: create
router.post('/', authenticate, requireAdmin, uploads.dynamic((u) => u.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
])), wrap(async (req, res) => {
  const db = dbSvc.get();
  const { title, description, category, level, duration, videoUrl } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  const video = req.files && req.files.video && req.files.video[0];
  if (!videoUrl || !String(videoUrl).trim()) {
    if (!video) return res.status(400).json({ message: 'Provide a YouTube link or upload a video file' });
  }
  if (!withinCloudLimits(req, res)) return;
  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0];
  const tutorial = {
    id: dbSvc.nextId('tut'),
    title: String(title).trim(),
    description: description || '',
    category: category || 'General',
    level: level || 'Beginner',
    duration: duration || '',
    videoUrl: videoUrl && String(videoUrl).trim() ? String(videoUrl).trim() : '',
    videoFile: video ? `/uploads/${await storeUploaded(video)}` : '',
    thumbnail: thumb ? `/uploads/${await storeUploaded(thumb)}` : '',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.tutorials.push(tutorial);
  dbSvc.save();
  res.status(201).json({ tutorial: enrich(tutorial) });
}));

// Admin: update
router.put('/:id', authenticate, requireAdmin, uploads.dynamic((u) => u.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
])), wrap(async (req, res) => {
  const db = dbSvc.get();
  const tutorial = db.tutorials.find((t) => t.id === req.params.id);
  if (!tutorial) return res.status(404).json({ message: 'Tutorial not found' });
  const { title, description, category, level, duration, videoUrl } = req.body || {};
  if (title !== undefined && String(title).trim()) tutorial.title = String(title).trim();
  if (description !== undefined) tutorial.description = description;
  if (category !== undefined) tutorial.category = category;
  if (level !== undefined) tutorial.level = level;
  if (duration !== undefined) tutorial.duration = duration;

  if (!withinCloudLimits(req, res)) return;
  const video = req.files && req.files.video && req.files.video[0];
  if (video) {
    removeUpload(tutorial.videoFile);
    tutorial.videoFile = `/uploads/${await storeUploaded(video)}`;
    tutorial.videoUrl = '';
  } else if (videoUrl !== undefined && String(videoUrl).trim()) {
    // Admin switched this tutorial to a YouTube link — drop any uploaded file.
    removeUpload(tutorial.videoFile);
    tutorial.videoUrl = String(videoUrl).trim();
    tutorial.videoFile = '';
  }

  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0];
  if (thumb) {
    removeUpload(tutorial.thumbnail);
    tutorial.thumbnail = `/uploads/${await storeUploaded(thumb)}`;
  }
  dbSvc.save();
  res.json({ tutorial: enrich(tutorial) });
}));

// Admin: delete
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = dbSvc.get();
  const idx = db.tutorials.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Tutorial not found' });
  const [removed] = db.tutorials.splice(idx, 1);
  removeUpload(removed.videoFile);
  removeUpload(removed.thumbnail);
  dbSvc.save();
  res.json({ ok: true });
});

module.exports = router;

/** Course routes: public browse, admin manage, users can enroll. */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const dbSvc = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * Course uploads: thumbnail (image) + content files (lesson materials — any
 * file type, readable names). One multer instance handles both field names;
 * a permissive filter is required because content files can be PDFs, docs…
 */
const courseStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    if (file.fieldname === 'thumbnail') {
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    } else {
      const safe = (path.basename(file.originalname || 'file') || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-80);
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`);
    }
  },
});
const courseUpload = multer({ storage: courseStorage, limits: { fileSize: 150 * 1024 * 1024 } });

/** Accepts 1 thumbnail + up to 20 content files per request. */
function uploadCourseFiles() {
  return courseUpload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'content', maxCount: 20 },
  ]);
}

/** Build the content file list from an uploaded request (fields mode: req.files.content). */
function contentFromReq(req) {
  const list = req.files && Array.isArray(req.files.content) ? req.files.content : [];
  return list.map((f) => ({
    name: f.filename,
    originalName: f.originalname,
    url: '/uploads/' + f.filename,
    size: f.size,
  }));
}

function removeUpload(p) {
  if (p && typeof p === 'string' && p.startsWith('/uploads/')) {
    const full = path.join(__dirname, '..', '..', p);
    fs.promises.unlink(full).catch(() => {});
  }
}

function enrich(course) {
  const db = dbSvc.get();
  const author = db.users.find((u) => u.id === course.createdBy);
  return {
    ...course,
    instructor: author ? author.name : 'Runkaro Team',
    enrolled: db.enrollments.filter((e) => e.courseId === course.id).length,
  };
}

// Public: browse + filter
router.get('/', (req, res) => {
  const db = dbSvc.get();
  let list = db.courses.map(enrich);
  const { search, category, level } = req.query;
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter(
      (c) => c.title.toLowerCase().includes(s) || (c.description || '').toLowerCase().includes(s)
    );
  }
  if (category && category !== 'all') list = list.filter((c) => c.category === category);
  if (level && level !== 'all') list = list.filter((c) => c.level === level);
  res.json({ courses: list });
});

// Authenticated: my enrolled courses (must be declared before '/:id')
router.get('/mine', authenticate, (req, res) => {
  const db = dbSvc.get();
  const ids = new Set(db.enrollments.filter((e) => e.userId === req.user.id).map((e) => e.courseId));
  res.json({ courses: db.courses.filter((c) => ids.has(c.id)).map(enrich) });
});

// Public: single course
router.get('/:id', (req, res) => {
  const db = dbSvc.get();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  res.json({ course: enrich(course) });
});

// Admin: create
router.post('/', authenticate, requireAdmin, uploadCourseFiles(), (req, res) => {
  const db = dbSvc.get();
  const { title, description, category, level, duration, price } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  const course = {
    id: dbSvc.nextId('course'),
    title: String(title).trim(),
    description: description || '',
    category: category || 'General',
    level: level || 'Beginner',
    duration: duration || '',
    price: price === undefined || price === '' ? 0 : Number(price) || 0,
    thumbnail: req.files && req.files.thumbnail && req.files.thumbnail[0]
      ? `/uploads/${req.files.thumbnail[0].filename}`
      : '',
    content: contentFromReq(req),
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.courses.push(course);
  dbSvc.save();
  res.status(201).json({ course: enrich(course) });
});

// Admin: update
router.put('/:id', authenticate, requireAdmin, uploadCourseFiles(), (req, res) => {
  const db = dbSvc.get();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  const { title, description, category, level, duration, price } = req.body || {};
  if (title !== undefined && String(title).trim()) course.title = String(title).trim();
  if (description !== undefined) course.description = description;
  if (category !== undefined) course.category = category;
  if (level !== undefined) course.level = level;
  if (duration !== undefined) course.duration = duration;
  if (price !== undefined) course.price = Number(price) || 0;
  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0];
  if (thumb) {
    removeUpload(course.thumbnail);
    course.thumbnail = `/uploads/${thumb.filename}`;
  }
  const newContent = contentFromReq(req);
  if (newContent.length) {
    course.content = (course.content || []).concat(newContent);
  }
  dbSvc.save();
  res.json({ course: enrich(course) });
});

// Admin: remove a single content file from a course
router.delete('/:id/content/:name', authenticate, requireAdmin, (req, res) => {
  const db = dbSvc.get();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  const name = path.basename(req.params.name);
  const idx = (course.content || []).findIndex((f) => f.name === name);
  if (idx === -1) return res.status(404).json({ message: 'Content file not found on this course' });
  const [removed] = course.content.splice(idx, 1);
  removeUpload(removed.url);
  dbSvc.save();
  res.json({ ok: true, course: enrich(course) });
});

// Admin: delete
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = dbSvc.get();
  const idx = db.courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Course not found' });
  const [removed] = db.courses.splice(idx, 1);
  removeUpload(removed.thumbnail);
  for (const f of removed.content || []) removeUpload(f.url);
  db.enrollments = db.enrollments.filter((e) => e.courseId !== removed.id);
  dbSvc.save();
  res.json({ ok: true });
});

// Authenticated: enroll
router.post('/:id/enroll', authenticate, (req, res) => {
  const db = dbSvc.get();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  const existing = db.enrollments.find((e) => e.userId === req.user.id && e.courseId === course.id);
  if (existing) return res.json({ message: 'You are already enrolled', enrollment: existing });
  const enrollment = {
    id: dbSvc.nextId('enr'),
    userId: req.user.id,
    courseId: course.id,
    createdAt: new Date().toISOString(),
  };
  db.enrollments.push(enrollment);
  dbSvc.save();
  res.status(201).json({ message: 'Enrolled successfully', enrollment });
});

module.exports = router;

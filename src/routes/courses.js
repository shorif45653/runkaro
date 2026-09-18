/** Course routes: public browse, admin manage, users can enroll. */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const dbSvc = require('../db');
const upload = require('../upload');
const { authenticate, requireAdmin } = require('../middleware/auth');

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
router.post('/', authenticate, requireAdmin, upload.single('thumbnail'), (req, res) => {
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
    thumbnail: req.file ? `/uploads/${req.file.filename}` : '',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.courses.push(course);
  dbSvc.save();
  res.status(201).json({ course: enrich(course) });
});

// Admin: update
router.put('/:id', authenticate, requireAdmin, upload.single('thumbnail'), (req, res) => {
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
  if (req.file) {
    removeUpload(course.thumbnail);
    course.thumbnail = `/uploads/${req.file.filename}`;
  }
  dbSvc.save();
  res.json({ course: enrich(course) });
});

// Admin: delete
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = dbSvc.get();
  const idx = db.courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Course not found' });
  const [removed] = db.courses.splice(idx, 1);
  removeUpload(removed.thumbnail);
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

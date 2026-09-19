/** Course routes: public browse, admin manage, users can enroll. */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const dbSvc = require('../db');
const cloud = require('../cloud');
const { makeUploaders, makeFilename, storeUploaded, withinCloudLimits, UPLOAD_DIR } = require('../upload');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * Course uploads: thumbnail (image) + content files (lesson materials — any
 * file type, readable names). One multer pair handles both field names;
 * content files can be PDFs, docs… so no file filter is applied.
 */
const up = makeUploaders({
  nameStyle: (file) =>
    file.fieldname === 'thumbnail'
      ? makeFilename(file.originalname)
      : makeFilename(file.originalname, { readable: true }),
});

/** Accepts 1 thumbnail + up to 20 content files per request. */
function uploadCourseFiles() {
  return up.dynamic((u) => u.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'content', maxCount: 20 },
  ]));
}

/** Async route wrapper. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Build the content file list from an uploaded request (fields mode: req.files.content). */
async function contentFromReq(req) {
  const list = req.files && Array.isArray(req.files.content) ? req.files.content : [];
  const out = [];
  for (const f of list) {
    const name = await storeUploaded(f, { readable: true });
    out.push({
      name,
      originalName: f.originalname,
      url: '/uploads/' + name,
      size: f.size,
    });
  }
  return out;
}

function removeUpload(p) {
  if (!p || typeof p !== 'string' || !p.startsWith('/uploads/')) return;
  const name = p.slice('/uploads/'.length);
  if (cloud.status().files) {
    cloud.deleteFile(name).catch((err) => console.error(`[cloud] Could not delete ${name}: ${err.message}`));
    return;
  }
  fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
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
router.post('/', authenticate, requireAdmin, uploadCourseFiles(), wrap(async (req, res) => {
  const db = dbSvc.get();
  const { title, description, category, level, duration, price } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }
  if (!withinCloudLimits(req, res)) return;
  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0];
  const course = {
    id: dbSvc.nextId('course'),
    title: String(title).trim(),
    description: description || '',
    category: category || 'General',
    level: level || 'Beginner',
    duration: duration || '',
    price: price === undefined || price === '' ? 0 : Number(price) || 0,
    thumbnail: thumb ? `/uploads/${await storeUploaded(thumb)}` : '',
    content: await contentFromReq(req),
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.courses.push(course);
  dbSvc.save();
  res.status(201).json({ course: enrich(course) });
}));

// Admin: update
router.put('/:id', authenticate, requireAdmin, uploadCourseFiles(), wrap(async (req, res) => {
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
  if (!withinCloudLimits(req, res)) return;
  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0];
  if (thumb) {
    removeUpload(course.thumbnail);
    course.thumbnail = `/uploads/${await storeUploaded(thumb)}`;
  }
  const newContent = await contentFromReq(req);
  if (newContent.length) {
    course.content = (course.content || []).concat(newContent);
  }
  dbSvc.save();
  res.json({ course: enrich(course) });
}));

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

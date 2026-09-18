/** User management routes (admin only). */
const router = require('express').Router();
const dbSvc = require('../db');
const { authenticate, requireAdmin, publicUser } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// List all users (newest first) with enrollment counts.
router.get('/', (req, res) => {
  const db = dbSvc.get();
  const users = db.users
    .map((u) => ({
      ...publicUser(u),
      enrollments: db.enrollments.filter((e) => e.userId === u.id).length,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ users });
});

// Update role / status.
router.patch('/:id', (req, res) => {
  const db = dbSvc.get();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own role or status' });
  }
  const { role, status } = req.body || {};
  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    user.role = role;
  }
  if (status !== undefined) {
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    user.status = status;
  }
  dbSvc.save();
  res.json({ user: publicUser(user) });
});

// Delete a user (and their enrollments).
router.delete('/:id', (req, res) => {
  const db = dbSvc.get();
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  const idx = db.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'User not found' });
  db.users.splice(idx, 1);
  db.enrollments = db.enrollments.filter((e) => e.userId !== req.params.id);
  dbSvc.save();
  res.json({ ok: true });
});

module.exports = router;

/**
 * Runkaro server — Express API + static frontend (liquid glassmorphism UI).
 *
 *   Demo admin  : admin@runkaro.com   / Admin@123
 *   Demo student: student@runkaro.com / Student@123
 *
 * Run:  npm install && npm start   →  http://localhost:3000
 */
const express = require('express');
const path = require('path');
const dbSvc = require('./src/db');
const { seed } = require('./src/seed');
const { authenticate, requireAdmin } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

dbSvc.load();
seed();

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/courses', require('./src/routes/courses'));
app.use('/api/tutorials', require('./src/routes/tutorials'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/files', require('./src/routes/files'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'Runkaro API', time: new Date().toISOString() });
});

// Admin dashboard stats
app.get('/api/stats', authenticate, requireAdmin, (req, res) => {
  const db = dbSvc.get();
  res.json({
    stats: {
      users: db.users.length,
      courses: db.courses.length,
      tutorials: db.tutorials.length,
      enrollments: db.enrollments.length,
    },
    recentUsers: db.users
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt })),
  });
});

// Unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

// Error handler (multer + unexpected errors)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message || err);
  let status = err.status || 500;
  if (err.code === 'LIMIT_FILE_SIZE') status = 413;
  else if (err.name === 'MulterError') status = 400;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ✦ Runkaro is running');
  console.log(`  ✦ Site      : http://localhost:${PORT}`);
  console.log(`  ✦ Dashboard : http://localhost:${PORT}/dashboard.html`);
  console.log('  ✦ Admin login: set ADMIN_EMAIL / ADMIN_PASSWORD env vars (else the seeded demo credentials apply)');
  console.log('');
});

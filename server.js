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
const cloud = require('./src/cloud');
const { seed } = require('./src/seed');
const { authenticate, requireAdmin } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

/* Content types for cloud-served uploads (local files are handled by express.static). */
const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.ogv': 'video/ogg',
  '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip', '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed',
};

/** Serves /uploads/<name> from Cloudinary when the file is not on local disk. */
async function serveFromCloud(req, res) {
  if (!cloud.status().files) return res.status(404).send('Not found');
  const name = path.basename(req.params.name || '');
  if (!name || name.startsWith('.')) return res.status(400).send('Bad request');
  try {
    const upstream = await cloud.openDownload(name, req.headers.range);
    const ext = path.extname(name).toLowerCase();
    const inline = /^(\.jpg|\.jpeg|\.png|\.webp|\.gif|\.avif|\.svg|\.mp4|\.webm|\.ogv|\.ogg|\.mov|\.mp3|\.wav|\.m4a|\.pdf|\.txt|\.csv)$/.test(ext);
    res.status(upstream.statusCode === 206 ? 206 : 200);
    res.setHeader('Content-Type', upstream.headers['content-type'] || MIME_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/"/g, '')}"`);
    if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
    if (upstream.headers['content-range']) res.setHeader('Content-Range', upstream.headers['content-range']);
    upstream.pipe(res);
    upstream.on('error', () => res.destroy());
  } catch (err) {
    console.error(`[uploads] Could not stream "${name}" from Cloudinary — ${err.message}`);
    // The file itself may be fine but the server could not reach the Cloudinary
    // CDN — hand the browser a working URL directly as a fallback.
    //   1. signed URL generated locally (fast, no API call)
    //   2. URL confirmed via the Cloudinary Admin API (authoritative)
    // A genuine 404 from the CDN is double-checked via the API before giving up.
    let fallback = null;
    if (err.status !== 404) {
      try { fallback = cloud.signedUrl(name); } catch { /* ignore */ }
    }
    if (!fallback) {
      try { fallback = await cloud.resolveViaApi(name); } catch { /* ignore */ }
    }
    if (fallback) return res.redirect(fallback);
    res.status(err.status || 404).send('Not found');
  }
}

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1h' }));
// Files missing from the (ephemeral) local disk are streamed from Cloudinary:
app.get('/uploads/:name', serveFromCloud);
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/courses', require('./src/routes/courses'));
app.use('/api/tutorials', require('./src/routes/tutorials'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/files', require('./src/routes/files'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'Runkaro API', time: new Date().toISOString(), cloud: dbSvc.status() });
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

/** Start: cloud init → seed → listen. */
async function main() {
  await dbSvc.init();
  seed();

  // Flush the last pending snapshot to MongoDB on shutdown (Render sends SIGTERM on deploys).
  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received — saving any pending data…`);
    setTimeout(() => process.exit(0), 5000).unref(); // never hang the deploy
    dbSvc.flush().then(() => process.exit(0)).catch(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  app.listen(PORT, () => {
    console.log('');
    console.log('  ✦ Runkaro is running');
    console.log(`  ✦ Site      : http://localhost:${PORT}`);
    console.log(`  ✦ Dashboard : http://localhost:${PORT}/dashboard.html`);
    console.log('  ✦ Admin login: set ADMIN_EMAIL / ADMIN_PASSWORD env vars (else the seeded demo credentials apply)');
    console.log('');
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

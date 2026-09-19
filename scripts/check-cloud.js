/**
 * Runkaro — cloud storage diagnostic.
 *
 * Verifies the permanent-storage setup before/after configuring it:
 *   node scripts/check-cloud.js
 *
 * Reads the same env vars as the server:
 *   MONGODB_URI (+ optional MONGODB_DB)
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET (or CLOUDINARY_URL)
 */
(async () => {
  const cloud = require('../src/cloud');
  console.log('Runkaro — permanent storage check\n');

  const files = await cloud.initFiles();
  const db = await cloud.initDb();

  if (db) {
    const snap = await cloud.loadSnapshot();
    if (snap) {
      console.log(`[db] Snapshot found: ${(snap.users || []).length} users, ${(snap.courses || []).length} courses, ${(snap.tutorials || []).length} tutorials.`);
    } else if (snap === null) {
      console.log('[db] Connected — the snapshot is empty (the first server boot will seed it).');
    } else {
      console.log('[db] Connected but the snapshot could NOT be read — cloud saving stays disabled (see message above).');
    }
  }

  if (files) {
    try {
      const list = await cloud.listFiles();
      console.log(`[files] Cloudinary reachable — ${list.length} file(s) stored.`);
    } catch (err) {
      console.error(`[files] Cloudinary list failed: ${err.message}`);
    }
  }

  const s = cloud.status();
  console.log('\nStatus:', JSON.stringify(s, null, 2));

  if (s.db && s.files) {
    console.log('\n✅ Permanent storage is configured correctly.');
    process.exit(0);
  }
  console.log('\n❌ Not fully configured yet — follow the "Permanent storage (free)" section in README.md.');
  process.exit(1);
})();

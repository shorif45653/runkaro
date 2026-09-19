/**
 * Runkaro — tiny database layer.
 *
 * Data lives in memory and is persisted two ways:
 *   1. always — a local JSON file at ./data/db.json (perfect for local dev)
 *   2. when MONGODB_URI is set — a snapshot in MongoDB Atlas, so all data
 *      survives restarts on hosts with ephemeral disks (e.g. Render free tier).
 *
 * The in-memory object stays synchronous for every route (get()/save()),
 * so the rest of the app is untouched by the cloud layer.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloud = require('./cloud');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULTS = { users: [], courses: [], tutorials: [], enrollments: [], meta: {} };

let db = null;


function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalize() {
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.courses)) db.courses = [];
  if (!Array.isArray(db.tutorials)) db.tutorials = [];
  if (!Array.isArray(db.enrollments)) db.enrollments = [];
  if (!db.meta || typeof db.meta !== 'object') db.meta = {};
  if (!db.meta.jwtSecret) {
    db.meta.jwtSecret = crypto.randomBytes(32).toString('hex');
    save();
  }
}

/** Load from the local JSON file (fallback + local cache). */
function load() {
  ensureDataDir();
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (err) {
      console.error('[db] Could not parse db.json — recreating.', err.message);
      db = JSON.parse(JSON.stringify(DEFAULTS));
    }
  } else {
    db = JSON.parse(JSON.stringify(DEFAULTS));
  }
  normalize();
  return db;
}

/**
 * Full startup: local load first, then (when MONGODB_URI is set) the cloud
 * snapshot — cloud data wins over the local cache.
 */
async function init() {
  load();
  const files = await cloud.initFiles();
  const dbOk = await cloud.initDb();
  if (dbOk) {
    const snapshot = await cloud.loadSnapshot();
    if (snapshot) {
      db = snapshot;
      console.log('[db] Restored data from the MongoDB snapshot — everything from before the restart is back.');
    } else if (snapshot === null) {
      // Fresh (empty) cloud database — push what we have locally / seeded.
      console.log('[db] Cloud database is empty — saving the first snapshot.');
      cloud.scheduleSnapshotPush(db);
    }
    // snapshot === undefined → read failed; keep local data, cloud saving stays disabled.
  }
  normalize();
  return { db: dbOk, files };
}

/** Atomic-ish local save: write to a temp file then replace (+ cloud push). */
function save() {
  ensureDataDir();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
  cloud.scheduleSnapshotPush(db);
}

/** Incrementing readable IDs, e.g. user_1001, course_1002... */
function nextId(prefix) {
  db.meta.lastId = (db.meta.lastId || 1000) + 1;
  return `${prefix}_${db.meta.lastId}`;
}

function get() {
  if (!db) load();
  return db;
}

function status() {
  return cloud.status();
}

/** Flush any pending cloud write (used on shutdown). */
async function flush() {
  await cloud.flushAndClose();
}

module.exports = { load, init, save, get, nextId, status, flush, DB_PATH, DATA_DIR };

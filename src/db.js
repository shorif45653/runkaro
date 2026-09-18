/**
 * Runkaro — tiny JSON-file database layer.
 * Zero native dependencies, safe for demos; data persists in ./data/db.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULTS = { users: [], courses: [], tutorials: [], enrollments: [], meta: {} };

let db = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.courses)) db.courses = [];
  if (!Array.isArray(db.tutorials)) db.tutorials = [];
  if (!Array.isArray(db.enrollments)) db.enrollments = [];
  if (!db.meta || typeof db.meta !== 'object') db.meta = {};
  if (!db.meta.jwtSecret) {
    db.meta.jwtSecret = crypto.randomBytes(32).toString('hex');
    save();
  }
  return db;
}

/** Atomic-ish save: write to a temp file then replace. */
function save() {
  ensureDataDir();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
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

module.exports = { load, save, get, nextId, DB_PATH, DATA_DIR };

/**
 * Runkaro — optional cloud persistence layer.
 *
 *   • Database → MongoDB Atlas (M0 free tier — permanent, no credit card)
 *       env: MONGODB_URI   e.g. mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/
 *            MONGODB_DB    optional, default "runkaro"
 *
 *   • Uploaded files → Cloudinary (free plan, ~25 GB of storage+bandwidth credits)
 *       env: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 *            (or a single CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>)
 *            CLOUDINARY_FOLDER    optional, default "runkaro"
 *
 * Files are stored as private ("authenticated") Cloudinary assets and are
 * streamed through this server, so URLs keep the same /uploads/<name> shape
 * and nothing is ever exposed publicly.
 *
 * When the env vars are missing, everything falls back to the local JSON store
 * and the local uploads/ folder — local development needs no setup at all.
 */
const path = require('path');
const https = require('https');
const { MongoClient } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = (process.env.MONGODB_DB || 'runkaro').trim() || 'runkaro';
const SNAPSHOT_ID = 'runkaro_state';
const FOLDER =
  ((process.env.CLOUDINARY_FOLDER || 'runkaro').trim().replace(/[^a-zA-Z0-9._\-/]/g, '').replace(/^\/+|\/+$/g, '')) || 'runkaro';

// Per-file caps matching the Cloudinary FREE plan (MB): images 10, video/audio 100, other 10.
const MAX_FILE_MB = { image: 10, video: 100, raw: 10 };

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.tif', '.tiff', '.svg']);
const MEDIA_EXTS = new Set(['.mp4', '.webm', '.ogv', '.ogg', '.mov', '.mkv', '.avi', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.oga']);

const state = {
  dbConfigured: false, // MONGODB_URI present
  dbConnected: false,  // connected to Atlas
  cloudSynced: false,  // safe to push snapshots (never overwrite data we failed to read)
  filesConfigured: false,
  filesVerified: false,
  lastPushAt: null,
  lastPushError: null,
};

let client = null;
let collection = null;

/* ------------------------------------------------------------------ */
/* Database snapshot (MongoDB Atlas)                                   */
/* ------------------------------------------------------------------ */

async function initDb() {
  if (!MONGODB_URI) {
    console.log('[cloud] MONGODB_URI not set — using the local JSON store (data/db.json).');
    return false;
  }
  state.dbConfigured = true;
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    collection = client.db(MONGODB_DB).collection('app_state');
    state.dbConnected = true;
    console.log(`[cloud] MongoDB connected — the database snapshot lives in "${MONGODB_DB}".app_state.`);
    return true;
  } catch (err) {
    client = null;
    collection = null;
    state.dbConnected = false;
    state.cloudSynced = false;
    console.error('[cloud] MongoDB connection FAILED — falling back to the local JSON store.');
    console.error('[cloud] Data will NOT persist across restarts until this is fixed.');
    console.error(`[cloud]   → ${err.message}`);
    return false;
  }
}

/**
 * Reads the saved database snapshot from MongoDB.
 *   returns an object  → the snapshot (cloud data wins over the local cache)
 *   returns null       → cloud reachable but empty (safe to seed + push)
 *   returns undefined  → cloud could not be read (pushes stay disabled)
 */
async function loadSnapshot() {
  if (!collection) return undefined;
  try {
    const doc = await collection.findOne({ _id: SNAPSHOT_ID });
    state.cloudSynced = true;
    return doc && doc.data && typeof doc.data === 'object' ? doc.data : null;
  } catch (err) {
    state.cloudSynced = false;
    console.error('[cloud] Could not read the snapshot from MongoDB — cloud saving is DISABLED so your stored data stays safe.');
    console.error(`[cloud]   → ${err.message}`);
    return undefined;
  }
}

/* Debounced snapshot push: coalesces bursts of saves into a single write. */
let latest = null;
let flushTimer = null;
let inFlight = false;

function scheduleSnapshotPush(data) {
  if (!collection || !state.cloudSynced) return;
  latest = data;
  if (inFlight || flushTimer) return;
  flushTimer = setTimeout(() => flushSnapshot().catch(() => {}), 1200);
  if (flushTimer.unref) flushTimer.unref();
}

async function writeSnapshot(data) {
  await collection.updateOne(
    { _id: SNAPSHOT_ID },
    { $set: { data, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
  state.lastPushAt = new Date().toISOString();
  state.lastPushError = null;
}

async function flushSnapshot() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (inFlight || latest === null) return;
  const data = latest;
  latest = null;
  inFlight = true;
  try {
    await writeSnapshot(data);
  } catch (err) {
    latest = data; // retry on the next save / flush
    state.lastPushError = err.message;
    console.error(`[cloud] Snapshot push failed (will retry on the next save): ${err.message}`);
  } finally {
    inFlight = false;
    if (latest !== null) {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => flushSnapshot().catch(() => {}), 5000);
      if (flushTimer.unref) flushTimer.unref();
    }
  }
}

/** Push any pending snapshot now, then close the connection (used on shutdown). */
async function flushAndClose() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (latest !== null && collection && state.cloudSynced && !inFlight) {
    const data = latest;
    latest = null;
    try {
      await writeSnapshot(data);
    } catch (err) {
      console.error(`[cloud] Final snapshot push failed: ${err.message}`);
    }
  }
  if (client) {
    try { await client.close(); } catch { /* already closed */ }
  }
}

/* ------------------------------------------------------------------ */
/* File storage (Cloudinary)                                           */
/* ------------------------------------------------------------------ */

async function initFiles() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL } = process.env;
  if (CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  const cfg = cloudinary.config();
  state.filesConfigured = Boolean(cfg.cloud_name && cfg.api_key && cfg.api_secret);
  if (!state.filesConfigured) {
    console.log('[cloud] Cloudinary not configured — uploads use the local uploads/ folder.');
    return false;
  }
  try {
    await cloudinary.api.ping();
    state.filesVerified = true;
    console.log('[cloud] Cloudinary ready — uploaded files persist there and are served via /uploads/<name>.');
  } catch (err) {
    console.error(`[cloud] Cloudinary ping FAILED (check the credentials): ${err.message}`);
  }
  return true;
}

/** Cloudinary resource type for a stored file name (audio counts as "video"). */
function resourceTypeFor(name) {
  const ext = path.extname(name || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (MEDIA_EXTS.has(ext)) return 'video';
  return 'raw';
}

/** Max upload size (bytes) for a file name under the Cloudinary free plan. */
function maxSizeFor(name) {
  return MAX_FILE_MB[resourceTypeFor(name)] * 1024 * 1024;
}

function publicId(name) {
  return `${FOLDER}/${name}`;
}

/** Uploads a buffer as a private ("authenticated") Cloudinary asset. */
function uploadFile(buffer, name) {
  const options = {
    resource_type: resourceTypeFor(name),
    type: 'authenticated',
    public_id: publicId(name),
    overwrite: true,
    invalidate: true,
  };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Signed, direct Cloudinary URL for a stored file (authenticated assets).
 * Also used as a browser-redirect fallback when server-side streaming fails.
 */
function signedUrl(name) {
  return cloudinary.url(publicId(name), {
    resource_type: resourceTypeFor(name),
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });
}

/**
 * Resolves a stored file to a working URL using the Cloudinary Admin API
 * (api.cloudinary.com — IPv4, no CDN signature pitfalls). Returns null when
 * the asset genuinely does not exist.
 */
async function resolveViaApi(name) {
  try {
    const res = await cloudinary.api.resource(publicId(name), {
      resource_type: resourceTypeFor(name),
      type: 'authenticated',
    });
    return res.secure_url || null;
  } catch (err) {
    return null;
  }
}

/**
 * Opens a server-side stream to a stored file (signed URL → HTTPS response).
 * Supports HTTP Range so <video> seeking keeps working.
 *
 * IMPORTANT: forces IPv4 (family: 4). res.cloudinary.com resolves to IPv6
 * (Cloudflare) first, and hosts without outbound IPv6 (e.g. Render) blackhole
 * those connections — the request would hang forever. The Cloudinary API host
 * (api.cloudinary.com, used for uploads/listing) is IPv4-only, which is why
 * uploads kept working while file streaming hung.
 */
function openDownload(name, rangeHeader) {
  const attempt = (target, redirectsLeft) =>
    new Promise((resolve, reject) => {
      const req = https.get(
        target,
        {
          family: 4,
          ...(rangeHeader ? { headers: { Range: rangeHeader } } : {}),
        },
        (upstream) => {
          // Follow redirects (the CDN may 30x to another edge URL).
          if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
            upstream.resume();
            if (redirectsLeft <= 0) {
              const err = new Error(`Too many redirects fetching ${name} from Cloudinary`);
              err.status = 502;
              return reject(err);
            }
            try {
              return resolve(attempt(new URL(upstream.headers.location, target).toString(), redirectsLeft - 1));
            } catch (err) {
              err.status = 502;
              return reject(err);
            }
          }
          if (upstream.statusCode >= 400) {
            upstream.resume();
            const err = new Error(`Cloudinary responded ${upstream.statusCode} for ${name}`);
            err.status = 404;
            return reject(err);
          }
          resolve(upstream);
        }
      );
      req.on('error', reject);
      // Never hang: if the connection stalls, fail after 20s (err.status 504).
      req.setTimeout(20000, () => req.destroy(Object.assign(new Error(`Timed out fetching ${name} from Cloudinary`), { status: 504 })));
    });
  return attempt(signedUrl(name), 3);
}

async function deleteFile(name) {
  await cloudinary.uploader.destroy(publicId(name), {
    resource_type: resourceTypeFor(name),
    type: 'authenticated',
    invalidate: true,
  });
}

/** Lists stored files: [{ name, size, modified }] (newest first). */
async function listFiles() {
  const out = [];
  for (const resourceType of ['image', 'video', 'raw']) {
    const res = await cloudinary.api.resources({
      type: 'authenticated',
      prefix: `${FOLDER}/`,
      resource_type: resourceType,
      max_results: 500,
    });
    for (const r of res.resources || []) {
      const name = r.public_id && r.public_id.startsWith(`${FOLDER}/`)
        ? r.public_id.slice(FOLDER.length + 1)
        : null;
      if (!name || name.includes('/')) continue;
      out.push({ name, size: r.bytes || 0, modified: r.created_at });
    }
  }
  return out;
}

function status() {
  return {
    db: state.dbConnected && state.cloudSynced,
    dbConfigured: state.dbConfigured,
    dbConnected: state.dbConnected,
    files: state.filesConfigured,
    filesVerified: state.filesVerified,
    lastPushAt: state.lastPushAt,
    lastPushError: state.lastPushError,
  };
}

module.exports = {
  MAX_FILE_MB,
  initDb,
  loadSnapshot,
  scheduleSnapshotPush,
  flushAndClose,
  initFiles,
  resourceTypeFor,
  maxSizeFor,
  uploadFile,
  openDownload,
  signedUrl,
  resolveViaApi,
  deleteFile,
  listFiles,
  status,
};




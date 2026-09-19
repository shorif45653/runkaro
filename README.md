# Runkaro 🚀

A full-stack online learning platform with a **liquid glassmorphism** UI — courses, tutorials,
user accounts and a complete admin dashboard.

## Quick start

```bash
npm install
npm start
```

Then open **http://localhost:3000**

## Demo credentials

| Role    | Email               | Password    |
| ------- | ------------------- | ----------- |
| Admin   | admin@runkaro.com   | `Admin@123` |
| Student | student@runkaro.com | `Student@123` |

Anyone can also create a new account via **Get started → Create account**.

## Features

- **Frontend + backend**: Express serves both the API and the static glass UI.
- **Anyone can sign in / register** — open registration with JWT sessions (7-day tokens).
- **Admin dashboard** (`/dashboard.html`, admin role required):
  - **Overview** — live stats (users, courses, tutorials, enrollments) + recent users.
  - **Courses** — upload/create/edit/delete courses with optional thumbnail images.
  - **Tutorials** — create/edit/delete tutorials using a YouTube link **or** an uploaded video file, plus thumbnails.
  - **Users** — promote/demote roles, suspend/activate accounts, delete users.
  - **Files manager** — upload any files from your computer (images, videos, PDFs, archives…) and copy public URLs.
- **Student area** — browse courses/tutorials with search + filters, course detail pages
  with one-click enrollment, "My Learning" page, embedded video player for tutorials.
- **Demo data** — on first run the server seeds the demo accounts, 4 courses and 4 tutorials.

## Tech

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Backend   | Node.js + Express 4, JWT (jsonwebtoken), bcryptjs password hashing |
| Uploads   | Multer → local `/uploads` **or Cloudinary** (free plan) when configured |
| Database  | In-memory JSON store → `data/db.json` locally, **snapshot in MongoDB Atlas** when configured |
| Frontend  | Vanilla HTML/CSS/JS with liquid glassmorphism (frosted glass, animated gradient blobs, shine sweeps) |

## Project layout

```
server.js                 Express app + routes wiring + admin stats endpoint
src/
  db.js                   Database layer (local JSON + optional MongoDB snapshot)
  cloud.js                Optional cloud persistence (MongoDB Atlas + Cloudinary)
  seed.js                 Demo admin/student + sample content
  upload.js               Multer config (disk storage, or memory → Cloudinary)
  middleware/auth.js      JWT auth + admin guard
  routes/                 auth.js · courses.js · tutorials.js · users.js · files.js
public/                   Frontend (all pages + glass UI)
  css/                    base · effects · components · ui · sections · pages · dashboard
  js/                     api · ui · nav · dashboard (split per tab)
data/db.json              Local store, created at first run (accounts, content, sessions secret)
uploads/                  Uploaded images/videos (local mode only)
scripts/                  check-cloud.js (storage diagnostic) · smoke.js (API smoke test)
```

## API overview

| Method | Endpoint                  | Access   | Purpose                          |
| ------ | ------------------------- | -------- | -------------------------------- |
| POST   | `/api/auth/register`      | Public   | Create account                   |
| POST   | `/api/auth/login`         | Public   | Sign in (returns JWT)            |
| GET    | `/api/auth/me`            | Auth     | Current user                     |
| GET    | `/api/courses`            | Public   | List/filter courses              |
| GET    | `/api/courses/:id`        | Public   | Course detail                    |
| GET    | `/api/courses/mine`       | Auth     | My enrolled courses              |
| POST   | `/api/courses`            | Admin    | Create course (multipart)        |
| PUT    | `/api/courses/:id`        | Admin    | Update course                    |
| DELETE | `/api/courses/:id`        | Admin    | Delete course                    |
| POST   | `/api/courses/:id/enroll` | Auth     | Enroll in a course               |
| GET    | `/api/tutorials`          | Public   | List/filter tutorials            |
| POST   | `/api/tutorials`          | Admin    | Create tutorial (multipart)      |
| PUT    | `/api/tutorials/:id`      | Admin    | Update tutorial                  |
| DELETE | `/api/tutorials/:id`      | Admin    | Delete tutorial                  |
| GET    | `/api/users`              | Admin    | List users                       |
| PATCH  | `/api/users/:id`          | Admin    | Change role / status             |
| DELETE | `/api/users/:id`          | Admin    | Delete user                      |
| GET    | `/api/files`              | Admin    | List uploaded files              |
| POST   | `/api/files`              | Admin    | Upload files (multipart, ≤10)    |
| DELETE | `/api/files/:name`        | Admin    | Delete an uploaded file          |
| GET    | `/api/stats`              | Admin    | Dashboard stats                  |
| GET    | `/api/health`             | Public   | Health + cloud storage status    |

## Deploy (free)

The site runs on [Render](https://render.com)'s free plan — every push to `main` auto-deploys.

1. Push this repo to GitHub.
2. On render.com → **New + → Web Service** → connect the repo.
3. Runtime **Node**, build command `npm install`, start command `npm start`, health-check path `/api/health`.
4. Add env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD` (and optionally `STUDENT_EMAIL` / `STUDENT_PASSWORD`) to replace the demo credentials.
5. ⚠️ The Render free-tier disk is **ephemeral** — anything stored on it resets on every restart/redeploy. Follow the next section to keep all data permanently.
6. With the server running, `node scripts/smoke.js` exercises the whole API end to end.

## Permanent storage (free)

Render's free instances wipe the local disk on every restart, so Runkaro keeps its data in two
free cloud services instead (both permanently free, no credit card). Without them the app still
runs in local mode — perfect for development.

| What           | Service          | Free-tier room                                        |
| -------------- | ---------------- | ----------------------------------------------------- |
| Database       | MongoDB Atlas M0 | 512 MB (users, courses, tutorials, enrollments…)      |
| Uploaded files | Cloudinary       | ~25 GB/month credits (media storage + CDN bandwidth)  |

### 1. MongoDB Atlas (~5 minutes)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → **Build a Cluster** → choose the **M0 Free** tier → pick the region closest to your Render service → **Create**.
2. **Database Access** → *Add New Database User* → username + password (save them), role *Read and write to any database*.
3. **Network Access** → *Add IP Address* → **Allow access from anywhere** `0.0.0.0/0` (Render's outbound IPs vary).
4. **Database → Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://myuser:mypass@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority`

### 2. Cloudinary (~3 minutes)

1. Sign up free at [cloudinary.com](https://cloudinary.com) (no card needed).
2. Console → **Settings** (gear icon) → copy **Cloud name**, **API key** and **API secret**.

### 3. Set the env vars on Render

Render Dashboard → your service → **Environment** → add:

```
MONGODB_URI=mongodb+srv://myuser:mypass@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Optionally also `MONGODB_DB=runkaro` (Atlas database name) and `CLOUDINARY_FOLDER=runkaro`
(Cloudinary folder). Save → Render redeploys → the deploy log should show:

```
[cloud] MongoDB connected — the database snapshot lives in "runkaro".app_state.
[cloud] Cloudinary ready — uploaded files persist there and are served via /uploads/<name>.
```

From now on **everything you create in the admin dashboard survives restarts and redeploys**:
on boot the server restores the snapshot from MongoDB, and every change (files included) is
written back within a second or two. Uploaded files keep their `/uploads/<name>` URLs — they
are stored as private Cloudinary assets and streamed through your server.

### Verify & limits

- Health check shows the status: `/api/health` → `"cloud": { "db": true, "files": true }`.
- Local check: set the same env vars in your shell and run `npm run check:cloud`.
- Cloudinary free-plan per-file caps (enforced by the app): **images 10 MB, video/audio 100 MB, other files 10 MB**. Bigger videos → use YouTube links; need more room → upgrade Cloudinary.
- If the site is unused for a very long time, the free Atlas cluster may be paused — open the [Atlas dashboard](https://cloud.mongodb.com) and click **Resume**; your data is kept.

## Notes

- Set a custom port with `PORT=4000 npm start` (or `$env:PORT=4000` in PowerShell).
- Local mode: to reset all data, stop the server and delete `data/db.json` — demo data re-seeds on next start.
- Cloud mode: to fully reset, delete the `runkaro_state` document (Atlas → Browse Collections → `app_state`) and the Cloudinary assets, then restart — the server re-seeds and saves a fresh snapshot.
- Without the cloud env vars the app falls back to the local JSON store + `uploads/` folder — local development needs no setup.

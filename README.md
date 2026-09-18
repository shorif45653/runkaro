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
  - **Tutorials** — create/edit/delete tutorials using a YouTube link **or** an uploaded video file (up to 150 MB), plus thumbnails.
  - **Users** — promote/demote roles, suspend/activate accounts, delete users.
  - **Files manager** — upload any files from your computer (images, videos, PDFs, archives…) and copy public URLs.
- **Student area** — browse courses/tutorials with search + filters, course detail pages
  with one-click enrollment, "My Learning" page, embedded video player for tutorials.
- **Demo data** — on first run the server seeds the demo accounts, 4 courses and 4 tutorials.

## Tech

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Backend   | Node.js + Express 4, JWT (jsonwebtoken), bcryptjs password hashing |
| Uploads   | Multer → `/uploads` (served statically)                       |
| Database  | JSON file store at `data/db.json` (zero native deps, survives restarts) |
| Frontend  | Vanilla HTML/CSS/JS with liquid glassmorphism (frosted glass, animated gradient blobs, shine sweeps) |

## Project layout

```
server.js                 Express app + routes wiring + admin stats endpoint
src/
  db.js                   JSON file database layer
  seed.js                 Demo admin/student + sample content
  upload.js               Multer config (images + videos)
  middleware/auth.js      JWT auth + admin guard
  routes/                 auth.js · courses.js · tutorials.js · users.js
public/                   Frontend (all pages + glass UI)
  css/                    base · effects · components · ui · sections · pages · dashboard
  js/                     api · ui · nav · dashboard (split per tab)
data/db.json              Created at first run (accounts, content, sessions secret)
uploads/                  Uploaded images/videos
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

## Notes

- Set a custom port with `PORT=4000 npm start` (or `$env:PORT=4000` in PowerShell).
- To reset all data, stop the server and delete `data/db.json` — demo data re-seeds on next start.
- This is a demo stack: the JSON store is perfect for local testing; swap in a real database for production.

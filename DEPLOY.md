# Runkaro — Publish for $0 (free deployment guide)

Verified against provider docs, September 2026.

## Which option to pick

| Option | Cost | Always on? | Data persists? | Effort | Best for |
| ------ | ---- | ---------- | -------------- | ------ | -------- |
| **A. Render.com (free)** | $0 | No — sleeps after 15 min idle | No — disk resets on restart | ~10 min | Sharing a demo fast |
| **B. Oracle Always Free VM** | $0 | Yes | Yes (200 GB disk) | 1–2 hrs | The real, permanent home |
| **C. Cloudflare Tunnel (own PC)** | $0 | Only while PC runs | Yes | ~30 min | Quick public URL for testing |

**Recommendation:** start with **A** today (share the link in minutes), move to **B** when you
want courses/uploads to survive restarts. Both are 100% free — no card charged.

---

## Option A — Render.com (fastest, no credit card)

1. **Push the repo to GitHub** (git is already initialized locally — see "Git" at the bottom).
2. Sign up at **render.com** → Dashboard → **New + → Web Service** → connect your GitHub repo.
   (This repo includes a `render.yaml` blueprint — you can instead use **New + → Blueprint** and
   Render prefills everything below.)
3. Settings:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - **Health Check Path:** `/api/health`
   - Instance Type: **Free**
4. Click **Create Web Service**. Render builds, starts, and gives you
   `https://<your-name>.onrender.com` — free HTTPS and free subdomain included.
   On first boot the server auto-seeds the demo accounts and sample content.

**Free-tier realities (from Render's docs):** the service **sleeps after 15 minutes** without
traffic — the next visitor waits ~30–60 s for a cold start. You get 750 free instance-hours and
included bandwidth per month. **Local files are lost on every restart/redeploy**, i.e. the JSON
database and uploaded images/videos reset to the seed data. Perfect for a public demo; don't
treat it as durable storage.

---

## Option B — Oracle Cloud Always Free (free forever, always-on, persistent)

Still fully $0 in 2026. The ARM allowance is now **2 OCPU / 12 GB** (halved from 4/24), but the
tiny AMD micro VM (1 GB RAM) is plenty for Runkaro. Includes **200 GB storage** and ~10 TB/mo
egress. Signup needs a credit card for identity verification only — never charged on Always Free.

1. Create an Ubuntu VM: shape **VM.Standard.A1.Flex** (2 OCPU / 12 GB) or **VM.Standard.E2.1.Micro**.
2. Networking → Security List: allow inbound **TCP 22, 80, 443** from `0.0.0.0/0`
   (and open the same ports in the OS firewall).
3. On the server:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git
   git clone https://github.com/<you>/runkaro.git && cd runkaro && npm install
   sudo npm i -g pm2 && pm2 start server.js --name runkaro && pm2 save && pm2 startup
   ```
4. Free HTTPS + free domain: create a free **duckdns.org** subdomain (e.g. `runkaro.duckdns.org`)
   pointing to the VM's public IP, then install Caddy and create `/etc/caddy/Caddyfile`:
   ```
   runkaro.duckdns.org {
       reverse_proxy localhost:3000
   }
   ```
   Caddy issues and renews free Let's Encrypt certificates automatically.
5. Done — `data/` and `uploads/` live on the VM disk and **survive restarts and redeploys**.

---

## Option C — Public URL from your own PC (Cloudflare Tunnel)

Install `cloudflared` (free) and run `cloudflared tunnel --url http://localhost:3000`.
Without a domain you get a random `*.trycloudflare.com` URL; the site is reachable only while
your PC is on and the tunnel runs. Good for showing the project to someone today.

---

## Security checklist BEFORE going public

- **Change the demo credentials.** The admin login is currently printed on the login page and in
  `src/seed.js` — anyone could log in as admin. Either:
  - edit `src/seed.js`, replacing the two demo accounts (generate a hash with
    `node -e "console.log(require('bcryptjs').hashSync('YOUR_NEW_PASSWORD',10))"`), **and**
    delete/trim the demo-credentials box in `public/login.html`, **or**
  - keep them only if the site is explicitly a demo and you accept everyone knowing them.
- Lower the upload size limit if you like: `src/upload.js` (currently 150 MB).
- Optional hardening: add `helmet` and `express-rate-limit` packages later.

---

## Git — already initialized locally

The project is committed locally and `.gitignore` excludes `node_modules/`, `data/`, `uploads/`
and `.server.pid`, so the repo is clean. To publish it to GitHub:

```bash
cd c:\Runkaro
git remote add origin https://github.com/<you>/runkaro.git
git push -u origin main
```

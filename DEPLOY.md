# Runkaro — Publish for $0 (free deployment guide)

Verified against provider docs, September 2026.

## Which option to pick

| Option | Cost | Always on? | Data persists? | Effort | Best for |
| ------ | ---- | ---------- | -------------- | ------ | -------- |
| **A. Render.com (free)** | $0 | No — sleeps after 15 min idle | No — disk resets on restart | ~10 min | Sharing a demo fast |
| **B. Oracle Always Free VM** | $0 | Yes | Yes (200 GB disk) | 1–2 hrs | The real, permanent home |
| **C. Cloudflare Tunnel (own PC)** | $0 | Only while PC runs | Yes | ~30 min | Quick public URL for testing |

**Recommendation:** start with **A** today — **no card needed anywhere** (share the link in
minutes). Option B is also $0 forever but **requires a card at signup** for identity
verification, so do it later when you want courses/uploads to survive restarts.

---

## Option A — Render.com (fastest, no card at all)

Sign up with your GitHub account — Render's free tier needs **no credit card and no payment
method anywhere**.

1. **Push the repo to GitHub** (git is already initialized locally — see "Git" at the bottom).
2. Sign up at **render.com** with GitHub → Dashboard → **New + → Blueprint** → select the
   `runkaro` repo. The included `render.yaml` prefills everything: Node runtime,
   `npm install` / `npm start`, health check `/api/health`, Free plan.
3. **Set your real admin credentials** — during the Blueprint apply, Render asks you for
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` (marked secret in the blueprint). Enter your own values:
   on first boot the seeder creates the admin account with them, so nobody can use the public
   demo login. The demo-credentials box on the login/register pages also hides itself
   automatically on any non-localhost host.
4. Click **Apply** → Render builds and gives you `https://<your-name>.onrender.com`
   (free HTTPS + free subdomain included). Sample courses/tutorials seed automatically.
5. *(Optional)* Keep it awake: free services **sleep after 15 minutes** of no traffic and the
   next visitor waits ~30–60 s. Create a free monitor at **cron-job.org** or **UptimeRobot**
   (both free, no card) that pings `https://<your-name>.onrender.com/api/health` every
   10 minutes — visitors never see the cold start, and the 750 free instance-hours still cover
   a full month 24/7.

**Free-tier realities (from Render's docs):** **local files are lost on every
restart/redeploy** — the database and uploaded images/videos reset to the seed data (the pinger
prevents sleep, but Render may still restart a free instance at any time). For a public demo:
prefer **YouTube links** over uploaded videos, and re-add anything important after a redeploy.
When you want durable storage later, move to Oracle (Option B) — same code, `git pull` on the VM.

---

## Option B — Oracle Cloud Always Free (free forever, always-on, persistent)

> **Full click-by-click walkthrough with a one-shot server script: see [`DEPLOY-ORACLE.md`](DEPLOY-ORACLE.md).**

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

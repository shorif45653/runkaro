# Runkaro on Oracle Cloud Always Free — click-by-click guide

$0 forever. Always-on. Data persists (database + uploaded files live on the VM disk).
First-time setup: ~60–90 minutes. Helper scripts are in [`deploy/`](deploy/).

## 0. What you need
- A credit/debit card (identity verification only — never charged on Always Free)
- Your code pushed to GitHub (step 5)
- 30–60 minutes

## 1. Create the Oracle account
1. Go to **signup.cloud.oracle.com** → "Start for free".
2. Pick your **Home Region** carefully — it is permanent. Choose the region physically
   closest to your visitors.
3. Verify with your card (a small temporary hold may appear; it is refunded).

## 2. Create the VM
1. Menu ☰ → **Compute → Instances → Create Instance**.
2. Name: `runkaro` · Image: **Ubuntu 24.04** (or 22.04).
3. Shape:
   - First choice: **VM.Standard.A1.Flex** — 2 OCPU, 12 GB (Always Free; 2026 allowance).
   - If you hit *"Out of host capacity"*: retry later, try another Availability Domain,
     or use **VM.Standard.E2.1.Micro** (1 GB) — also Always Free and plenty for Runkaro.
4. SSH keys: choose *Generate a key pair* and **download the private key** (keep it safe).
5. Boot volume: default (~47 GB, up to 200 GB free in total) → **Create**.
6. Wait for the instance to be **RUNNING**, then copy its **Public IP address**.

## 3. Open ports 80 + 443 (Oracle's network firewall)
1. On the instance page → click the **Virtual cloud network** link → **Security Lists** →
   **Default Security List** → **Add Ingress Rules** (add two):
   - Source CIDR `0.0.0.0/0` · IP Protocol **TCP** · Destination Port **80**
   - Source CIDR `0.0.0.0/0` · IP Protocol **TCP** · Destination Port **443**
   (Port 22 for SSH is already open.)

## 4. Free domain via DuckDNS
1. Sign in at **duckdns.org** (can use your GitHub account).
2. Add a subdomain, e.g. `runkaro` → you get `runkaro.duckdns.org` and a **token**.
3. Enter the VM's public IP in the current IP field — the setup script below also installs
   a cron that keeps it updated every 5 minutes.

## 5. Push your code to GitHub (from your PC)
```powershell
cd c:\Runkaro
git remote add origin https://github.com/<you>/runkaro.git
git push -u origin main
```

## 6. One-shot server setup (on the VM)
```bash
ssh -i /path/to/private-key ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt install -y git
git clone https://github.com/<you>/runkaro.git
cd runkaro/deploy

# strip Windows line endings if present, then run:
sed -i 's/\r$//' setup-server.sh
sudo bash setup-server.sh runkaro.duckdns.org YOUR_DUCKDNS_TOKEN https://github.com/<you>/runkaro.git main
```
The script installs Node 22 + pm2 + Caddy, opens and persists the OS firewall rules, clones
the app to `/opt/runkaro`, starts it, keeps DuckDNS updated, and configures auto-HTTPS.

## 7. Secure it (do this BEFORE sharing the link)
1. `sudo nano /opt/runkaro/deploy/ecosystem.config.js` → set your real
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` (and student credentials, or leave them).
2. Re-seed the database with the new credentials:
   ```bash
   sudo pm2 delete runkaro
   sudo rm -f /opt/runkaro/data/db.json
   sudo pm2 start /opt/runkaro/deploy/ecosystem.config.js
   ```
3. Remove the demo-credentials box from the login page: edit `public/login.html` on GitHub
   (delete the whole `<div class="demo-box">…</div>` block), commit, then on the VM:
   ```bash
   cd /opt/runkaro && sudo git pull && sudo pm2 restart runkaro
   ```

## 8. Day-2 commands
```bash
sudo pm2 logs runkaro          # app logs
sudo pm2 restart runkaro       # restart app
journalctl -u caddy -e         # web-server logs
cd /opt/runkaro && sudo git pull && sudo npm install && sudo pm2 restart runkaro   # deploy updates
```

## Troubleshooting
- **"Out of host capacity"** when creating the VM → retry (capacity frees up), pick a
  different Availability Domain, or fall back to the E2.1.Micro shape.
- **Site unreachable** → check *both* firewalls: the Oracle Security List (step 3) and the
  OS iptables (the script handles this). Then verify DNS points at the VM's public IP.
- **Certificate errors** → port 80 must be reachable for Let's Encrypt; confirm DuckDNS IP.
- **Changed ADMIN_* but old login still works** → seeding only runs on an empty database;
  repeat step 7.2 (`rm -f data/db.json`) to re-seed.
- **Oracle idle reclamation** → Always Free instances idle for ~a week may be stopped;
  a real site with traffic won't be affected. You can restart the VM from the console if it
  happens.

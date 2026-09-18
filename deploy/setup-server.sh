#!/usr/bin/env bash
# =============================================================
# Runkaro — one-shot server setup for Oracle Cloud Always Free
# Target: Ubuntu 22.04 / 24.04 (AMD64 or ARM64)
#
# Usage:
#   sudo bash setup-server.sh <domain> <duckdns-token> <repo-url> [branch]
# Example:
#   sudo bash setup-server.sh runkaro.duckdns.org 1a2b3c4d-... https://github.com/you/runkaro.git main
#
# What it does:
#   1. Installs Node 22 + git
#   2. Opens firewall ports 80/443 and persists the rules (Oracle Ubuntu images ship with iptables locked to 22)
#   3. Clones/updates the repo at /opt/runkaro
#   4. Starts the app with pm2 (boot-persistent)
#   5. Installs a DuckDNS cron to keep DNS pointed at this server
#   6. Installs Caddy as reverse proxy with automatic HTTPS certificates
# =============================================================
set -euo pipefail

DOMAIN="${1:?usage: setup-server.sh <domain> <duckdns-token> <repo-url> [branch]}"
TOKEN="${2:-}"
REPO="${3:?}"
BRANCH="${4:-main}"
APP_DIR="/opt/runkaro"

[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo"; exit 1; }

echo "==> [1/8] Base packages"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

echo "==> [2/8] Node.js 22"
curl -fsSL "https://deb.nodesource.com/setup_22.x" | bash -
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
node -v && npm -v

echo "==> [3/8] Firewall: allow 80/443 and persist rules"
for PORT in 80 443; do
  iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT
done
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
netfilter-persistent save

echo "==> [4/8] Clone/update Runkaro at $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
npm install

echo "==> [5/8] Start app with pm2"
npm install -g pm2 >/dev/null 2>&1
pm2 delete runkaro >/dev/null 2>&1 || true
pm2 start "$APP_DIR/deploy/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> [6/8] DuckDNS cron (keeps DNS pointed at this server)"
if [ -n "$TOKEN" ]; then
  printf '*/5 * * * * root curl -s "https://www.duckdns.org/update?domains=%s&token=%s&verbose=false" >/dev/null 2>&1\n' \
    "$(echo "$DOMAIN" | sed 's/\.duckdns\.org$//')" "$TOKEN" > /etc/cron.d/duckdns
  chmod 644 /etc/cron.d/duckdns
  echo "    cron installed for $DOMAIN"
else
  echo "    no token given — skipping (manage DNS manually)"
fi

echo "==> [7/8] Caddy reverse proxy with auto-HTTPS"
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode gzip
    reverse_proxy localhost:3000
}
EOF
systemctl reload caddy 2>/dev/null || systemctl restart caddy

echo "==> [8/8] Verify"
sleep 2
curl -fsS http://localhost:3000/api/health && echo "  <- app OK"
systemctl is-active caddy >/dev/null && echo "caddy OK"

cat <<DONE

  ✅ Runkaro is deployed!
     URL      : https://$DOMAIN   (first visit may take ~1 min while Caddy issues the certificate)
     App dir  : $APP_DIR
     Logs     : pm2 logs runkaro   |   journalctl -u caddy -e
     IMPORTANT: edit $APP_DIR/deploy/ecosystem.config.js and set YOUR ADMIN_EMAIL / ADMIN_PASSWORD, then:
       pm2 delete runkaro && rm -f $APP_DIR/data/db.json && pm2 start $APP_DIR/deploy/ecosystem.config.js
DONE

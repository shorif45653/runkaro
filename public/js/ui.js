/* Runkaro — shared UI helpers (toasts, formatting, cards) */

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(message, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

function levelBadge(level) {
  return `<span class="badge level-${escapeHTML(level)}">${escapeHTML(level)}</span>`;
}
function priceLabel(price) {
  return Number(price) > 0 ? `$${Number(price)}` : 'Free';
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return ''; }
}
function youtubeEmbed(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
function thumbHTML(item) {
  if (item.thumbnail) return `<img src="${escapeHTML(item.thumbnail)}" alt="" loading="lazy">`;
  const letter = escapeHTML((item.title || '?').trim().charAt(0).toUpperCase());
  return `<div class="thumb-ph"><span>${letter}</span></div>`;
}
function emptyHTML(msg, icon = '🫧') {
  return `<div class="empty"><div class="big">${icon}</div><p>${escapeHTML(msg)}</p></div>`;
}

function courseCard(c) {
  const desc = c.description || '';
  const short = desc.length > 110 ? desc.slice(0, 110) + '…' : desc;
  return `<a class="glass glass-hover course-card" href="course.html?id=${encodeURIComponent(c.id)}">
    <div class="card-thumb">${thumbHTML(c)}</div>
    <div class="card-body">
      <div class="card-top"><span class="badge badge-cat">${escapeHTML(c.category)}</span>${levelBadge(c.level)}</div>
      <h3>${escapeHTML(c.title)}</h3>
      <p class="card-desc">${escapeHTML(short) || '&nbsp;'}</p>
      <div class="card-meta">
        <span>⏱ ${escapeHTML(c.duration || 'Self-paced')}</span>
        <span class="price ${Number(c.price) > 0 ? '' : 'free'}">${priceLabel(c.price)}</span>
      </div>
    </div>
  </a>`;
}

function tutorialCard(t) {
  const desc = t.description || '';
  const short = desc.length > 100 ? desc.slice(0, 100) + '…' : desc;
  return `<a class="glass glass-hover tutorial-card" href="tutorial.html?id=${encodeURIComponent(t.id)}">
    <div class="card-thumb">
      ${thumbHTML(t)}
      <div class="play-overlay"><span class="play-circle">▶</span></div>
    </div>
    <div class="card-body">
      <div class="card-top"><span class="badge badge-cat">${escapeHTML(t.category)}</span>${levelBadge(t.level)}</div>
      <h3>${escapeHTML(t.title)}</h3>
      <p class="card-desc">${escapeHTML(short) || '&nbsp;'}</p>
      <div class="card-meta">
        <span>⏱ ${escapeHTML(t.duration || 'Watch now')}</span>
        <span>${t.videoFile ? '📁 Video' : '▶ Stream'}</span>
      </div>
    </div>
  </a>`;
}

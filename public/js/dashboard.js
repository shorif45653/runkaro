/* Runkaro — Admin dashboard core: guard, tabs, stats */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) { location.replace('login.html?next=' + encodeURIComponent('dashboard.html')); return; }
  if (!Auth.isAdmin()) { location.replace('courses.html'); return; }

  window.Dash = { courses: [], tutorials: [], users: [], editingCourse: null, editingTutorial: null };
  const D = window.Dash;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const subtitles = {
    overview: 'Platform overview at a glance',
    courses: 'Create, edit and manage your courses',
    tutorials: 'Create, edit and manage your tutorials',
    users: 'Manage users, roles and access',
    files: 'Upload files from your computer and manage them',
  };

  const TABS = ['overview', 'courses', 'tutorials', 'users', 'files'];

  function switchTab(name) {
    if (!TABS.includes(name)) name = 'overview';
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
    $$('.dash-menu button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $('#dash-title').textContent = name === 'overview' ? 'Dashboard' : name.charAt(0).toUpperCase() + name.slice(1);
    $('#dash-sub').textContent = subtitles[name] || '';
    try { history.replaceState(null, '', '#' + name); } catch (_) { /* ignore */ }
  }

  /* Sidebar navigation — these buttons previously had no click handlers,
     so clicking Overview/Courses/Tutorials/Users/Files did nothing. */
  $$('.dash-menu button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  async function refreshStats() {
    try {
      const { stats, recentUsers } = await api('/stats');
      $('#stat-cards').innerHTML = [
        ['👥', stats.users, 'Total users'],
        ['📚', stats.courses, 'Courses'],
        ['🎬', stats.tutorials, 'Tutorials'],
        ['🎓', stats.enrollments, 'Enrollments'],
      ].map(([ico, val, label]) =>
        `<div class="glass stat-card"><div class="stat-ico">${ico}</div><div><b>${val}</b><span>${label}</span></div></div>`).join('');
      $('#recent-users').innerHTML = recentUsers.map((u) =>
        `<li class="recent-user"><span class="u-avatar">${escapeHTML((u.name || '?').charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(u.name)}</strong><div class="cell-sub">${escapeHTML(u.email)}</div></div><span class="badge role-${u.role}" style="margin-left:auto">${u.role}</span></li>`).join('')
        || '<li class="muted" style="padding:8px 6px">No users yet</li>';
    } catch (e) { toast(e.message, 'error'); }
  }

  D.switchTab = switchTab;
  D.refreshStats = refreshStats;
});

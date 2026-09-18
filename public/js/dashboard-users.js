/* Runkaro — Admin dashboard: users tab, shared wiring, boot */
document.addEventListener('DOMContentLoaded', () => {
  const D = window.Dash;
  if (!D) return;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ---------- users ---------- */
  async function loadUsers() {
    try {
      D.users = (await api('/users')).users;
      renderUsers($('#user-search').value);
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderUsers(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = D.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    $('#users-tbody').innerHTML = list.map((u) => {
      const self = u.id === Auth.user.id;
      return `<tr>
        <td><div class="u-cell"><span class="u-avatar">${escapeHTML((u.name || '?').charAt(0).toUpperCase())}</span>
          <div><strong>${escapeHTML(u.name)}</strong>${self ? ' <span class="badge badge-cat">you</span>' : ''}<div class="cell-sub">${escapeHTML(u.email)} · ${u.enrollments} enrolled</div></div></div></td>
        <td><span class="badge role-${u.role}">${u.role}</span></td>
        <td><span class="badge status-${u.status}">${u.status}</span></td>
        <td class="cell-sub">${formatDate(u.createdAt)}</td>
        <td><div class="actions">
          <select class="role-select" data-role-id="${u.id}" ${self ? 'disabled title="You cannot change your own role"' : ''}>
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn btn-sm" data-status-id="${u.id}" ${self ? 'disabled' : ''}>${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
          <button class="icon-btn danger" data-del-user="${u.id}" ${self ? 'disabled' : ''} title="Delete">🗑️</button>
        </div></td></tr>`;
    }).join('') || `<tr><td colspan="5"><div class="empty" style="margin:14px">No users found.</div></td></tr>`;
  }

  $('#user-search').addEventListener('input', (e) => renderUsers(e.target.value));
  $('#users-tbody').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-role-id]');
    if (!sel) return;
    try {
      await api('/users/' + sel.dataset.roleId, { method: 'PATCH', body: { role: sel.value } });
      toast('Role updated', 'success');
      loadUsers(); D.refreshStats();
    } catch (err) { toast(err.message, 'error'); loadUsers(); }
  });
  $('#users-tbody').addEventListener('click', async (e) => {
    const st = e.target.closest('[data-status-id]');
    const del = e.target.closest('[data-del-user]');
    if (st) {
      const u = D.users.find((x) => x.id === st.dataset.statusId);
      if (!u) return;
      const next = u.status === 'active' ? 'suspended' : 'active';
      try {
        await api('/users/' + u.id, { method: 'PATCH', body: { status: next } });
        toast(next === 'suspended' ? 'User suspended' : 'User activated', 'success');
        loadUsers();
      } catch (err) { toast(err.message, 'error'); }
    }
    if (del) {
      const u = D.users.find((x) => x.id === del.dataset.delUser);
      if (!u || !confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
      try {
        await api('/users/' + u.id, { method: 'DELETE' });
        toast('User deleted', 'success');
        loadUsers(); D.refreshStats();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  /* ---------- shared wiring ---------- */
  $('#logout-btn').addEventListener('click', () => { Auth.clear(); location.href = 'index.html'; });
  $$('.modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ov.classList.remove('open')));
  });
  $$('[data-qa]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.qa === 'course') { D.switchTab('courses'); D.openCourseModal(null); }
    else { D.switchTab('tutorials'); D.openTutorialModal(null); }
  }));

  /* ---------- boot ---------- */
  D.switchTab('overview');
  D.refreshStats();
  D.loadCourses();
  D.loadTutorials();
  loadUsers();
  D.loadUsers = loadUsers;
});

/* Runkaro — Admin dashboard: courses tab (CRUD + upload) */
document.addEventListener('DOMContentLoaded', () => {
  const D = window.Dash;
  if (!D) return;
  const $ = (s) => document.querySelector(s);

  async function loadCourses() {
    try {
      D.courses = (await api('/courses')).courses;
      renderCourses($('#course-search').value);
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderCourses(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = D.courses.filter((c) => !q || c.title.toLowerCase().includes(q));
    $('#courses-tbody').innerHTML = list.map((c) => `<tr>
      <td><div class="row-title">${c.thumbnail
        ? `<img class="row-thumb" src="${escapeHTML(c.thumbnail)}" alt="">`
        : `<div class="row-thumb-ph">${escapeHTML((c.title || '?').charAt(0).toUpperCase())}</div>`}
        <div><strong>${escapeHTML(c.title)}</strong><div class="cell-sub">${escapeHTML(c.category)} · ${c.enrolled} enrolled</div></div></div></td>
      <td>${levelBadge(c.level)}</td>
      <td><span class="price ${Number(c.price) > 0 ? '' : 'free'}">${priceLabel(c.price)}</span></td>
      <td class="cell-sub">${formatDate(c.createdAt)}</td>
      <td><div class="actions">
        <button class="icon-btn" data-edit="${c.id}" title="Edit">✏️</button>
        <button class="icon-btn danger" data-del="${c.id}" title="Delete">🗑️</button>
      </div></td></tr>`).join('')
      || `<tr><td colspan="5"><div class="empty" style="margin:14px">No courses yet — click “＋ Add course” to publish your first one.</div></td></tr>`;
  }

  function openCourseModal(course) {
    D.editingCourse = course || null;
    $('#course-modal-title').textContent = course ? 'Edit course' : 'Add new course';
    $('#c-title').value = course ? course.title : '';
    $('#c-category').value = course ? course.category : '';
    $('#c-level').value = course ? course.level : 'Beginner';
    $('#c-duration').value = course ? course.duration || '' : '';
    $('#c-price').value = course ? course.price : 0;
    $('#c-description').value = course ? course.description || '' : '';
    $('#c-thumbnail').value = '';
    $('#c-content').value = '';
    renderContentList();
    $('#course-modal').classList.add('open');
  }

  /** Preview chips for newly chosen content files + existing files with remove buttons. */
  function renderContentList() {
    const listEl = $('#c-content-list');
    const pending = Array.from($('#c-content').files || []);
    const existing = D.editingCourse ? (D.editingCourse.content || []) : [];
    listEl.innerHTML =
      existing.map((f) => `<div class="content-chip"><span title="${escapeHTML(f.originalName || f.name)}">📎 ${escapeHTML(f.originalName || f.name)}</span><button type="button" class="btn btn-mini" data-remove-existing="${escapeHTML(f.name)}" title="Delete from course">✕</button></div>`).join('') +
      pending.map((f, i) => `<div class="content-chip new"><span title="${escapeHTML(f.name)}">🆕 ${escapeHTML(f.name)} (${(f.size / 1024 / 1024).toFixed(1)} MB)</span><button type="button" class="btn btn-mini" data-remove-pending="${i}">✕</button></div>`).join('');
  }

  async function submitCourse(e) {
    e.preventDefault();
    const btn = $('#c-save');
    const fd = new FormData();
    fd.append('title', $('#c-title').value);
    fd.append('category', $('#c-category').value || 'General');
    fd.append('level', $('#c-level').value);
    fd.append('duration', $('#c-duration').value);
    fd.append('price', $('#c-price').value || '0');
    fd.append('description', $('#c-description').value);
    const file = $('#c-thumbnail').files[0];
    if (file) fd.append('thumbnail', file);
    for (const f of $('#c-content').files) fd.append('content', f);
    btn.disabled = true;
    try {
      if (D.editingCourse) await api('/courses/' + D.editingCourse.id, { method: 'PUT', formData: fd });
      else await api('/courses', { method: 'POST', formData: fd });
      toast(D.editingCourse ? 'Course updated' : 'Course published', 'success');
      $('#course-modal').classList.remove('open');
      loadCourses(); D.refreshStats();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  }

  async function deleteCourse(id) {
    const c = D.courses.find((x) => x.id === id);
    if (!c || !confirm(`Delete “${c.title}”? Enrolled students will lose access.`)) return;
    try {
      await api('/courses/' + id, { method: 'DELETE' });
      toast('Course deleted', 'success');
      loadCourses(); D.refreshStats();
    } catch (e) { toast(e.message, 'error'); }
  }

  $('#add-course').addEventListener('click', () => openCourseModal(null));
  $('#c-content').addEventListener('change', renderContentList);
  $('#c-content-list').addEventListener('click', async (e) => {
    const pending = e.target.closest('[data-remove-pending]');
    if (pending) {
      const dt = new DataTransfer();
      Array.from($('#c-content').files).forEach((f, i) => { if (i !== Number(pending.dataset.removePending)) dt.items.add(f); });
      $('#c-content').files = dt.files;
      renderContentList();
      return;
    }
    const existing = e.target.closest('[data-remove-existing]');
    if (existing && confirm('Delete this content file from the course? The file is removed permanently.')) {
      try {
        await api('/courses/' + D.editingCourse.id + '/content/' + encodeURIComponent(existing.dataset.removeExisting), { method: 'DELETE' });
        toast('Content file removed', 'success');
        const fresh = (await api('/courses/' + D.editingCourse.id)).course;
        D.editingCourse = fresh;
        D.courses = D.courses.map((c) => (c.id === fresh.id ? fresh : c));
        renderContentList();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
  $('#course-search').addEventListener('input', (e) => renderCourses(e.target.value));
  $('#courses-tbody').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) { const c = D.courses.find((x) => x.id === edit.dataset.edit); if (c) openCourseModal(c); }
    if (del) deleteCourse(del.dataset.del);
  });
  $('#course-form').addEventListener('submit', submitCourse);

  D.loadCourses = loadCourses;
  D.openCourseModal = openCourseModal;
});

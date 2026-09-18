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
    $('#course-modal').classList.add('open');
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

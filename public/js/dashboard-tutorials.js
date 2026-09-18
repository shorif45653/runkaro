/* Runkaro — Admin dashboard: tutorials tab (YouTube link or video upload) */
document.addEventListener('DOMContentLoaded', () => {
  const D = window.Dash;
  if (!D) return;
  const $ = (s) => document.querySelector(s);

  async function loadTutorials() {
    try {
      D.tutorials = (await api('/tutorials')).tutorials;
      renderTutorials($('#tutorial-search').value);
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderTutorials(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = D.tutorials.filter((t) => !q || t.title.toLowerCase().includes(q));
    $('#tutorials-tbody').innerHTML = list.map((t) => `<tr>
      <td><div class="row-title">${t.thumbnail
        ? `<img class="row-thumb" src="${escapeHTML(t.thumbnail)}" alt="">`
        : `<div class="row-thumb-ph">▶</div>`}
        <div><strong>${escapeHTML(t.title)}</strong><div class="cell-sub">${escapeHTML(t.category)}</div></div></div></td>
      <td>${levelBadge(t.level)}</td>
      <td class="cell-sub">${t.videoFile ? '📁 Uploaded' : '▶ YouTube'}</td>
      <td class="cell-sub">${formatDate(t.createdAt)}</td>
      <td><div class="actions">
        <button class="icon-btn" data-edit="${t.id}" title="Edit">✏️</button>
        <button class="icon-btn danger" data-del="${t.id}" title="Delete">🗑️</button>
      </div></td></tr>`).join('')
      || `<tr><td colspan="5"><div class="empty" style="margin:14px">No tutorials yet — click “＋ Add tutorial”.</div></td></tr>`;
  }

  function syncVideoSource() {
    const src = document.querySelector('input[name="t-source"]:checked').value;
    $('#t-youtube-field').style.display = src === 'youtube' ? '' : 'none';
    $('#t-upload-field').style.display = src === 'upload' ? '' : 'none';
  }

  function openTutorialModal(t) {
    D.editingTutorial = t || null;
    $('#tutorial-modal-title').textContent = t ? 'Edit tutorial' : 'Add new tutorial';
    $('#t-title').value = t ? t.title : '';
    $('#t-category').value = t ? t.category : '';
    $('#t-level').value = t ? t.level : 'Beginner';
    $('#t-duration').value = t ? t.duration || '' : '';
    $('#t-description').value = t ? t.description || '' : '';
    $('#t-thumbnail').value = '';
    $('#t-video').value = '';
    const useUpload = !!(t && t.videoFile);
    document.querySelector(`input[name="t-source"][value="${useUpload ? 'upload' : 'youtube'}"]`).checked = true;
    $('#t-url').value = useUpload ? '' : (t ? t.videoUrl || '' : '');
    syncVideoSource();
    $('#tutorial-modal').classList.add('open');
  }

  async function submitTutorial(e) {
    e.preventDefault();
    const src = document.querySelector('input[name="t-source"]:checked').value;
    const fd = new FormData();
    fd.append('title', $('#t-title').value);
    fd.append('category', $('#t-category').value || 'General');
    fd.append('level', $('#t-level').value);
    fd.append('duration', $('#t-duration').value);
    fd.append('description', $('#t-description').value);
    if (src === 'youtube') {
      const url = $('#t-url').value.trim();
      if (!D.editingTutorial && !url) { toast('Please enter a YouTube link', 'error'); return; }
      if (url) fd.append('videoUrl', url);
    } else {
      const file = $('#t-video').files[0];
      if (!D.editingTutorial && !file) { toast('Please choose a video file', 'error'); return; }
      if (file) fd.append('video', file);
    }
    const thumb = $('#t-thumbnail').files[0];
    if (thumb) fd.append('thumbnail', thumb);
    const btn = $('#t-save');
    btn.disabled = true;
    try {
      if (D.editingTutorial) await api('/tutorials/' + D.editingTutorial.id, { method: 'PUT', formData: fd });
      else await api('/tutorials', { method: 'POST', formData: fd });
      toast(D.editingTutorial ? 'Tutorial updated' : 'Tutorial published', 'success');
      $('#tutorial-modal').classList.remove('open');
      loadTutorials(); D.refreshStats();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  }

  async function deleteTutorial(id) {
    const t = D.tutorials.find((x) => x.id === id);
    if (!t || !confirm(`Delete “${t.title}”?`)) return;
    try {
      await api('/tutorials/' + id, { method: 'DELETE' });
      toast('Tutorial deleted', 'success');
      loadTutorials(); D.refreshStats();
    } catch (e) { toast(e.message, 'error'); }
  }

  $('#add-tutorial').addEventListener('click', () => openTutorialModal(null));
  $('#tutorial-search').addEventListener('input', (e) => renderTutorials(e.target.value));
  $('#tutorials-tbody').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) { const t = D.tutorials.find((x) => x.id === edit.dataset.edit); if (t) openTutorialModal(t); }
    if (del) deleteTutorial(del.dataset.del);
  });
  $('#tutorial-form').addEventListener('submit', submitTutorial);
  document.querySelectorAll('input[name="t-source"]').forEach((r) => r.addEventListener('change', syncVideoSource));

  D.loadTutorials = loadTutorials;
  D.openTutorialModal = openTutorialModal;
});

/* Runkaro — Admin dashboard: Files tab (upload, browse, copy URL, delete) */
document.addEventListener('DOMContentLoaded', () => {
  const D = window.Dash;
  if (!D) return;
  const $ = (s) => document.querySelector(s);

  D.files = D.files || [];
  const ICONS = { image: '🖼️', video: '🎬', audio: '🎵', pdf: '📕', archive: '🗜️', doc: '📄', slides: '📊', sheet: '📈', other: '📦' };

  async function loadFiles() {
    try {
      D.files = (await api('/files')).files;
      renderFiles($('#file-search').value);
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderFiles(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = D.files.filter((f) => !q || f.name.toLowerCase().includes(q));
    $('#files-count').textContent = `${list.length} file${list.length === 1 ? '' : 's'} · each file has a public URL you can copy`;
    $('#files-grid').innerHTML = list.map((f) => {
      const thumb = f.kind === 'image'
        ? `<img src="${escapeHTML(f.url)}" alt="" loading="lazy">`
        : `<div class="file-ico">${ICONS[f.kind] || ICONS.other}</div>`;
      return `<div class="glass glass-hover file-card">
        <div class="file-thumb">${thumb}</div>
        <div class="file-body">
          <strong title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</strong>
          <div class="cell-sub">${escapeHTML(f.sizeLabel)} · ${formatDate(f.modified)}</div>
          <div class="actions" style="justify-content:flex-start;margin-top:8px">
            <button class="btn btn-sm" data-copy="${escapeHTML(f.url)}" title="Copy public URL">🔗 Copy URL</button>
            <a class="icon-btn" href="${escapeHTML(f.url)}" target="_blank" rel="noopener" title="Open">↗</a>
            <button class="icon-btn danger" data-delfile="${escapeHTML(f.name)}" title="Delete">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('')
      || `<div class="empty" style="grid-column:1/-1"><div class="big">📁</div><p>No files yet — click “⬆ Upload files” (or drag &amp; drop files here) to upload from your computer.</p></div>`;
  }

  async function uploadFiles(fileList) {
    const all = Array.from(fileList || []);
    if (!all.length) return;
    const fd = new FormData();
    for (const f of all) fd.append('files', f);
    const btn = $('#upload-files-btn');
    btn.disabled = true;
    toast(`Uploading ${all.length} file(s)…`);
    try {
      const out = await api('/files', { method: 'POST', formData: fd });
      toast(out.message, 'success');
      loadFiles();
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; $('#file-input').value = ''; }
  }

  $('#upload-files-btn').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', (e) => uploadFiles(e.target.files));

  // Drag & drop onto the grid
  const grid = $('#files-grid');
  grid.addEventListener('dragover', (e) => e.preventDefault());
  grid.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  $('#file-search').addEventListener('input', (e) => renderFiles(e.target.value));

  $('#files-grid').addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    const del = e.target.closest('[data-delfile]');
    if (copy) {
      const full = new URL(copy.dataset.copy, location.origin).href;
      try {
        await navigator.clipboard.writeText(full);
        toast('URL copied: ' + full, 'success');
      } catch {
        prompt('Copy this URL:', full);
      }
    }
    if (del) {
      if (!confirm('Delete this file? Any links using it will break.')) return;
      try {
        await api('/files/' + encodeURIComponent(del.dataset.delfile), { method: 'DELETE' });
        toast('File deleted', 'success');
        loadFiles();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  D.loadFiles = loadFiles;
  loadFiles();
});

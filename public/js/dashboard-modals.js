/* Runkaro — injects the admin modals before dashboard logic runs */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
  <div class="modal-overlay" id="course-modal">
    <form class="glass modal" id="course-form">
      <div class="modal-head"><h2 id="course-modal-title">Add new course</h2><button type="button" class="icon-btn" data-close title="Close">✕</button></div>
      <div class="field"><label>Course title *</label><input id="c-title" type="text" required placeholder="e.g. Modern JavaScript from Zero"></div>
      <div class="form-row">
        <div class="field"><label>Category</label><input id="c-category" type="text" placeholder="e.g. Web Development"></div>
        <div class="field"><label>Level</label><select id="c-level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Duration</label><input id="c-duration" type="text" placeholder="e.g. 6h 20m"></div>
        <div class="field"><label>Price (USD, 0 = free)</label><input id="c-price" type="number" min="0" step="1" value="0"></div>
      </div>
      <div class="field"><label>Description</label><textarea id="c-description" placeholder="What will students learn?"></textarea></div>
      <div class="field"><label>Thumbnail image (optional)</label><input id="c-thumbnail" type="file" accept="image/*"></div>
      <div class="field">
        <label>📁 Course content files (lessons, PDFs, videos — optional, up to 20)</label>
        <input id="c-content" type="file" multiple>
        <div id="c-content-list" class="content-list"></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary" id="c-save">Save course</button></div>
    </form>
  </div>
  <div class="modal-overlay" id="tutorial-modal">
    <form class="glass modal" id="tutorial-form">
      <div class="modal-head"><h2 id="tutorial-modal-title">Add new tutorial</h2><button type="button" class="icon-btn" data-close title="Close">✕</button></div>
      <div class="field"><label>Tutorial title *</label><input id="t-title" type="text" required placeholder="e.g. Build a REST API in 20 minutes"></div>
      <div class="form-row">
        <div class="field"><label>Category</label><input id="t-category" type="text" placeholder="e.g. Web Development"></div>
        <div class="field"><label>Level</label><select id="t-level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Duration</label><input id="t-duration" type="text" placeholder="e.g. 12m"></div>
        <div class="field"><label>Thumbnail image (optional)</label><input id="t-thumbnail" type="file" accept="image/*"></div>
      </div>
      <div class="field"><label>Description</label><textarea id="t-description" placeholder="What does this tutorial cover?"></textarea></div>
      <div class="field">
        <label>Video source *</label>
        <div class="radio-row">
          <label><input type="radio" name="t-source" value="youtube" checked> ▶ YouTube link</label>
          <label><input type="radio" name="t-source" value="upload"> 📁 Upload file</label>
        </div>
      </div>
      <div class="field" id="t-youtube-field"><label>YouTube URL</label><input id="t-url" type="url" placeholder="https://www.youtube.com/watch?v=…"></div>
      <div class="field" id="t-upload-field" style="display:none"><label>Video file (mp4 / webm / ogg, up to 150 MB)</label><input id="t-video" type="file" accept="video/mp4,video/webm,video/ogg"></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary" id="t-save">Save tutorial</button></div>
    </form>
  </div>`;
});

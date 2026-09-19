/* Runkaro — shared navigation (auth-aware, liquid glass bar) */

function renderNav(active) {
  const header = document.getElementById('site-nav');
  if (!header) return;
  const user = Auth.user;
  const link = (href, key, label) =>
    `<a href="${href}" class="nav-link ${active === key ? 'active' : ''}">${label}</a>`;

  let right;
  if (user) {
    const initial = escapeHTML((user.name || 'U').charAt(0).toUpperCase());
    right = `<div class="nav-user">
      <button class="avatar-btn" id="avatar-btn" aria-label="Account menu"><span class="avatar">${initial}</span></button>
      <div class="user-menu glass" id="user-menu">
        <div class="user-menu-head">
          <strong>${escapeHTML(user.name)}</strong>
          <span class="muted" style="font-size:.8rem">${escapeHTML(user.email)}</span>
        </div>
        ${user.role === 'admin' ? '<a href="dashboard.html">🛠️ Admin dashboard</a>' : ''}
        <a href="my-learning.html">🎓 My Learning</a>
        <a href="courses.html">📚 Browse courses</a>
        <button id="nav-logout">↩️ Sign out</button>
      </div>
    </div>`;
  } else {
    right = `<div class="nav-auth">
      <a href="login.html" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="register.html" class="btn btn-primary btn-sm">Get started</a>
    </div>`;
  }

  header.innerHTML = `<div class="nav-inner">
    <a class="brand" href="index.html"><img class="brand-orb" src="img/logo.png" alt="Runkaro logo" width="38" height="38"><span class="brand-name">Run<span class="grad-text">karo</span></span></a>
    <nav class="nav-links">
      ${link('index.html', 'home', 'Home')}
      ${link('courses.html', 'courses', 'Courses')}
      ${link('tutorials.html', 'tutorials', 'Tutorials')}
      ${user ? link('my-learning.html', 'learning', 'My Learning') : ''}
    </nav>
    <div class="nav-right">${right}</div>
    <button class="nav-burger" id="nav-burger" aria-label="Menu">☰</button>
  </div>`;

  const burger = document.getElementById('nav-burger');
  if (burger) burger.addEventListener('click', () => document.body.classList.toggle('nav-open'));

  const avatarBtn = document.getElementById('avatar-btn');
  const userMenu = document.getElementById('user-menu');
  if (avatarBtn && userMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && e.target !== avatarBtn) userMenu.classList.remove('open');
    });
  }
  const logout = document.getElementById('nav-logout');
  if (logout) {
    logout.addEventListener('click', () => {
      Auth.clear();
      location.href = 'index.html';
    });
  }
}

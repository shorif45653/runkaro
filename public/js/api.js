/* ============================================================
   Runkaro — frontend API client + auth helpers
   ============================================================ */

const Auth = {
  get token() { return localStorage.getItem('runkaro_token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('runkaro_user') || 'null'); }
    catch { return null; }
  },
  save(token, user) {
    localStorage.setItem('runkaro_token', token);
    localStorage.setItem('runkaro_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('runkaro_token');
    localStorage.removeItem('runkaro_user');
  },
  isLoggedIn() { return !!this.token; },
  isAdmin() { return !!(this.user && this.user.role === 'admin'); },
};

/**
 * Minimal fetch wrapper around the Runkaro API (same origin, /api prefix).
 * Usage:  api('/courses')  ·  api('/auth/login', { method:'POST', body:{...} })
 *         api('/courses',  { method:'POST', formData: new FormData() })
 */
async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (Auth.token) headers['Authorization'] = 'Bearer ' + Auth.token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

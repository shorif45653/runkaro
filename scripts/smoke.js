/**
 * Runkaro — end-to-end API smoke test.
 *
 * Start the server first, then:  node scripts/smoke.js  (BASE env var optional)
 * Exercises login, files upload/list/delete, course CRUD with real file
 * uploads (thumbnail + content), enrollment and cloud-status reporting.
 * Exits 0 on success, 1 on any failure.
 */
const BASE = (process.env.BASE || 'http://localhost:4123').replace(/\/$/, '');

const results = [];
function check(name, ok, extra = '') {
  results.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function j(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function main() {
  // Health
  const health = await j('GET', '/api/health');
  check('health endpoint', health.status === 200 && health.data.ok === true,
    `cloud.db=${health.data.cloud && health.data.cloud.db} cloud.files=${health.data.cloud && health.data.cloud.files}`);

  // Public browse
  const list = await j('GET', '/api/courses');
  check('public course list', list.status === 200 && Array.isArray(list.data.courses), `${list.data.courses.length} courses`);

  // Admin login
  const login = await j('POST', '/api/auth/login', {
    body: { email: process.env.ADMIN_EMAIL || 'admin@runkaro.com', password: process.env.ADMIN_PASSWORD || 'Admin@123' },
  });
  check('admin login', login.status === 200 && login.data.token, login.data.user && login.data.user.email);
  const token = login.data.token;
  if (!token) process.exit(1);

  // Files manager: upload → list → delete
  const form = new FormData();
  form.append('files', new Blob([Buffer.from('smoke-test-content-v1')], { type: 'text/plain' }), 'smoke-lesson-1.txt');
  const upl = await j('POST', '/api/files', { token, form });
  check('files upload', upl.status === 201 && upl.data.files.length === 1, upl.data.files[0] && upl.data.files[0].name);
  const smokeFile = upl.data.files[0];

  const filesList = await j('GET', '/api/files', { token });
  check('files list', filesList.status === 200 && filesList.data.files.some((f) => f.name === smokeFile.name));

  // Fetch the uploaded file over /uploads/<name>
  const fileRes = await fetch(BASE + smokeFile.url);
  const fileText = await fileRes.text();
  check('uploaded file served', fileRes.status === 200 && fileText === 'smoke-test-content-v1');

  // Course: create with thumbnail + content file
  const cform = new FormData();
  cform.append('title', 'Smoke Test Course');
  cform.append('description', 'Created by scripts/smoke.js');
  cform.append('category', 'Testing');
  cform.append('level', 'Beginner');
  cform.append('duration', '1h');
  cform.append('price', '0');
  cform.append('thumbnail', new Blob([PNG_1PX], { type: 'image/png' }), 'thumb.png');
  cform.append('content', new Blob([Buffer.from('course-material')], { type: 'text/plain' }), 'material.txt');
  const created = await j('POST', '/api/courses', { token, form: cform });
  check('course create (thumbnail + content)', created.status === 201 && created.data.course,
    created.data.course && `${created.data.course.title} · thumb=${!!created.data.course.thumbnail} · content=${created.data.course.content.length}`);
  const course = created.data.course;

  // Single course fetch
  const one = await j('GET', `/api/courses/${course.id}`);
  check('course fetch', one.status === 200 && one.data.course.id === course.id);

  // Student: register/login + enroll + my courses
  const stuEmail = process.env.STUDENT_EMAIL || 'student@runkaro.com';
  const stuPass = process.env.STUDENT_PASSWORD || 'Student@123';
  let stu = await j('POST', '/api/auth/login', { body: { email: stuEmail, password: stuPass } });
  if (stu.status !== 200) {
    stu = await j('POST', '/api/auth/register', { body: { name: 'Smoke Student', email: stuEmail, password: stuPass } });
  }
  check('student login', stu.status === 200 && stu.data.token);
  const enroll = await j('POST', `/api/courses/${course.id}/enroll`, { token: stu.data.token });
  check('enroll', enroll.status === 201 || enroll.status === 200);
  const mine = await j('GET', '/api/courses/mine', { token: stu.data.token });
  check('my learning', mine.status === 200 && mine.data.courses.some((c) => c.id === course.id));

  // Course: remove one content file, then delete the course
  const rmFile = await j('DELETE', `/api/courses/${course.id}/content/${encodeURIComponent(course.content[0].name)}`, { token });
  check('remove course content file', rmFile.status === 200 && rmFile.data.course.content.length === 0);

  const del = await j('DELETE', `/api/courses/${course.id}`, { token });
  check('course delete', del.status === 200);
  const gone = await j('GET', `/api/courses/${course.id}`);
  check('course really gone', gone.status === 404);

  // Files manager: delete the smoke file
  const rmUpl = await j('DELETE', `/api/files/${encodeURIComponent(smokeFile.name)}`, { token });
  check('files delete', rmUpl.status === 200);

  // Stats
  const stats = await j('GET', '/api/stats', { token });
  check('admin stats', stats.status === 200 && stats.data.stats);

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

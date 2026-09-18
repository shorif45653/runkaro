/** Auth routes: anyone can register / sign in. */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const dbSvc = require('../db');
const { sign, authenticate, publicUser } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (!EMAIL_RE.test(String(email))) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const db = dbSvc.get();
  if (db.users.find((u) => u.email === String(email).toLowerCase())) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }
  const user = {
    id: dbSvc.nextId('user'),
    name: String(name).trim(),
    email: String(email).toLowerCase(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  dbSvc.save();
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const db = dbSvc.get();
  const user = db.users.find((u) => u.email === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Your account has been suspended. Contact an administrator.' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;

/** JWT + role middleware for Runkaro. */
const jwt = require('jsonwebtoken');
const dbSvc = require('../db');

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, dbSvc.get().meta.jwtSecret, {
    expiresIn: '7d',
  });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, dbSvc.get().meta.jwtSecret);
    const user = dbSvc.get().users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ message: 'Account not found' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Your account has been suspended. Contact an administrator.' });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  return next();
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

module.exports = { sign, authenticate, requireAdmin, publicUser };

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function protect(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  if (typeof process.env.JWT_SECRET !== 'string' || !process.env.JWT_SECRET.trim()) {
    return res.status(503).json({ message: 'Authentication is not configured on this server.' });
  }
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ message: 'Your session is invalid or expired. Please sign in again.' }); }
  try {
    if (!payload.id) return res.status(401).json({ message: 'Your session is invalid or expired. Please sign in again.' });
    req.user = await User.findById(payload.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'Your account could not be found.' });
    return next();
  } catch (error) { return next(error); }
}
export function adminOnly(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' }); next(); }

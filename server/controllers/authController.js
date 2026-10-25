import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
const makeToken = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const isJwtConfigured = () => typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.trim().length > 0;
export async function register(req, res, next) { try {
  const { name, email, password, phone, location, preferredLanguage, crops } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) return res.status(400).json({ message: 'Name, valid email, and password are required.' });
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  if (!isJwtConfigured()) return res.status(503).json({ message: 'Authentication is not configured on this server.' });
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12), phone, location, preferredLanguage, crops });
  res.status(201).json({ token: makeToken(user), user: publicUser(user) });
} catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); next(e); } }
export async function login(req, res, next) { try {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !isValidEmail(email) || typeof password !== 'string' || !password) return res.status(400).json({ message: 'A valid email and password are required.' });
  if (!isJwtConfigured()) return res.status(503).json({ message: 'Authentication is not configured on this server.' });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  const passwordHashAvailable = Boolean(user?.password);
  const passwordComparisonSucceeded = user && passwordHashAvailable
    ? await bcrypt.compare(password, user.password)
    : false;
  if (process.env.AUTH_LOGIN_DIAGNOSTICS === 'true') {
    console.info('[auth-login-diagnostic]', JSON.stringify({
      userFound: Boolean(user),
      passwordHashAvailable,
      passwordComparisonSucceeded,
    }));
  }
  if (!user || !passwordComparisonSucceeded) return res.status(401).json({ message: 'Email or password is incorrect.' });
  res.json({ token: makeToken(user), user: publicUser(user) });
} catch (e) { next(e); } }
export function me(req, res) { res.json({ user: publicUser(req.user) }); }
export async function updateMe(req, res, next) { try { const allowed = ['name', 'phone', 'location', 'preferredLanguage', 'crops']; const updates = req.body && typeof req.body === 'object' ? req.body : {}; for (const key of allowed) if (updates[key] !== undefined) req.user[key] = updates[key]; await req.user.save(); res.json({ user: publicUser(req.user) }); } catch (e) { next(e); } }
function publicUser(user) { return { id: user._id, name: user.name, email: user.email, phone: user.phone, location: user.location, preferredLanguage: user.preferredLanguage, crops: user.crops, role: user.role }; }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

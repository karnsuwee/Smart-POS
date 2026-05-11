import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { isDbReady } from '../db.js';

export function signToken(user) {
  return jwt.sign(
    { id: String(user._id || user.id), email: user.email, storeName: user.storeName },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    if (isDbReady() && !mongoose.isValidObjectId(req.user.id)) {
      return res.status(401).json({ message: 'Invalid session for MongoDB mode. Please log in again.' });
    }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

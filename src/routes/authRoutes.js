import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { isDbReady } from '../db.js';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { memory } from '../store/memoryStore.js';
import { makeId } from '../utils/ids.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { seedShop } from '../services/seedService.js';

export const authRoutes = Router();
const googleClient = new OAuth2Client(config.googleClientId || undefined);

authRoutes.get('/providers', (req, res) => {
  res.json({
    google: {
      enabled: Boolean(config.googleClientId),
      clientId: config.googleClientId || ''
    }
  });
});

authRoutes.post('/register', async (req, res) => {
  const { email, password, storeName } = req.body;
  if (!email || !password || !storeName) return res.status(400).json({ message: 'กรอกข้อมูลให้ครบ' });
  if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    let user;
    if (isDbReady()) {
      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
      user = await User.create({
        email: normalizedEmail,
        passwordHash,
        storeName,
        settings: { vatMode: 'exclusive' }
      });
      await seedShop(user._id);
    } else {
      if (memory.users.some(item => item.email === normalizedEmail)) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
      user = {
        id: makeId(),
        email: normalizedEmail,
        passwordHash,
        storeName,
        settings: { vatMode: 'exclusive' }
      };
      memory.users.push(user);
      await seedShop(user.id);
    }

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'สมัครสมาชิกไม่สำเร็จ', detail: error.message });
  }
});

authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const user = isDbReady()
    ? await User.findOne({ email: normalizedEmail })
    : memory.users.find(item => item.email === normalizedEmail);

  if (!user) {
    return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ message: 'บัญชีนี้ใช้ Google Login กรุณาเข้าสู่ระบบด้วย Google' });
  }

  if (!(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  await seedShop(user._id || user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRoutes.post('/google', async (req, res) => {
  if (!config.googleClientId) {
    return res.status(503).json({ message: 'Google login ยังไม่ได้ตั้งค่า' });
  }

  const credential = String(req.body.credential || '');
  if (!credential) return res.status(400).json({ message: 'Missing Google credential' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId
    });
    const payload = ticket.getPayload();
    const googleId = String(payload?.sub || '');
    const email = String(payload?.email || '').toLowerCase().trim();
    const name = String(payload?.name || '').trim();

    if (!googleId || !email) {
      return res.status(401).json({ message: 'Google token ไม่ถูกต้อง' });
    }

    let user;
    if (isDbReady()) {
      user = await User.findOne({ $or: [{ googleId }, { email }] });
      if (!user) {
        user = await User.create({
          googleId,
          email,
          passwordHash: '',
          storeName: buildGoogleStoreName(name, email),
          settings: { vatMode: 'exclusive' }
        });
        await seedShop(user._id);
      } else if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      user = memory.users.find(item => item.googleId === googleId || item.email === email);
      if (!user) {
        user = {
          id: makeId(),
          googleId,
          email,
          passwordHash: '',
          storeName: buildGoogleStoreName(name, email),
          settings: { vatMode: 'exclusive' }
        };
        memory.users.push(user);
        await seedShop(user.id);
      } else if (!user.googleId) {
        user.googleId = googleId;
      }
    }

    await seedShop(user._id || user.id);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(401).json({ message: 'Google login ไม่สำเร็จ', detail: error.message });
  }
});

authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRoutes.patch('/me/settings', requireAuth, async (req, res) => {
  const vatMode = ['none', 'inclusive', 'exclusive'].includes(req.body.vatMode)
    ? req.body.vatMode
    : 'exclusive';

  let user;
  if (isDbReady()) {
    user = await User.findByIdAndUpdate(
      req.user.id,
      { settings: { vatMode } },
      { new: true }
    );
  } else {
    user = memory.users.find(item => item.id === req.user.id);
    if (user) user.settings = { vatMode };
  }

  if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
  res.json({ user: publicUser(user) });
});

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    email: user.email,
    storeName: user.storeName,
    settings: {
      vatMode: user.settings?.vatMode || 'exclusive'
    }
  };
}

function buildGoogleStoreName(name, email) {
  const displayName = name || email.split('@')[0] || 'เจ้าของร้าน';
  return `ร้านของ ${displayName}`;
}

import { Router } from 'express';
import { isDbReady } from '../db.js';
import { MenuItem } from '../models/MenuItem.js';
import { requireAuth } from '../middleware/auth.js';
import { memory, deleteMemory, updateMemory } from '../store/memoryStore.js';
import { makeId } from '../utils/ids.js';
import { normalizeDoc } from '../utils/normalizeDoc.js';

export const menuRoutes = Router();

menuRoutes.use(requireAuth);

menuRoutes.get('/', async (req, res) => {
  const items = isDbReady()
    ? await MenuItem.find({ ownerId: req.user.id }).sort({ isFavorite: -1, createdAt: -1 }).lean()
    : memory.menuItems.filter(item => item.ownerId === req.user.id);
  res.json(items.map(normalizeDoc));
});

menuRoutes.post('/', async (req, res) => {
  try {
    const { name, price, stockUnit } = req.body;
    if (!name || Number(price) <= 0) return res.status(400).json({ message: 'ชื่อเมนูและราคาต้องถูกต้อง' });
    const storedImage = await resolveMenuImage(req.body);

    const payload = {
      ownerId: req.user.id,
      name,
      price: Number(price),
      category: req.body.category || 'อื่นๆ',
      image: storedImage,
      stockUnit: stockUnit || 'ชุด',
      toppings: cleanToppings(req.body.toppings || []),
      isFavorite: false,
      isAvailable: true
    };

    const item = isDbReady() ? await MenuItem.create(payload) : { id: makeId(), ...payload };
    if (!isDbReady()) memory.menuItems.push(item);
    res.status(201).json(normalizeDoc(item));
  } catch (error) {
    res.status(400).json({ message: error.message || 'บันทึกรูปเมนูไม่สำเร็จ' });
  }
});

menuRoutes.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['name', 'category', 'image', 'stockUnit'].forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    if (req.body.image !== undefined || req.body.imageUpload) {
      updates.image = await resolveMenuImage(req.body);
    }
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.toppings !== undefined) updates.toppings = cleanToppings(req.body.toppings || []);
    if (req.body.isAvailable !== undefined) updates.isAvailable = Boolean(req.body.isAvailable);

    const item = isDbReady()
      ? await MenuItem.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, updates, { new: true })
      : updateMemory(memory.menuItems, req.params.id, req.user.id, updates);

    if (!item) return res.status(404).json({ message: 'ไม่พบเมนู' });
    res.json(normalizeDoc(item));
  } catch (error) {
    res.status(400).json({ message: error.message || 'อัปเดตรูปเมนูไม่สำเร็จ' });
  }
});

menuRoutes.patch('/:id/favorite', async (req, res) => {
  let item;
  if (isDbReady()) {
    item = await MenuItem.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (item) {
      item.isFavorite = !item.isFavorite;
      await item.save();
    }
  } else {
    item = memory.menuItems.find(entry => entry.id === req.params.id && entry.ownerId === req.user.id);
    if (item) item.isFavorite = !item.isFavorite;
  }

  if (!item) return res.status(404).json({ message: 'ไม่พบเมนู' });
  res.json(normalizeDoc(item));
});

menuRoutes.delete('/:id', async (req, res) => {
  const deleted = isDbReady()
    ? await MenuItem.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id })
    : deleteMemory(memory.menuItems, req.params.id, req.user.id);

  if (!deleted) return res.status(404).json({ message: 'ไม่พบเมนู' });
  res.json({ ok: true });
});

function cleanToppings(toppings) {
  return toppings.map(topping => ({
    name: String(topping.name || '').trim(),
    price: Number(topping.price || 0)
  })).filter(topping => topping.name && topping.price >= 0);
}

async function resolveMenuImage(body) {
  if (body.imageUpload?.dataUrl) {
    return normalizeImageDataUrl(body.imageUpload);
  }

  return String(body.image || '').trim();
}

function normalizeImageDataUrl(imageUpload) {
  const match = String(imageUpload.dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('รูปภาพที่อัปโหลดไม่ถูกต้อง');
  }

  const mimeType = match[1];
  const base64 = match[2];
  if (!isSupportedImageMime(mimeType)) {
    throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, GIF และ WebP');
  }

  return `data:${mimeType};base64,${base64}`;
}

function isSupportedImageMime(mimeType) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
}

import { Router } from 'express';
import mongoose from 'mongoose';
import { isDbReady } from '../db.js';
import { Table } from '../models/Table.js';
import { requireAuth } from '../middleware/auth.js';
import { seedShop } from '../services/seedService.js';
import { memory, deleteMemory } from '../store/memoryStore.js';
import { makeId } from '../utils/ids.js';
import { normalizeDoc } from '../utils/normalizeDoc.js';

export const tableRoutes = Router();

tableRoutes.use(requireAuth);

tableRoutes.get('/', wrapRoute(async (req, res) => {
  await seedShop(req.user.id);
  const tables = isDbReady()
    ? await Table.find({ ownerId: req.user.id }).lean()
    : memory.tables.filter(table => table.ownerId === req.user.id);

  res.json(tables.map(normalizeDoc).sort(compareTablesByNumber));
}));

tableRoutes.post('/', wrapRoute(async (req, res) => {
  const existingTables = isDbReady()
    ? await Table.find({ ownerId: req.user.id }).lean()
    : memory.tables.filter(table => table.ownerId === req.user.id);
  const nextNumber = existingTables.length + 1;
  const payload = {
    ownerId: req.user.id,
    name: req.body.name || `โต๊ะ ${nextNumber}`,
    status: 'available',
    currentItems: [],
    kitchenTickets: []
  };

  const table = isDbReady() ? await Table.create(payload) : { id: makeId(), ...payload };
  if (!isDbReady()) memory.tables.push(table);
  res.status(201).json(normalizeDoc(table));
}));

tableRoutes.delete('/:id', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const deleted = isDbReady()
    ? await Table.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id })
    : deleteMemory(memory.tables, req.params.id, req.user.id);

  if (!deleted) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });
  res.json({ ok: true });
}));

tableRoutes.put('/:id/items', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const currentItems = cleanItems(req.body.items || []);
  const updates = {
    currentItems,
    status: currentItems.length ? 'busy' : 'available'
  };

  const table = isDbReady()
    ? await Table.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, updates, { new: true })
    : updateTableItems(req.params.id, req.user.id, updates);

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });
  res.json(normalizeDoc(table));
}));

tableRoutes.post('/:id/tickets', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const ticketItems = cleanItems(req.body.items || []);
  if (!ticketItems.length) return res.status(400).json({ message: 'ยังไม่มีรายการในบิล' });

  const table = isDbReady()
    ? await Table.findOne({ _id: req.params.id, ownerId: req.user.id })
    : memory.tables.find(item => item.id === req.params.id && item.ownerId === req.user.id);
  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });

  const currentItems = mergeItems(table.currentItems || [], ticketItems);
  const kitchenTickets = [
    ...(table.kitchenTickets || []),
    {
      ticketId: makeId(),
      createdAt: new Date(),
      customerName: String(req.body.customerName || ''),
      note: String(req.body.note || ''),
      items: ticketItems
    }
  ];
  const updates = { currentItems, kitchenTickets, status: 'busy' };

  if (isDbReady()) {
    table.currentItems = currentItems;
    table.kitchenTickets = kitchenTickets;
    table.status = 'busy';
    await table.save();
    return res.status(201).json(normalizeDoc(table));
  }

  Object.assign(table, updates);
  res.status(201).json(normalizeDoc(table));
}));

tableRoutes.put('/:id/tickets', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const kitchenTickets = (req.body.kitchenTickets || []).map(ticket => ({
    ticketId: String(ticket.ticketId || makeId()),
    createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
    customerName: String(ticket.customerName || ''),
    note: String(ticket.note || ''),
    items: cleanItems(ticket.items || [])
  }));
  const updates = { kitchenTickets };

  const table = isDbReady()
    ? await Table.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, updates, { new: true })
    : updateTableItems(req.params.id, req.user.id, updates);

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });
  res.json(normalizeDoc(table));
}));

tableRoutes.delete('/:id/order', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const updates = {
    currentItems: [],
    status: 'available'
  };

  const table = isDbReady()
    ? await Table.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, updates, { new: true })
    : updateTableItems(req.params.id, req.user.id, updates);

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });
  res.json(normalizeDoc(table));
}));

tableRoutes.delete('/:id/tickets/:ticketId', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const table = isDbReady()
    ? await Table.findOne({ _id: req.params.id, ownerId: req.user.id })
    : memory.tables.find(item => item.id === req.params.id && item.ownerId === req.user.id);

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });

  const kitchenTickets = (table.kitchenTickets || [])
    .filter(ticket => ticket.ticketId !== req.params.ticketId);
  const updates = {
    kitchenTickets,
    status: (table.currentItems || []).length ? 'busy' : 'available'
  };

  if (isDbReady()) {
    table.kitchenTickets = kitchenTickets;
    table.status = updates.status;
    await table.save();
    return res.json(normalizeDoc(table));
  }

  Object.assign(table, updates);
  res.json(normalizeDoc(table));
}));

tableRoutes.delete('/:id/tickets', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const table = isDbReady()
    ? await Table.findOne({ _id: req.params.id, ownerId: req.user.id })
    : memory.tables.find(item => item.id === req.params.id && item.ownerId === req.user.id);

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });

  const updates = {
    kitchenTickets: [],
    status: (table.currentItems || []).length ? 'busy' : 'available'
  };

  if (isDbReady()) {
    table.kitchenTickets = [];
    table.status = updates.status;
    await table.save();
    return res.json(normalizeDoc(table));
  }

  Object.assign(table, updates);
  res.json(normalizeDoc(table));
}));

tableRoutes.patch('/:id/status', wrapRoute(async (req, res) => {
  if (!isValidTableId(req.params.id)) return res.status(400).json({ message: 'รหัสโต๊ะไม่ถูกต้อง' });

  const nextStatus = req.body.status === 'busy' ? 'busy' : 'available';
  const table = isDbReady()
    ? await Table.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, { status: nextStatus }, { new: true })
    : updateTableItems(req.params.id, req.user.id, { status: nextStatus });

  if (!table) return res.status(404).json({ message: 'ไม่พบโต๊ะ' });
  res.json(normalizeDoc(table));
}));

function cleanItems(items) {
  return items.map(item => ({
    lineKey: String(item.lineKey || item.id || item.menuItemId || ''),
    menuItemId: String(item.menuItemId || item.id || ''),
    name: String(item.name),
    qty: Number(item.qty),
    price: Number(item.price),
    toppings: cleanToppings(item.toppings || []),
    itemNote: String(item.itemNote || ''),
    addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
    kitchenStatus: ['waiting', 'cooking', 'done'].includes(item.kitchenStatus) ? item.kitchenStatus : 'waiting'
  })).filter(item => item.name && item.qty > 0 && item.price >= 0);
}

function cleanToppings(toppings) {
  return toppings.map(topping => ({
    name: String(topping.name || '').trim(),
    price: Number(topping.price || 0)
  })).filter(topping => topping.name && topping.price >= 0);
}

function updateTableItems(id, ownerId, updates) {
  const table = memory.tables.find(item => item.id === id && item.ownerId === ownerId);
  if (table) Object.assign(table, updates);
  return table;
}

function wrapRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function isValidTableId(id) {
  return !isDbReady() || mongoose.isValidObjectId(id);
}

function mergeItems(existingItems, newItems) {
  const byMenu = new Map();
  [...existingItems, ...newItems].forEach(item => {
    const key = String(item.lineKey || item.menuItemId || item.id || item.name);
    const current = byMenu.get(key);
    if (current) {
      current.qty += Number(item.qty || 0);
      current.kitchenStatus = item.kitchenStatus || current.kitchenStatus || 'waiting';
    } else {
      byMenu.set(key, { ...item, lineKey: key });
    }
  });
  return Array.from(byMenu.values());
}

function compareTablesByNumber(a, b) {
  const aNumber = extractTableNumber(a.name);
  const bNumber = extractTableNumber(b.name);

  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  if (aNumber !== null && bNumber === null) return -1;
  if (aNumber === null && bNumber !== null) return 1;

  return String(a.name || '').localeCompare(String(b.name || ''), 'th');
}

function extractTableNumber(name) {
  const match = String(name || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

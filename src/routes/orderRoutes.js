import { Router } from 'express';
import { isDbReady } from '../db.js';
import { Order } from '../models/Order.js';
import { Table } from '../models/Table.js';
import { requireAuth } from '../middleware/auth.js';
import { memory, updateMemory } from '../store/memoryStore.js';
import { makeId } from '../utils/ids.js';
import { normalizeDoc } from '../utils/normalizeDoc.js';

export const orderRoutes = Router();

orderRoutes.use(requireAuth);

orderRoutes.get('/kitchen', async (req, res) => {
  const orders = isDbReady()
    ? await Order.find({ ownerId: req.user.id, orderType: 'takeaway', kitchenOpen: true }).sort({ createdAt: 1 }).lean()
    : memory.orders
      .filter(order => order.ownerId === req.user.id && order.orderType === 'takeaway' && order.kitchenOpen);

  res.json(orders.map(normalizeDoc));
});

orderRoutes.post('/', async (req, res) => {
  const { orderType, tableId, tableName, customerName, note, items, subtotal, vatAmount, total, vatMode } = req.body;
  if (!['dine-in', 'takeaway'].includes(orderType)) return res.status(400).json({ message: 'ประเภทออเดอร์ไม่ถูกต้อง' });
  if (orderType === 'dine-in' && !tableId) return res.status(400).json({ message: 'กรุณาเลือกโต๊ะ' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'ยังไม่มีรายการอาหาร' });

  const cleanItems = items.map(item => ({
    lineKey: String(item.lineKey || item.id || item.menuItemId || ''),
    menuItemId: String(item.menuItemId || item.id || ''),
    name: String(item.name),
    qty: Number(item.qty),
    price: Number(item.price),
    toppings: cleanToppings(item.toppings || []),
    itemNote: String(item.itemNote || ''),
    kitchenStatus: ['waiting', 'cooking', 'done'].includes(item.kitchenStatus) ? item.kitchenStatus : 'waiting'
  })).filter(item => item.name && item.qty > 0 && item.price >= 0);
  const computedSubtotal = cleanItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const safeVatMode = ['none', 'inclusive', 'exclusive'].includes(vatMode) ? vatMode : 'exclusive';
  const finalSubtotal = Number(subtotal ?? computedSubtotal);
  const finalVatAmount = Number(vatAmount ?? 0);
  const finalTotal = Number(total ?? (computedSubtotal + finalVatAmount));

  const payload = {
    ownerId: req.user.id,
    orderType,
    tableId: tableId || null,
    tableName: tableName || '',
    customerName: customerName || '',
    note: note || '',
    items: cleanItems,
    kitchenOpen: orderType === 'takeaway',
    subtotal: finalSubtotal,
    vatAmount: finalVatAmount,
    vatMode: safeVatMode,
    total: finalTotal
  };
  const order = isDbReady() ? await Order.create(payload) : { id: makeId(), createdAt: new Date(), ...payload };
  if (!isDbReady()) memory.orders.push(order);

  res.status(201).json(normalizeDoc(order));
});

orderRoutes.patch('/:id/kitchen-item', async (req, res) => {
  const { menuItemId, status } = req.body;
  if (!['waiting', 'cooking', 'done'].includes(status)) {
    return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
  }

  const updateItem = item => {
    if (String(item.lineKey || item.menuItemId || item.id) !== String(menuItemId)) return item;
    return { ...item, kitchenStatus: status };
  };

  const order = isDbReady()
    ? await Order.findOne({ _id: req.params.id, ownerId: req.user.id, orderType: 'takeaway' })
    : memory.orders.find(item => item.id === req.params.id && item.ownerId === req.user.id && item.orderType === 'takeaway');

  if (!order) return res.status(404).json({ message: 'ไม่พบออเดอร์กลับบ้าน' });

  order.items = (order.items || []).map(updateItem);

  if (isDbReady()) {
    await order.save();
    return res.json(normalizeDoc(order));
  }

  res.json(normalizeDoc(order));
});

function cleanToppings(toppings) {
  return toppings.map(topping => ({
    name: String(topping.name || '').trim(),
    price: Number(topping.price || 0)
  })).filter(topping => topping.name && topping.price >= 0);
}

orderRoutes.delete('/:id/kitchen', async (req, res) => {
  const order = isDbReady()
    ? await Order.findOne({ _id: req.params.id, ownerId: req.user.id, orderType: 'takeaway' })
    : memory.orders.find(item => item.id === req.params.id && item.ownerId === req.user.id && item.orderType === 'takeaway');

  if (!order) return res.status(404).json({ message: 'ไม่พบออเดอร์กลับบ้าน' });

  order.kitchenOpen = false;

  if (isDbReady()) {
    await order.save();
    return res.json(normalizeDoc(order));
  }

  res.json(normalizeDoc(order));
});

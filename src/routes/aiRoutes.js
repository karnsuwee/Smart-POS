import { Router } from 'express';
import { isDbReady } from '../db.js';
import { Order } from '../models/Order.js';
import { requireAuth } from '../middleware/auth.js';
import { memory } from '../store/memoryStore.js';
import { buildDashboard } from '../services/dashboardService.js';
import { getStockInsight, makeRuleBasedInsight } from '../services/aiService.js';

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

aiRoutes.get('/orders-csv', async (req, res) => {
  const orders = isDbReady()
    ? await Order.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean()
    : memory.orders.filter(order => order.ownerId === req.user.id);

  const ordersCsv = buildOrdersCsv(orders);
  res.json({ csv: ordersCsv });
});

aiRoutes.post('/stock-insight', async (req, res) => {
  const orders = isDbReady()
    ? await Order.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean()
    : memory.orders.filter(order => order.ownerId === req.user.id);
  const dashboard = buildDashboard(orders);
  const question = String(req.body?.question || '').trim();
  const ordersForAi = limitOrdersForAi(orders);
  const ordersCsv = buildOrdersCsv(ordersForAi);

  try {
    res.json(await getStockInsight({
      question,
      dashboard,
      orderCount: orders.length,
      ordersCsv
    }));
  } catch (error) {
    res.status(502).json({
      message: 'AI API call failed',
      detail: error.message,
      fallback: makeRuleBasedInsight(dashboard)
    });
  }
});

function limitOrdersForAi(orders, maxOrders = 120) {
  return orders.slice(0, maxOrders);
}

function buildOrdersCsv(orders) {
  const rows = [['createdAt', 'orderType', 'tableName', 'customerName', 'menuName', 'qty', 'unitPrice', 'lineTotal', 'itemNote', 'toppings', 'billTotal']];
  orders.forEach(order => {
    const orderItems = order.items || [];
    if (!orderItems.length) {
      rows.push([
        toText(order.createdAt),
        toText(order.orderType),
        toText(order.tableName),
        toText(order.customerName),
        '',
        0,
        0,
        0,
        '',
        '',
        Number(order.total || 0)
      ]);
      return;
    }
    orderItems.forEach(item => {
      const toppingsText = (item.toppings || [])
        .map(top => `${top.name}(${Number(top.price || 0)})`)
        .join('|');
      rows.push([
        toText(order.createdAt),
        toText(order.orderType),
        toText(order.tableName),
        toText(order.customerName),
        toText(item.name),
        Number(item.qty || 0),
        Number(item.price || 0),
        Number(item.qty || 0) * Number(item.price || 0),
        toText(item.itemNote),
        toppingsText,
        Number(order.total || 0)
      ]);
    });
  });
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toText(value) {
  if (!value) return '';
  return String(value);
}

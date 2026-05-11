import { Router } from 'express';
import { isDbReady } from '../db.js';
import { Order } from '../models/Order.js';
import { requireAuth } from '../middleware/auth.js';
import { memory } from '../store/memoryStore.js';
import { buildDashboard } from '../services/dashboardService.js';

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

dashboardRoutes.get('/', async (req, res) => {
  const orders = isDbReady()
    ? await Order.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean()
    : memory.orders.filter(order => order.ownerId === req.user.id);

  res.json(buildDashboard(orders, {
    range: req.query.range,
    date: req.query.date,
    week: req.query.week,
    month: req.query.month
  }));
});

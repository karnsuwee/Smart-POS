import { Router } from 'express';
import { isDbReady } from '../db.js';
import { authRoutes } from './authRoutes.js';
import { menuRoutes } from './menuRoutes.js';
import { tableRoutes } from './tableRoutes.js';
import { orderRoutes } from './orderRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { aiRoutes } from './aiRoutes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', (req, res) => {
  res.json({ ok: true, database: isDbReady() ? 'mongodb' : 'memory-demo' });
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/menu', menuRoutes);
apiRoutes.use('/tables', tableRoutes);
apiRoutes.use('/orders', orderRoutes);
apiRoutes.use('/dashboard', dashboardRoutes);
apiRoutes.use('/ai', aiRoutes);

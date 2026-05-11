import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './src/config.js';
import { connectDb, isDbReady } from './src/db.js';
import { apiRoutes } from './src/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  // Google Identity popup works more reliably with this policy.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);
app.use('/api', (err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status >= 500 ? 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' : err.message,
    detail: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

await connectDb();

app.listen(config.port, () => {
  const mode = isDbReady() ? 'mongodb' : 'memory demo mode';
  console.log(`Smart POS running on http://localhost:${config.port} (${mode})`);
});

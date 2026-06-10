import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import scanRoutes from './routes/scan.routes.js';
import { notFound, errorHandler } from './middlewares/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set('trust proxy', true);

app.use(
  cors({
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API running' });
});

app.use('/api/scans', scanRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

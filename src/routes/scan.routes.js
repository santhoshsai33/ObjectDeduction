import { Router } from 'express';
import {
  detectScan,
  getDashboard,
  getProductHistory,
  getScanDetail,
  getScanList,
  getScanTable,
  getScanStats,
  removeScan
} from '../controllers/scan.controller.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';

const router = Router();

router.get('/', getScanList);
router.get('/list', getScanTable);
router.get('/stats', getScanStats);
router.get('/dashboard', getDashboard);
router.get('/products/history/:product', getProductHistory);
router.post('/detect', uploadSingleImage, detectScan);
router.get('/:id', getScanDetail);
router.delete('/:id', removeScan);

export default router;

import { Router } from 'express';
import { detectProduct } from '../controllers/detectController.js';
import { uploadSingleImage } from '../middlewares/uploadMiddleware.js';

const router = Router();

router.post('/detect', uploadSingleImage, detectProduct);

export default router;

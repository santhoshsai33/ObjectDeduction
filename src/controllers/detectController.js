import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeProductImage } from '../services/roboflowService.js';
import { buildPublicImageUrl } from '../utils/buildPublicUrl.js';
import { normalizeProductClass, getDisplayName, isSupportedProduct } from '../utils/productMap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

async function removeTempFile(filename) {
  if (!filename) {
    return;
  }

  const filePath = path.join(uploadsDir, filename);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to remove temp file: ${filePath}`, error.message);
    }
  }
}

export async function detectProduct(req, res, next) {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({
      success: false,
      message: 'Image file is required'
    });
  }

  try {
    const useBase64Input = shouldUseBase64Input();
    const imageInput = useBase64Input
      ? {
          type: 'base64',
          value: await fs.readFile(uploadedFile.path, { encoding: 'base64' })
        }
      : {
          type: 'url',
          value: buildPublicImageUrl(req, uploadedFile.filename)
        };

    const predictions = await analyzeProductImage(imageInput);

    if (!predictions.length) {
      return res.status(200).json({
        success: false,
        message: 'No supported products detected',
        products: [],
        totalCount: 0
      });
    }

    const counts = predictions.reduce((accumulator, prediction) => {
      const normalizedClass = normalizeProductClass(prediction?.class);

      if (!normalizedClass || !isSupportedProduct(normalizedClass)) {
        return accumulator;
      }

      accumulator[normalizedClass] = (accumulator[normalizedClass] || 0) + 1;
      return accumulator;
    }, {});

    const products = Object.entries(counts).map(([className, count]) => ({
      name: className,
      displayName: getDisplayName(className),
      count
    }));

    const totalCount = products.reduce((sum, product) => sum + product.count, 0);

    if (!totalCount) {
      return res.status(200).json({
        success: false,
        message: 'No supported products detected',
        products: [],
        totalCount: 0
      });
    }

    return res.status(200).json({
      success: true,
      products,
      totalCount
    });
  } catch (error) {
    return next(error);
  } finally {
    await removeTempFile(uploadedFile.filename);
  }
}

function shouldUseBase64Input() {
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').toLowerCase();
  return !publicBaseUrl || publicBaseUrl.includes('localhost') || publicBaseUrl.includes('127.0.0.1');
}

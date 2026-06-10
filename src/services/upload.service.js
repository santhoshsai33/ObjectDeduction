import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { cloudinary, configureCloudinary, hasCloudinaryConfig } from '../config/cloudinary.js';
import { buildPublicImageUrl } from '../utils/buildPublicUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

export function hasCloudinaryStorage() {
  return hasCloudinaryConfig();
}

export async function buildDetectionImageUrl(req, file) {
  if (!file) {
    throw new Error('Image file is required');
  }

  if (!hasCloudinaryConfig()) {
    return {
      imageUrl: buildPublicImageUrl(req, file.filename),
      storageType: 'local'
    };
  }

  configureCloudinary();

  const result = await cloudinary.uploader.upload(file.path, {
    folder: process.env.CLOUDINARY_FOLDER || 'product-detection'
  });

  return {
    imageUrl: result.secure_url,
    storageType: 'cloudinary',
    cloudinaryPublicId: result.public_id
  };
}

export async function deleteLocalUpload(file) {
  if (!file?.filename) {
    return;
  }

  const filePath = path.join(uploadsDir, file.filename);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to remove temp file: ${filePath}`, error.message);
    }
  }
}


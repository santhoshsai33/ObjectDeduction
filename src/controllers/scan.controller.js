import { AppError } from '../middlewares/error.middleware.js';
import { sendSuccess } from '../utils/response.js';
import { detectWithRoboflow } from '../services/roboflow.service.js';
import { buildDetectionImageUrl, deleteLocalUpload } from '../services/upload.service.js';
import {
  createScanHistory,
  countSupportedProducts,
  getDashboardData,
  getDashboardStats,
  getProductHistoryView,
  getScanById,
  getScanTableView,
  getTotalProductCount,
  getPreviousProductCounts,
  listScans,
  deleteScanById
} from '../services/scan.service.js';

export async function detectScan(req, res, next) {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return next(new AppError('Image file is required', 400));
  }

  try {
    const vendorId = req.body?.vendorId ? String(req.body.vendorId).trim() : '';
    const previousProductCounts = await getPreviousProductCounts({ vendorId });
    const { imageUrl } = await buildDetectionImageUrl(req, uploadedFile);
    const predictions = await detectWithRoboflow({
      type: 'url',
      value: imageUrl
    });

    const products = countSupportedProducts(predictions);
    const totalCount = getTotalProductCount(products);
    const matched = totalCount > 0;
    const productsWithHistory = products.map((product) => {
      const currentCount = Number(product.count || 0);
      const previousCount = previousProductCounts.get(product.name) || 0;

      return {
        name: product.name,
        count: currentCount,
        currentCount,
        previousCount,
        cumulativeCount: previousCount + currentCount
      };
    });
    const previousTotalCount = productsWithHistory.reduce(
      (sum, product) => sum + Number(product.previousCount || 0),
      0
    );

    const scan = await createScanHistory({
      vendorId,
      imageUrl,
      matched,
      products: productsWithHistory,
      totalCount,
      rawPredictions: predictions
    });

    const responsePayload = {
      matched,
      products: productsWithHistory,
      totalCount,
      previousTotalCount,
      scanId: scan._id.toString()
    };

    if (!matched) {
      responsePayload.message = 'No matched product found';
    }

    return sendSuccess(res, responsePayload);
  } catch (error) {
    return next(error);
  } finally {
    await deleteLocalUpload(uploadedFile);
  }
}

export async function getScanList(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const matched = parseOptionalBoolean(req.query.matched);

    const result = await listScans({
      page,
      limit,
      vendorId: req.query.vendorId,
      matched,
      product: req.query.product,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });

    return sendSuccess(res, {
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScanTable(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const table = await getScanTableView({
      page,
      limit,
      vendorId: req.query.vendorId,
      matched: parseOptionalBoolean(req.query.matched),
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });

    return sendSuccess(res, table);
  } catch (error) {
    return next(error);
  }
}

export async function getProductHistory(req, res, next) {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const history = await getProductHistoryView(req.params.product, {
      page,
      limit,
      vendorId: req.query.vendorId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });

    return sendSuccess(res, history);
  } catch (error) {
    return next(error);
  }
}

export async function getScanDetail(req, res, next) {
  try {
    const scan = await getScanById(req.params.id);
    return sendSuccess(res, { data: scan });
  } catch (error) {
    return next(error);
  }
}

export async function getScanStats(req, res, next) {
  try {
    const stats = await getDashboardStats();
    return sendSuccess(res, { stats });
  } catch (error) {
    return next(error);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await getDashboardData({
      vendorId: req.query.vendorId,
      matched: parseOptionalBoolean(req.query.matched),
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      limit: parsePositiveInt(req.query.limit, 8)
    });

    return sendSuccess(res, dashboard);
  } catch (error) {
    return next(error);
  }
}

export async function removeScan(req, res, next) {
  try {
    await deleteScanById(req.params.id);
    return sendSuccess(res, { message: 'Scan deleted successfully' });
  } catch (error) {
    return next(error);
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  throw new AppError('Invalid matched filter', 400);
}

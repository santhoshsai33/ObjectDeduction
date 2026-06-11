import mongoose from 'mongoose';
import ScanHistory from '../models/scanHistory.model.js';
import {
  normalizeProductClass,
  SUPPORTED_PRODUCTS,
  getDisplayName
} from '../utils/productMap.js';
import { AppError } from '../middlewares/error.middleware.js';

const PRODUCT_ORDER = ['coca', 'sprite', '7up'];

export function countSupportedProducts(predictions = []) {
  const counts = predictions.reduce((accumulator, prediction) => {
    const normalizedClass = normalizeProductClass(prediction?.class);

    if (!normalizedClass || !SUPPORTED_PRODUCTS.has(normalizedClass)) {
      return accumulator;
    }

    accumulator[normalizedClass] = (accumulator[normalizedClass] || 0) + 1;
    return accumulator;
  }, {});

  return PRODUCT_ORDER.filter((name) => counts[name]).map((name) => ({
    name,
    count: counts[name]
  }));
}

export function getTotalProductCount(products = []) {
  return products.reduce((sum, product) => sum + Number(product?.count || 0), 0);
}

export async function createScanHistory(payload) {
  return ScanHistory.create(payload);
}

export async function getPreviousProductCounts(filters = {}) {
  const matchStage = {};

  if (filters.vendorId) {
    matchStage.vendorId = filters.vendorId.trim();
  }

  const pipeline = [];

  if (Object.keys(matchStage).length) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push(
    { $unwind: '$products' },
    {
      $group: {
        _id: '$products.name',
        count: { $sum: '$products.count' }
      }
    }
  );

  const rows = await ScanHistory.aggregate(pipeline);

  return new Map(
    rows
      .filter((row) => row._id)
      .map((row) => [String(row._id).toLowerCase(), Number(row.count || 0)])
  );
}

export async function getScanById(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid scan id', 400);
  }

  const scan = await ScanHistory.findById(id);

  if (!scan) {
    throw new AppError('Scan not found', 404);
  }

  return scan;
}

export async function deleteScanById(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid scan id', 400);
  }

  const deletedScan = await ScanHistory.findByIdAndDelete(id);

  if (!deletedScan) {
    throw new AppError('Scan not found', 404);
  }

  return deletedScan;
}

export async function listScans(filters = {}) {
  const {
    page = 1,
    limit = 10,
    vendorId,
    matched,
    product,
    fromDate,
    toDate
  } = filters;

  const query = buildScanQuery({ vendorId, matched, product, fromDate, toDate });
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ScanHistory.find(query).sort({ scannedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    ScanHistory.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

export async function getScanTableView(filters = {}) {
  const {
    page = 1,
    limit = 10,
    vendorId,
    matched,
    fromDate,
    toDate
  } = filters;

  const query = buildScanQuery({ vendorId, matched, fromDate, toDate });
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: query },
    {
      $project: {
        vendorId: 1,
        matched: 1,
        imageUrl: 1,
        scannedAt: 1,
        createdAt: 1,
        itemsForList: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $ifNull: ['$products', []]
                  }
                },
                0
              ]
            },
            '$products',
            [{ name: 'unknown', count: 0 }]
          ]
        }
      }
    },
    { $unwind: '$itemsForList' },
    { $sort: { scannedAt: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$itemsForList.name',
        latestCount: { $first: '$itemsForList.count' },
        latestMatched: { $first: '$matched' },
        latestScannedAt: { $first: '$scannedAt' },
        latestImageUrl: { $first: '$imageUrl' },
        vendorId: { $first: '$vendorId' },
        totalCount: { $sum: '$itemsForList.count' },
        scanCount: { $sum: 1 }
      }
    },
    { $sort: { latestScannedAt: -1, _id: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: 'total' }]
      }
    }
  ];

  const [result] = await ScanHistory.aggregate(pipeline);
  const rows = result?.data || [];
  const total = result?.meta?.[0]?.total || 0;
  const data = rows.map((row, index) => formatGroupedScanTableRow(row, skip + index));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

export async function getProductHistoryView(productName, filters = {}) {
  const requestedProduct = normalizeRequestedProduct(productName);
  const isUnknownProduct = requestedProduct === 'unknown';
  const normalizedProduct = isUnknownProduct ? 'unknown' : normalizeProductClass(requestedProduct);

  if (!isUnknownProduct && (!normalizedProduct || !SUPPORTED_PRODUCTS.has(normalizedProduct))) {
    throw new AppError('Invalid product', 400);
  }

  const { page = 1, limit = 10, vendorId, fromDate, toDate } = filters;
  const query = isUnknownProduct
    ? buildScanQuery({ vendorId, matched: false, fromDate, toDate })
    : buildScanQuery({ vendorId, product: normalizedProduct, fromDate, toDate });
  const skip = (page - 1) * limit;

  const [scans, total] = await Promise.all([
    ScanHistory.find(query).sort({ scannedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    ScanHistory.countDocuments(query)
  ]);

  const allMatchingScans = await ScanHistory.find(query).sort({ scannedAt: -1, createdAt: -1 });
  const totalCount = isUnknownProduct
    ? 0
    : allMatchingScans.reduce((sum, scan) => {
        const product = (scan.products || []).find((item) => item.name === normalizedProduct);
        return sum + Number(product?.count || 0);
      }, 0);

  return {
    product: normalizedProduct,
    displayName: isUnknownProduct ? 'Unknown Product' : getDisplayName(normalizedProduct),
    totalCount,
    scanCount: allMatchingScans.length,
    data: scans.map((scan, index) =>
      formatProductHistoryRow(scan, normalizedProduct, skip + index, isUnknownProduct)
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

export async function getDashboardData(filters = {}) {
  const stats = await getDashboardStats();
  const recentActivity = await getRecentActivity(filters);

  return {
    stats,
    recentActivity
  };
}

export async function getDashboardStats() {
  const [summary] = await ScanHistory.aggregate([
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalScans: { $sum: 1 },
              matchedScans: {
                $sum: { $cond: ['$matched', 1, 0] }
              },
              notMatchedScans: {
                $sum: { $cond: ['$matched', 0, 1] }
              },
              totalProductCount: { $sum: '$totalCount' }
            }
          }
        ],
        products: [
          { $unwind: { path: '$products', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$products.name',
              count: { $sum: '$products.count' }
            }
          }
        ]
      }
    }
  ]);

  const overview = summary?.overview?.[0] || {
    totalScans: 0,
    matchedScans: 0,
    notMatchedScans: 0,
    totalProductCount: 0
  };

  const productMap = new Map(
    (summary?.products || [])
      .filter((item) => item._id)
      .map((item) => [String(item._id).toLowerCase(), Number(item.count || 0)])
  );

  return {
    totalScans: overview.totalScans || 0,
    matchedScans: overview.matchedScans || 0,
    notMatchedScans: overview.notMatchedScans || 0,
    totalProductCount: overview.totalProductCount || 0,
    productCounts: PRODUCT_ORDER.map((name) => ({
      name,
      count: productMap.get(name) || 0
    }))
  };
}

async function getRecentActivity(filters = {}) {
  const { vendorId, matched, fromDate, toDate, limit = 8 } = filters;
  const query = buildScanQuery({ vendorId, matched, fromDate, toDate });

  const scans = await ScanHistory.find(query)
    .sort({ scannedAt: -1, createdAt: -1 })
    .limit(limit);

  return scans.map((scan, index) => formatDashboardActivity(scan, index));
}

function buildScanQuery({ vendorId, matched, product, fromDate, toDate }) {
  const query = {};

  if (vendorId) {
    query.vendorId = vendorId.trim();
  }

  if (typeof matched === 'boolean') {
    query.matched = matched;
  }

  if (product) {
    query.products = {
      $elemMatch: {
        name: normalizeProductClass(product)
      }
    };
  }

  if (fromDate || toDate) {
    query.scannedAt = {};

    if (fromDate) {
      query.scannedAt.$gte = buildDate(fromDate, 'fromDate');
    }

    if (toDate) {
      const endDate = buildDate(toDate, 'toDate');
      endDate.setHours(23, 59, 59, 999);
      query.scannedAt.$lte = endDate;
    }
  }

  return query;
}

function buildDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return date;
}

function formatDashboardActivity(scan, index) {
  const isMatched = Boolean(scan.matched);
  const primaryProduct = scan.products?.[0]?.name || '';
  const productName = isMatched ? getDisplayName(primaryProduct) || 'Unknown Product' : 'Unknown Product';
  const scannedAt = scan.scannedAt || scan.createdAt || new Date();

  return {
    sNo: index + 1,
    id: scan._id.toString(),
    productName,
    result: isMatched ? 'Matched' : 'Unmatched',
    matched: isMatched,
    date: formatDateLabel(scannedAt),
    time: formatTimeLabel(scannedAt),
    scannedAt: scannedAt.toISOString(),
    imageUrl: scan.imageUrl,
    vendorId: scan.vendorId || '',
    totalCount: scan.totalCount || 0,
    products: scan.products || []
  };
}

function formatScanTableRow(scan, index) {
  const primaryProduct = scan.products?.[0]?.name || '';
  const displayProduct = scan.matched
    ? getDisplayName(primaryProduct) || 'Unknown Product'
    : 'Unknown Product';

  return {
    sNo: index + 1,
    id: scan._id.toString(),
    productName: displayProduct,
    result: scan.matched ? 'Matched' : 'Unmatched',
    matched: Boolean(scan.matched),
    count: Number(scan.totalCount || 0),
    imageUrl: scan.imageUrl,
    vendorId: scan.vendorId || '',
    scannedAt: (scan.scannedAt || scan.createdAt || new Date()).toISOString(),
    actionKey: primaryProduct || normalizedFallbackName(displayProduct)
  };
}

function formatGroupedScanTableRow(row, index) {
  const productName = row._id === 'unknown' ? 'Unknown Product' : getDisplayName(row._id) || row._id;
  const latestScannedAt = row.latestScannedAt || new Date();

  return {
    sNo: index + 1,
    id: row._id,
    productName,
    result: row.latestMatched ? 'Matched' : 'Unmatched',
    matched: Boolean(row.latestMatched),
    count: Number(row.latestCount || 0),
    totalCount: Number(row.totalCount || 0),
    scanCount: Number(row.scanCount || 0),
    imageUrl: row.latestImageUrl || '',
    vendorId: row.vendorId || '',
    scannedAt: latestScannedAt.toISOString(),
    actionKey: row._id
  };
}

function formatProductHistoryRow(scan, normalizedProduct, index) {
  const product = (scan.products || []).find((item) => item.name === normalizedProduct);
  const scannedAt = scan.scannedAt || scan.createdAt || new Date();

  return {
    sNo: index + 1,
    id: scan._id.toString(),
    date: formatDateLabel(scannedAt),
    time: formatTimeLabel(scannedAt),
    count: Number(product?.count || 0),
    status: scan.matched ? 'Matched' : 'Unmatched',
    matched: Boolean(scan.matched),
    imageUrl: scan.imageUrl,
    vendorId: scan.vendorId || '',
    scannedAt: scannedAt.toISOString()
  };
}

function normalizeRequestedProduct(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (
    normalized === 'unknown' ||
    normalized === 'unknown product' ||
    normalized === 'unmatched' ||
    normalized === 'no matched product found'
  ) {
    return 'unknown';
  }

  return normalized;
}

function normalizedFallbackName(value) {
  return String(value || '').trim().toLowerCase();
}

function formatDateLabel(dateValue) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata'
  }).format(new Date(dateValue));
}

function formatTimeLabel(dateValue) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).format(new Date(dateValue));
}

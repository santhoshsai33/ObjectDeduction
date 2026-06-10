export function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
}

export function errorHandler(error, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  if (error?.statusCode) {
    statusCode = error.statusCode;
  }

  if (error?.code === 'LIMIT_FILE_SIZE' || error?.message === 'Only image files are allowed') {
    statusCode = 400;
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error'
  });
}

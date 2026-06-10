export function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...data
  });
}

export function sendError(res, message, statusCode = 500, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra
  });
}


import mongoose from 'mongoose';

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
}

export function errorHandler(error, req, res, next) {
  const statusCode = getStatusCode(error, res);
  const message = getMessage(error, statusCode);

  return res.status(statusCode).json({
    success: false,
    message
  });
}

function getStatusCode(error, res) {
  if (error?.statusCode) {
    return error.statusCode;
  }

  if (error?.name === 'CastError' || error?.name === 'ValidationError') {
    return 400;
  }

  if (error?.code === 'LIMIT_FILE_SIZE' || error?.message === 'Only image files are allowed') {
    return 400;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return 400;
  }

  return res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
}

function getMessage(error, statusCode) {
  if (error?.name === 'CastError') {
    return `Invalid ${error.path || 'resource'} id`;
  }

  if (error?.name === 'ValidationError') {
    return error.message;
  }

  if (error?.code === 'LIMIT_FILE_SIZE') {
    return 'Image file is too large. Maximum size is 10MB.';
  }

  if (error?.message === 'Only image files are allowed') {
    return error.message;
  }

  if (statusCode === 404) {
    return error.message || 'Resource not found';
  }

  return error.message || 'Internal server error';
}


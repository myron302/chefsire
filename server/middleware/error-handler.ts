// server/middleware/error-handler.ts
import { Request, Response, NextFunction } from "express";

/**
 * Custom error class with status code
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Async error wrapper - wraps async route handlers to catch errors
 * Usage: router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  console.error(`[${new Date().toISOString()}] Error in ${req.method} ${req.path}:`, error);

  // Handle ApiError instances
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }

  // Handle validation errors (e.g., from Zod)
  if (error.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      details: error.message,
    });
  }

  // Handle database errors
  if (error.message?.includes("SQLITE") || error.message?.includes("constraint")) {
    return res.status(400).json({
      error: "Database constraint violation",
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }

  // Default error response
  return res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      message: error.message,
      stack: error.stack
    }),
  });
}

/**
 * Not found handler - catches 404 errors
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
}

/**
 * Common API error factories
 */
export const ErrorFactory = {
  badRequest: (message: string) => new ApiError(400, message),
  unauthorized: (message: string = "Unauthorized") => new ApiError(401, message),
  forbidden: (message: string = "Forbidden") => new ApiError(403, message),
  notFound: (message: string = "Not found") => new ApiError(404, message),
  conflict: (message: string) => new ApiError(409, message),
  internal: (message: string = "Internal server error") => new ApiError(500, message),
};

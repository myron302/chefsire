// server/middleware/validation.ts
import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ApiError } from "./error-handler";

/**
 * Validation middleware factory
 * Validates request body, query, or params against a Zod schema
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);
      // Replace the request data with validated data
      req[source] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((err) => {
          const path = err.path.join(".");
          return `${path}: ${err.message}`;
        });

        return res.status(400).json({
          error: "Validation failed",
          details: messages,
        });
      }
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  id: z.object({
    id: z.string().uuid("Invalid ID format"),
  }),

  pagination: z.object({
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),

  userId: z.object({
    userId: z.string().uuid("Invalid user ID"),
  }),

  email: z.object({
    email: z.string().email("Invalid email address"),
  }),
};

/**
 * Sanitize input by trimming whitespace from string fields
 */
export function sanitizeInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.body && typeof req.body === "object") {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
}

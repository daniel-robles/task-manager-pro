import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { sendError } from "../../shared/api-response.js";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * Catches requests that matched no registered route and forwards a 404
 * NotFoundError to the error middleware.
 *
 * Mount after all routers:
 *   app.use(notFoundMiddleware);
 *   app.use(errorMiddleware);
 */
export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}

/**
 * Central error handler. Must be registered last (four-argument signature).
 *
 * Behaviour:
 * - AppError subclasses → their own statusCode + message.
 * - Unknown errors      → 500 "Internal Server Error" with the real message
 *                         suppressed in production.
 * - Stack traces        → included in development only, under the `stack` key.
 */
export const errorMiddleware: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // next must be declared even when unused — Express requires all four params
  // to recognise this as an error-handling middleware.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { message: err.message };

    if (!IS_PRODUCTION) {
      body["stack"] = err.stack;
    }

    sendError(res, body, undefined, err.statusCode);
    return;
  }

  // Unexpected / non-operational error — log it server-side.
  console.error("[unhandled error]", err);

  const message = IS_PRODUCTION
    ? "Internal Server Error"
    : err instanceof Error
      ? err.message
      : String(err);

  const body: Record<string, unknown> = { message };

  if (!IS_PRODUCTION && err instanceof Error) {
    body["stack"] = err.stack;
  }

  sendError(res, body, undefined, 500);
};

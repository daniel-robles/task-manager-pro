import type { Response } from "express";

export type SuccessResponse<TData, TMeta = unknown> = {
  success: true;
  data: TData;
  meta?: TMeta;
};

export type ErrorResponse<TError = unknown, TDetails = unknown> = {
  success: false;
  error: TError;
  details?: TDetails;
};

export function sendSuccess<TData, TMeta = unknown>(
  res: Response,
  data: TData,
  meta?: TMeta,
  statusCode = 200,
): Response {
  const payload: SuccessResponse<TData, TMeta> =
    meta === undefined ? { success: true, data } : { success: true, data, meta };

  return res.status(statusCode).json(payload);
}

export function sendError<TError = unknown, TDetails = unknown>(
  res: Response,
  error: TError,
  details?: TDetails,
  statusCode = 500,
): Response {
  const payload: ErrorResponse<TError, TDetails> =
    details === undefined
      ? { success: false, error }
      : { success: false, error, details };

  return res.status(statusCode).json(payload);
}


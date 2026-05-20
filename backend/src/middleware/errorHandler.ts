import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  NoLiquidityError,
  NoMakersError,
  QuoteRefusedError,
  QuoteTimeoutError,
  MakerTimeoutError,
  InternalError,
} from '../utils/errors';

type KnownError =
  | ValidationError
  | AuthenticationError
  | NotFoundError
  | NoLiquidityError
  | NoMakersError
  | QuoteRefusedError
  | QuoteTimeoutError
  | MakerTimeoutError
  | InternalError;

function isKnownError(err: unknown): err is KnownError {
  return (
    err instanceof ValidationError ||
    err instanceof AuthenticationError ||
    err instanceof NotFoundError ||
    err instanceof NoLiquidityError ||
    err instanceof NoMakersError ||
    err instanceof QuoteRefusedError ||
    err instanceof QuoteTimeoutError ||
    err instanceof MakerTimeoutError ||
    err instanceof InternalError
  );
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isKnownError(err)) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, code: err.code });
    }

    if (err instanceof QuoteRefusedError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          reasons: err.reasons,
        },
      });
      return;
    }

    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
}

export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class NoLiquidityError extends Error {
  readonly statusCode = 503;
  readonly code = 'NO_LIQUIDITY';
  constructor(message = 'No liquidity available') {
    super(message);
    this.name = 'NoLiquidityError';
  }
}

export class NoMakersError extends Error {
  readonly statusCode = 503;
  readonly code = 'NO_MAKERS';
  constructor(message = 'No market makers are currently online') {
    super(message);
    this.name = 'NoMakersError';
  }
}

export class QuoteRefusedError extends Error {
  readonly statusCode = 503;
  readonly code = 'QUOTE_REFUSED';
  readonly reasons: string[];
  constructor(message = 'Market makers could not quote this trade', reasons: string[] = []) {
    super(message);
    this.name = 'QuoteRefusedError';
    this.reasons = reasons;
  }
}

export class QuoteTimeoutError extends Error {
  readonly statusCode = 503;
  readonly code = 'QUOTE_TIMEOUT';
  constructor(message = 'Market makers did not respond in time') {
    super(message);
    this.name = 'QuoteTimeoutError';
  }
}

export class MakerTimeoutError extends Error {
  readonly statusCode = 503;
  readonly code = 'MAKER_TIMEOUT';
  constructor(message = 'Makers did not respond in time') {
    super(message);
    this.name = 'MakerTimeoutError';
  }
}

export class MakerRefusalError extends Error {
  readonly type = 'maker_refused';
  readonly makerId: string;
  readonly reason: string;
  constructor(makerId: string, reason: string) {
    super(`maker_refused:${reason}`);
    this.name = 'MakerRefusalError';
    this.makerId = makerId;
    this.reason = reason;
  }
}

export class InternalError extends Error {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'InternalError';
  }
}

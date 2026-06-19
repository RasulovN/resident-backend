export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusByCode[code];
    this.details = details;
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new AppError('BAD_REQUEST', msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError('UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError('FORBIDDEN', msg);
  }
  static notFound(msg = 'Not found') {
    return new AppError('NOT_FOUND', msg);
  }
  static conflict(msg = 'Conflict') {
    return new AppError('CONFLICT', msg);
  }
}

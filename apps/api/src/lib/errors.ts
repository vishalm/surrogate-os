import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | null;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details: Record<string, unknown> | null = null) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details: Record<string, unknown> | null = null) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details: Record<string, unknown> | null = null) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: Record<string, unknown> | null = null) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details: Record<string, unknown> | null = null) {
    super(409, 'CONFLICT', message, details);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', details: Record<string, unknown> | null = null) {
    super(500, 'INTERNAL_ERROR', message, details);
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error({
    err: error,
    method: request.method,
    url: request.url,
  });

  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { validation: error.validation },
      },
    });
    return;
  }

  // Handle generic errors
  const statusCode = 'statusCode' in error ? (error.statusCode as number) : 500;
  reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      details: null,
    },
  });
}

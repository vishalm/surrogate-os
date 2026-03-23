import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  InternalError,
  errorHandler,
} from './errors.js';

describe('AppError', () => {
  it('stores statusCode, code, message, and details', () => {
    const details = { field: 'email' };
    const err = new AppError(422, 'CUSTOM', 'custom message', details);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CUSTOM');
    expect(err.message).toBe('custom message');
    expect(err.details).toEqual(details);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('defaults details to null', () => {
    const err = new AppError(400, 'TEST', 'test');
    expect(err.details).toBeNull();
  });
});

describe('NotFoundError', () => {
  it('has statusCode 404 and code NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('NotFoundError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('accepts a custom message and details', () => {
    const err = new NotFoundError('User not found', { id: '123' });
    expect(err.message).toBe('User not found');
    expect(err.details).toEqual({ id: '123' });
  });
});

describe('UnauthorizedError', () => {
  it('has statusCode 401 and code UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('UnauthorizedError');
  });
});

describe('ForbiddenError', () => {
  it('has statusCode 403 and code FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Forbidden');
    expect(err.name).toBe('ForbiddenError');
  });
});

describe('ValidationError', () => {
  it('has statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
    expect(err.name).toBe('ValidationError');
  });
});

describe('ConflictError', () => {
  it('has statusCode 409 and code CONFLICT', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Resource conflict');
    expect(err.name).toBe('ConflictError');
  });
});

describe('InternalError', () => {
  it('has statusCode 500 and code INTERNAL_ERROR', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe('Internal server error');
    expect(err.name).toBe('InternalError');
  });
});

describe('errorHandler', () => {
  function createMockReply() {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return reply;
  }

  function createMockRequest() {
    return {
      log: { error: vi.fn() },
      method: 'GET',
      url: '/test',
    };
  }

  it('handles AppError with correct response shape', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = new NotFoundError('User missing', { userId: '1' });

    errorHandler(error as any, request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'User missing',
        details: { userId: '1' },
      },
    });
  });

  it('handles Fastify validation errors', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = {
      validation: [{ message: 'bad field' }],
      message: 'validation error',
    };

    errorHandler(error as any, request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { validation: error.validation },
      },
    });
  });

  it('handles generic errors with statusCode', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = { message: 'Bad gateway', statusCode: 502 };

    errorHandler(error as any, request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(502);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          details: null,
        }),
      }),
    );
  });

  it('handles plain Error objects with 500 status', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = new Error('something broke');

    errorHandler(error as any, request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
  });

  it('logs the error with request context', () => {
    const reply = createMockReply();
    const request = createMockRequest();
    const error = new InternalError();

    errorHandler(error as any, request as any, reply as any);

    expect(request.log.error).toHaveBeenCalledWith({
      err: error,
      method: 'GET',
      url: '/test',
    });
  });
});

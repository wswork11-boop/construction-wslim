import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super({ statusCode, code, message, ...(details !== undefined ? { details } : {}) }, statusCode);
    this.code = code;
    this.details = details;
  }

  static unauthorized(code = 'UNAUTHENTICATED', message = 'Access token is missing or expired') {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'You do not have access to this resource') {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
    return new AppException(HttpStatus.NOT_FOUND, code, message);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }

  static unprocessable(code: string, message: string, details?: unknown) {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);
  }

  static tooManyRequests(code: string, message: string, details?: unknown) {
    return new AppException(HttpStatus.TOO_MANY_REQUESTS, code, message, details);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HttpException carrying a stable machine-readable `code` the frontend can
 * branch on, independent of the human message.
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

export const badRequest = (code: string, message: string, extras?: Record<string, unknown>) =>
  new DomainException(HttpStatus.BAD_REQUEST, code, message, extras);

export const unauthorized = (code: string, message: string) =>
  new DomainException(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (code: string, message: string) =>
  new DomainException(HttpStatus.FORBIDDEN, code, message);

export const notFound = (code: string, message: string) =>
  new DomainException(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: string, message: string) =>
  new DomainException(HttpStatus.CONFLICT, code, message);

export const serviceUnavailable = (code: string, message: string) =>
  new DomainException(HttpStatus.SERVICE_UNAVAILABLE, code, message);

export const tooManyRequests = (code: string, message: string, retryAfterSec?: number) =>
  new DomainException(HttpStatus.TOO_MANY_REQUESTS, code, message, { retryAfterSec });

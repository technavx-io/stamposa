import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
import { AuthActor } from '../../auth/auth.types';

/**
 * Every 4xx/5xx response carries both the legacy Stamposa envelope AND the
 * canonical RFC 7807 "Problem Details" fields. Clients can consume whichever
 * they prefer; the legacy fields will be retired after every consumer has
 * moved to the RFC 7807 names (task 2.6 follow-up).
 *
 * RFC 7807 mapping:
 *   type      → 'about:blank' (no docs page yet; upgrade to a real URI later)
 *   title     → the machine-readable code (BAD_REQUEST, ALREADY_REDEEMED, …)
 *   status    → HTTP status (same as legacy statusCode)
 *   detail    → human-readable message (same as legacy message)
 *   instance  → the request path (same as legacy path)
 */
interface ErrorBody {
  // RFC 7807 canonical fields.
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  // Legacy Stamposa envelope — retained for backwards compat.
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  retryAfterSec?: number;
  requestId?: string;
  path: string;
  timestamp: string;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

/** Normalises every error into one JSON envelope the frontend can rely on. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string | undefined;
    let message = 'Something went wrong. Please try again.';
    let details: unknown;
    let retryAfterSec: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.message)) {
          message = String(b.message[0]);
          if (b.message.length > 1) details = b.message;
        } else if (typeof b.message === 'string') {
          message = b.message;
        } else {
          message = exception.message;
        }
        if (typeof b.code === 'string') code = b.code;
        if (b.details !== undefined) details = b.details;
        if (typeof b.retryAfterSec === 'number') retryAfterSec = b.retryAfterSec;
      }
      if (status === 429 && message.includes('ThrottlerException')) {
        message = 'Too many requests. Please slow down.';
      }
    } else if (exception instanceof MulterError) {
      code = 'UPLOAD_ERROR';
      if (exception.code === 'LIMIT_FILE_SIZE') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'File too large — maximum size is 2 MB.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Upload failed: ${exception.message}.`;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these details already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found.';
      } else {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
      }
    } else {
      const err = exception as Error;
      this.logger.error(
        `Unhandled ${err?.name ?? 'error'} on ${req.method} ${req.url}: ${err?.message}`,
        err?.stack,
      );
    }

    // 5xx means WE broke — ship it to error monitoring with enough context
    // to find the request, and nothing that identifies the person (actor id
    // only, never a phone). 4xx are expected domain outcomes and stay out.
    // Without SENTRY_DSN captureException is a no-op.
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', req.id ?? 'none');
        scope.setTag('status', String(status));
        scope.setContext('request', {
          method: req.method,
          path: req.url.split('?')[0],
        });
        const actor = (req as Request & { actor?: AuthActor }).actor;
        if (actor) {
          const id =
            actor.role === 'MERCHANT'
              ? actor.merchant.id
              : actor.role === 'STAFF'
                ? actor.staff.id
                : actor.customer.id;
          scope.setUser({ id, segment: actor.role });
        }
        Sentry.captureException(exception instanceof Error ? exception : new Error(message));
      });
    }

    const resolvedCode = code ?? DEFAULT_CODES[status] ?? 'ERROR';
    const body: ErrorBody = {
      // RFC 7807 canonical.
      type: 'about:blank',
      title: resolvedCode,
      status,
      detail: message,
      instance: req.url,
      // Legacy Stamposa envelope.
      statusCode: status,
      code: resolvedCode,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
      requestId: req.id,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    if (retryAfterSec !== undefined) {
      res.setHeader('Retry-After', String(retryAfterSec));
    }
    // Signal RFC 7807 to any client that opts into content negotiation.
    // Existing clients that read raw JSON keep working — the payload is a
    // superset of the legacy envelope, and application/problem+json is
    // registered as an application/json subtype.
    res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    res.status(status).json(body);
  }
}

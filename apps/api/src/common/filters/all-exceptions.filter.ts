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

interface ErrorBody {
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

    const body: ErrorBody = {
      statusCode: status,
      code: code ?? DEFAULT_CODES[status] ?? 'ERROR',
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
    res.status(status).json(body);
  }
}

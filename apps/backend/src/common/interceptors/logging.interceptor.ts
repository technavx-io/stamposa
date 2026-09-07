import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

/** One request = one log line: method, path, status, duration, request id. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    if (req.url.startsWith('/v1/health')) return next.handle();

    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.logger.log(
            `${req.method} ${req.url} ${res.statusCode} +${Date.now() - started}ms rid=${req.id}`,
          );
        },
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          const log = status >= 500 ? this.logger.error : this.logger.warn;
          log.call(
            this.logger,
            `${req.method} ${req.url} ${status} +${Date.now() - started}ms rid=${req.id}`,
          );
        },
      }),
    );
  }
}

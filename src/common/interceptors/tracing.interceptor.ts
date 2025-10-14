import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TracingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<
      Request & { txId?: string; user?: { id?: string } }
    >();
    const response = httpContext.getResponse<Response>();

    const txId = request.txId ?? randomUUID();
    request.txId = txId;
    response.setHeader('x-trace-id', txId);

    const userId = request.user?.id ?? 'anonymous';
    const { method, originalUrl } = request;

    this.logger.log(`txId=${txId} userId=${userId} start ${method} ${originalUrl}`);

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `txId=${txId} userId=${userId} completed ${method} ${originalUrl} status=${response.statusCode} duration=${duration}ms`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `txId=${txId} userId=${userId} failed ${method} ${originalUrl} status=${response.statusCode} duration=${duration}ms`,
            error instanceof Error ? error.stack : undefined,
          );
        },
      }),
    );
  }
}

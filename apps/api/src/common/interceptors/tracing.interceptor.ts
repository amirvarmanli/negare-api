import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { requestTraceStorage } from '@app/common/tracing/request-trace';

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

    this.logger.log(
      `traceId=${txId} userId=${userId} start method=${method} url=${originalUrl}`,
    );

    const startTime = Date.now();

    return requestTraceStorage.run(
      { traceId: txId, userId },
      () => {
        let finalStatus: number | undefined;
        let capturedError: unknown;

        return next.handle().pipe(
          tap(() => {
            finalStatus = response.statusCode;
          }),
          catchError((error: unknown) => {
            capturedError = error;
            if (error instanceof HttpException) {
              finalStatus = error.getStatus();
            } else if (
              typeof (error as { status?: number }).status === 'number'
            ) {
              finalStatus = Number(
                (error as { status?: number }).status ?? response.statusCode,
              );
            } else if (
              typeof (error as { statusCode?: number }).statusCode === 'number'
            ) {
              finalStatus = Number(
                (error as { statusCode?: number }).statusCode ??
                  response.statusCode,
              );
            } else {
              finalStatus = 500;
            }
            return throwError(() => error);
          }),
          finalize(() => {
            const durationMs = Date.now() - startTime;
            const status = finalStatus ?? response.statusCode;
            const baseLog = `traceId=${txId} userId=${userId} method=${method} url=${originalUrl} status=${status} durationMs=${durationMs}`;
            if (capturedError) {
              this.logger.error(
                baseLog,
                capturedError instanceof Error ? capturedError.stack : undefined,
              );
            } else {
              this.logger.log(baseLog);
            }
          }),
        );
      },
    );
  }
}

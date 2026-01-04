import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { txId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const responseObject = res as Record<string, unknown>;
        message =
          (responseObject.message as string) ??
          (Array.isArray(responseObject.message)
            ? (responseObject.message.join(', ') as string)
            : message);
        code =
          (responseObject['code'] as string) ??
          (responseObject['error'] as string) ??
          code;
      } else {
        message = exception.message;
      }

      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    const traceId = request.txId ?? randomUUID();
    const isAuthFailure =
      status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN;

    const logMessage = `traceId=${traceId} status=${status} message=${message}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logMessage, stack);
    } else if (isAuthFailure) {
      this.logger.debug(logMessage);
    } else {
      this.logger.error(logMessage, stack);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
      traceId,
    });
  }
}

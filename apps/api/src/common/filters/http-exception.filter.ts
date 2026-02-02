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
    let meta: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const responseObject = res as Record<string, unknown>;
        const errorObj = responseObject.error;

        if (errorObj && typeof errorObj === 'object') {
          const errorRecord = errorObj as Record<string, unknown>;
          if (typeof errorRecord.message === 'string') {
            message = errorRecord.message;
          }
          if (typeof errorRecord.code === 'string') {
            code = errorRecord.code;
          }
          if ('meta' in errorRecord) {
            meta = errorRecord.meta;
          }
        }

        if (Array.isArray(responseObject.message)) {
          message = responseObject.message.join(', ');
        } else if (typeof responseObject.message === 'string') {
          message = responseObject.message;
        }

        if (typeof responseObject.code === 'string') {
          code = responseObject.code;
        } else if (typeof responseObject.error === 'string') {
          code = responseObject.error;
        }
        if ('meta' in responseObject) {
          meta = responseObject.meta;
        }
      } else {
        message = exception.message;
      }

      stack = exception.stack;

      if (code === 'INTERNAL_SERVER_ERROR') {
        const statusCodeName = HttpStatus[status];
        if (typeof statusCodeName === 'string') {
          code = statusCodeName;
        }
      }
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
        ...(meta !== undefined ? { meta } : {}),
      },
      traceId,
    });
  }
}

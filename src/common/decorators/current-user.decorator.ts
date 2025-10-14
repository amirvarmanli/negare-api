import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface CurrentUserPayload {
  id: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPayload | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CurrentUserPayload }>();
    return request.user;
  },
);

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RoleName } from '../../core/roles/role.entity';
import {
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

interface MockUserHeaderPayload {
  id: string;
  roles?: RoleName[] | string[];
}

@Injectable()
export class FakeAuthGuard implements CanActivate {
  private readonly logger = new Logger(FakeAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<
      Request & { user?: CurrentUserPayload }
    >();

    const path = request.path ?? request.url ?? '';
    if (isPublic || this.isPublicPath(path)) {
      return true;
    }

    const headerValue = request.headers['x-mock-user'];

    if (!headerValue) {
      throw new UnauthorizedException('x-mock-user header is required');
    }

    const payload = this.parseHeader(headerValue);
    const user: CurrentUserPayload = {
      id: payload.id,
      roles: Array.from(new Set((payload.roles ?? []).map((role) => String(role)))),
    };

    request.user = user;

    this.logger.debug(
      `Authenticated mock user ${user.id} roles=${user.roles.join(',')}`,
    );

    return true;
  }

  private parseHeader(
    headerValue: string | string[],
  ): MockUserHeaderPayload {
    const serialized =
      Array.isArray(headerValue) && headerValue.length > 0
        ? headerValue[0]
        : (headerValue as string);

    try {
      const parsed = JSON.parse(serialized) as MockUserHeaderPayload;
      if (!parsed?.id || typeof parsed.id !== 'string') {
        throw new Error('Invalid id');
      }

      if (parsed.roles && !Array.isArray(parsed.roles)) {
        throw new Error('Invalid roles array');
      }

      return parsed;
    } catch (error) {
      this.logger.warn(`Failed to parse x-mock-user header: ${String(error)}`);
      throw new UnauthorizedException('Invalid x-mock-user header');
    }
  }

  private isPublicPath(path: string): boolean {
    return (
      path.startsWith('/api/docs') ||
      path.startsWith('/docs') ||
      path.startsWith('/swagger-ui') ||
      path.startsWith('/health')
    );
  }
}

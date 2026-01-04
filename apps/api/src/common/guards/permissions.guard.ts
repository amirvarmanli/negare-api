import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RoleName } from '@prisma/client';
import { PERMISSIONS_KEY } from '@app/common/decorators/permissions.decorator';
import {
  PermissionsService,
  UserPermissionSnapshot,
} from '@app/common/authz/permissions.service';
import { CurrentUserPayload } from '@app/common/decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: CurrentUserPayload }
    >();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authenticated user not found.');
    }

    let snapshot: UserPermissionSnapshot;
    try {
      snapshot = await this.permissions.getUserPermissionSnapshot(userId);
    } catch (error) {
      throw new ForbiddenException('User not found.');
    }

    if (snapshot.role === RoleName.admin) {
      return true;
    }

    const effective = new Set(snapshot.permissions);
    const missing = required.filter((key) => !effective.has(key));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}

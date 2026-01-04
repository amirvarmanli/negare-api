import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { PermissionsService } from '@app/common/authz/permissions.service';
import { RoleName } from '@prisma/client';

export type PermissionRecord = {
  key: string;
  title: string;
  group: string;
};

@Injectable()
export class AdminRbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async getUserAccess(userId: string) {
    return this.permissionsService.getUserPermissionSnapshot(userId);
  }

  async listPermissions(): Promise<PermissionRecord[]> {
    return this.prisma.permission.findMany({
      select: { key: true, title: true, group: true },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async updateUserPermissions(
    userId: string,
    add: string[] = [],
    remove: string[] = [],
  ) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException('User not found.');
    }

    const uniqueKeys = Array.from(new Set([...add, ...remove]));
    if (uniqueKeys.length === 0) {
      return this.permissionsService.getUserPermissionSnapshot(userId);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
      select: { id: true, key: true },
    });

    const foundKeys = new Set(permissions.map((permission) => permission.key));
    const missing = uniqueKeys.filter((key) => !foundKeys.has(key));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown permission keys: ${missing.join(', ')}`,
      );
    }

    const keyToId = new Map(
      permissions.map((permission) => [permission.key, permission.id]),
    );

    const addIds = add
      .map((key) => keyToId.get(key))
      .filter((value): value is string => Boolean(value));
    const removeIds = remove
      .map((key) => keyToId.get(key))
      .filter((value): value is string => Boolean(value));

    await this.prisma.$transaction(async (tx) => {
      if (addIds.length > 0) {
        await tx.userPermission.createMany({
          data: addIds.map((permissionId) => ({
            userId,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      if (removeIds.length > 0) {
        await tx.userPermission.deleteMany({
          where: { userId, permissionId: { in: removeIds } },
        });
      }
    });

    return this.permissionsService.getUserPermissionSnapshot(userId);
  }

  async updateUserRole(userId: string, role: RoleName) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role },
      });

      const roleRecord = await tx.role.upsert({
        where: { name: role },
        update: {},
        create: { name: role },
      });

      await tx.userRole.deleteMany({
        where: { userId },
      });

      await tx.userRole.create({
        data: {
          userId,
          roleId: roleRecord.id,
        },
      });
    });

    return this.permissionsService.getUserPermissionSnapshot(userId);
  }
}

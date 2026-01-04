import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { RoleName } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@app/common/authz/permissions.catalog';

export type UserPermissionSnapshot = {
  userId: string;
  role: RoleName;
  permissions: string[];
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissionSnapshot(userId: string): Promise<UserPermissionSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
        userPermissions: {
          select: { permission: { select: { key: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const role = this.resolveRole(user.role, user.userRoles);
    const rolePermissions = ROLE_PERMISSIONS[role] ?? [];
    const extraPermissions = user.userPermissions
      .map((entry) => entry.permission.key)
      .filter((key): key is string => Boolean(key));

    const permissions = Array.from(
      new Set([...rolePermissions, ...extraPermissions]),
    );

    return {
      userId: user.id,
      role,
      permissions,
    };
  }

  private resolveRole(
    explicitRole: RoleName | null,
    userRoles: Array<{ role: { name: RoleName | null } | null }>,
  ): RoleName {
    if (explicitRole) {
      return explicitRole;
    }

    const roleNames = userRoles
      .map((relation) => relation.role?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (roleNames.includes(RoleName.admin)) {
      return RoleName.admin;
    }
    if (roleNames.includes(RoleName.supplier)) {
      return RoleName.supplier;
    }
    return RoleName.user;
  }
}

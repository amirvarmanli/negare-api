import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import { AssignRoleDto } from '@app/core/roles/dto/assign-role.dto';
import { FindUserRolesQueryDto } from '@app/core/roles/dto/find-user-roles-query.dto';

type UserRoleWithRelations = Prisma.UserRoleGetPayload<{
  include: {
    user: true;
    role: true;
  };
}>;

@Injectable()
export class UserRolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists user-role assignments with optional filters.
   * Aligns with FindUserRolesQueryDto (userId | roleId | roleName).
   */
  async findAll(
    query: FindUserRolesQueryDto,
  ): Promise<UserRoleWithRelations[]> {
    const where: Prisma.UserRoleWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.roleName) {
      where.role = { name: query.roleName };
    }

    return this.prisma.userRole.findMany({
      where,
      include: { user: true, role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Assigns a role to a user.
   * Supports AssignRoleDto with either roleId or roleName.
   * - Validates user & role existence
   * - Uses upsert on (userId, roleId) to avoid race conditions
   * - Throws Conflict when already assigned (via upsert "no-op" detection)
   */
  async assignRole(dto: AssignRoleDto): Promise<UserRoleWithRelations> {
    // 1) Resolve roleId (roleId direct OR roleName -> id)
    const roleId =
      dto.roleId ??
      (
        await this.prisma.role.findUnique({
          where: { name: dto.roleName! },
          select: { id: true },
        })
      )?.id;

    if (!roleId) {
      throw new NotFoundException('Role not found.');
    }

    // 2) Validate user existence (clear 404 instead of FK error)
    const userExists = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!userExists) {
      throw new NotFoundException('User not found.');
    }

    // 3) Upsert on composite unique to be atomic
    // If the assignment already exists, we surface Conflict to the client.
    try {
      return await this.prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: dto.userId,
            roleId,
          },
        },
        update: {}, // existing -> treat as conflict for clearer API semantics
        create: {
          userId: dto.userId,
          roleId,
        },
        include: { user: true, role: true },
      });
    } catch (err: unknown) {
      // Defensive catch; upsert normally shouldn't throw P2002.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
        throw err;
      }
      if (err.code === 'P2002') {
        throw new ConflictException('Role already assigned to this user.');
      }
      throw err;
    }
  }

  /**
   * Removes a user-role assignment by its UUID id.
   * Returns a simple success payload for client UX consistency.
   */
  async remove(id: string): Promise<{ success: true }> {
    try {
      await this.prisma.userRole.delete({ where: { id } });
      return { success: true };
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `User role assignment with id ${id} not found.`,
        );
      }
      throw error;
    }
  }
}

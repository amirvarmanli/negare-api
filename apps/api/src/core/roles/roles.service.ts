/**
 * RolesService encapsulates Prisma access for the role catalogue.
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma as PrismaNamespace, RoleName } from '@prisma/client';
import { PrismaService } from '@app/prisma/prisma.service';
import { FindRolesQueryDto } from '@app/core/roles/dto/find-roles-query.dto';
import { CreateRoleDto } from '@app/core/roles/dto/create-role.dto';
import { UpdateRoleDto } from '@app/core/roles/dto/update-role.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type RoleRecord = PrismaNamespace.RoleGetPayload<{}>;

@Injectable()
/**
 * Provides CRUD-like helpers for roles referenced by RBAC guards.
 */
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves roles with optional filtering and limit.
   * Aligns with FindRolesQueryDto (name?, limit?).
   */
  async findAll(query: FindRolesQueryDto): Promise<RoleRecord[]> {
    const where: PrismaNamespace.RoleWhereInput = {};
    if (query.name) where.name = query.name;

    return this.prisma.role.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 25,
    });
  }

  /**
   * Finds a single role by its enum-backed name.
   */
  findByName(name: RoleName): Promise<RoleRecord | null> {
    return this.prisma.role.findUnique({ where: { name } });
  }

  /**
   * Persists a new role.
   * Maps unique-constraint violations to ConflictException.
   */
  async create(dto: CreateRoleDto): Promise<RoleRecord> {
    try {
      return await this.prisma.role.create({
        data: { name: dto.name },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // unique constraint on name
        throw new ConflictException('Role with this name already exists.');
      }
      throw err;
    }
  }

  /**
   * Updates an existing role (rename supported).
   * - 404 if source role not found
   * - 409 if new name collides with an existing role
   */
  async update(name: RoleName, dto: UpdateRoleDto): Promise<RoleRecord> {
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (!existing) {
      throw new NotFoundException(`نقش ${name} یافت نشد.`);
    }

    // If no change requested, return current entity
    if (!dto.name || dto.name === name) {
      return existing;
    }

    try {
      return await this.prisma.role.update({
        where: { name },
        data: { name: dto.name },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // unique constraint on name
        throw new ConflictException(
          'Another role with the requested name already exists.',
        );
      }
      throw err;
    }
  }
}

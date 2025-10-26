import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignRoleDto } from './dto/assign-role.dto';
import { FindUserRolesQueryDto } from './dto/find-user-roles-query.dto';
import { UserRole } from '@app/core/roles/entities/user-role.entity';

@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
  ) {}

  async findAll(query: FindUserRolesQueryDto): Promise<UserRole[]> {
    const qb = this.userRolesRepository
      .createQueryBuilder('userRole')
      .leftJoinAndSelect('userRole.user', 'user')
      .leftJoinAndSelect('userRole.role', 'role')
      .orderBy('userRole.createdAt', 'DESC');

    if (query.userId) {
      qb.andWhere('userRole.userId = :userId', { userId: query.userId });
    }

    if (query.roleId) {
      qb.andWhere('userRole.roleId = :roleId', { roleId: query.roleId });
    }

    if (query.roleName) {
      qb.andWhere('role.name = :roleName', { roleName: query.roleName });
    }

    return qb.getMany();
  }

  async assignRole(dto: AssignRoleDto): Promise<UserRole> {
    const existing = await this.userRolesRepository.findOne({
      where: { userId: dto.userId, roleId: dto.roleId },
    });

    if (existing) {
      throw new ConflictException('Role already assigned to this user.');
    }

    const userRole = this.userRolesRepository.create({
      userId: dto.userId,
      roleId: dto.roleId,
    });
    return this.userRolesRepository.save(userRole);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRolesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User role assignment with id ${id} not found.`);
    }
  }
}

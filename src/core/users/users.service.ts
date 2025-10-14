import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { createHash } from 'node:crypto';
import { User } from './user.entity';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(query: FindUsersQueryDto): Promise<User[]> {
    const limit = query.limit ?? 25;
    const qb = this.buildRelationsQuery(limit);

    if (query.cursor) {
      qb.andWhere('user.id < :cursor', { cursor: query.cursor });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      const normalized = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.username) LIKE :search OR LOWER(user.email) LIKE :search)',
        { search: normalized },
      );
    }

    return qb.getMany();
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: {
        userRoles: { role: true },
        wallet: true,
      },
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = dto.password
      ? createHash('sha256').update(dto.password).digest('hex')
      : null;

    const user = this.usersRepository.create({
      username: dto.username,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      name: dto.name ?? null,
      bio: dto.bio ?? null,
      city: dto.city ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      passwordHash,
      isActive: dto.isActive ?? true,
    });

    return this.usersRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (dto.email !== undefined) {
      user.email = dto.email ?? null;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone ?? null;
    }
    if (dto.name !== undefined) {
      user.name = dto.name ?? null;
    }
    if (dto.bio !== undefined) {
      user.bio = dto.bio ?? null;
    }
    if (dto.city !== undefined) {
      user.city = dto.city ?? null;
    }
    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl ?? null;
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }
    if (dto.password) {
      user.passwordHash = createHash('sha256')
        .update(dto.password)
        .digest('hex');
    }

    if (dto.username) {
      user.username = dto.username;
    }

    return this.usersRepository.save(user);
  }

  private buildRelationsQuery(limit: number): SelectQueryBuilder<User> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .orderBy('user.createdAt', 'DESC')
      .take(limit);
  }
}

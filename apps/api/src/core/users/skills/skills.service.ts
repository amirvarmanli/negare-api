// apps/api/src/core/users/skills/skills.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { SkillMapper } from './skill.mapper';
import { SkillListResultDto, SkillDto } from './dtos/skill-response.dto';
import { SkillCreateDto } from './dtos/skill-create.dto';
import { SkillUpdateDto } from './dtos/skill-update.dto';
import { SkillQueryDto } from './dtos/skill-query.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CRUD روی خود Skill
  // =========================================================

  async create(dto: SkillCreateDto): Promise<SkillDto> {
    const created = await this.prisma.skill.create({
      data: {
        key: dto.key,
        nameFa: dto.nameFa,
        nameEn: dto.nameEn ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return SkillMapper.toDto(created);
  }

  async update(id: string, dto: SkillUpdateDto): Promise<SkillDto> {
    const existing = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Skill not found');
    }

    const updated = await this.prisma.skill.update({
      where: { id },
      data: {
        key: dto.key ?? existing.key,
        nameFa: dto.nameFa ?? existing.nameFa,
        nameEn: dto.nameEn ?? existing.nameEn,
        description: dto.description ?? existing.description,
        isActive: dto.isActive ?? existing.isActive,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
      },
    });

    return SkillMapper.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    // بعداً اگر soft-delete خواستی، اینجا می‌تونی isActive رو false کنی به جای delete
    await this.prisma.skill.delete({
      where: { id },
    });
  }

  async findAll(q: SkillQueryDto): Promise<SkillListResultDto> {
    const filters: Prisma.SkillWhereInput[] = [];

    if (q.q && q.q.trim()) {
      const term = q.q.trim();
      filters.push({
        OR: [
          { nameFa: { contains: term, mode: 'insensitive' } },
          { nameEn: { contains: term, mode: 'insensitive' } },
          { key: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (q.isActive !== undefined) {
      // isActive در DTO به صورت string ("true"/"false") است
      const flag = q.isActive === 'true';
      filters.push({ isActive: flag });
    }

    const where: Prisma.SkillWhereInput | undefined =
      filters.length > 0 ? { AND: filters } : undefined;

    const rows = await this.prisma.skill.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });

    return {
      items: rows.map((row) => SkillMapper.toDto(row)),
    };
  }

  async findPublicActive(): Promise<SkillListResultDto> {
    const rows = await this.prisma.skill.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });

    return {
      items: rows.map((row) => SkillMapper.toDto(row)),
    };
  }

  // =========================================================
  // مهارت‌های کاربر (User ↔ Skill)
  // =========================================================

  /** چک می‌کنیم یوزر با این id وجود داشته باشه */
  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * متد داخلی: گرفتن مهارت‌های یک کاربر بر اساس userId
   * همه‌جا از همین استفاده می‌کنیم (چه me، چه by-id، چه by-username)
   */
  private async getUserSkillsInternal(
    userId: string,
  ): Promise<SkillListResultDto> {
    await this.ensureUserExists(userId);

    const links = await this.prisma.userSkill.findMany({
      where: { userId },
      select: { skillId: true },
    });

    if (links.length === 0) {
      return { items: [] };
    }

    const skillIds = links.map((l) => l.skillId);

    const skills = await this.prisma.skill.findMany({
      where: { id: { in: skillIds } },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });

    return {
      items: skills.map((row) => SkillMapper.toDto(row)),
    };
  }

  /**
   * گرفتن مهارت‌های یک کاربر بر اساس userId
   * (مسیر /users/skills/me و /users/skills/by-id/:userId از این استفاده می‌کنند)
   */
  async getUserSkillsById(userId: string): Promise<SkillListResultDto> {
    return this.getUserSkillsInternal(userId);
  }

  /**
   * گرفتن مهارت‌های کاربر بر اساس username
   * (برای پروفایل عمومی هنرمندان)
   */
  async getUserSkillsByUsername(username: string): Promise<SkillListResultDto> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.getUserSkillsInternal(user.id);
  }

  // -----------------------
  // ست کردن مهارت‌های یوزر
  // -----------------------

  /**
   * متد داخلی: تنظیم مهارت‌های کاربر بر اساس userId و skillIds
   */
  private async setUserSkillsByIds(
    userId: string,
    skillIds: string[],
  ): Promise<SkillListResultDto> {
    await this.ensureUserExists(userId);

    // همه ارتباط‌های قبلی رو پاک کن
    await this.prisma.userSkill.deleteMany({
      where: { userId },
    });

    // اگر لیست خالی نبود، جدیدها رو ست کن
    if (skillIds.length > 0) {
      await this.prisma.userSkill.createMany({
        data: skillIds.map((skillId) => ({
          userId,
          skillId,
        })),
        skipDuplicates: true,
      });
    }

    // لیست نهایی مهارت‌های این کاربر
    return this.getUserSkillsInternal(userId);
  }

  /**
   * تنظیم مهارت‌های کاربر بر اساس userId و skillKeys
   * - سمت فرانت فقط با key کار می‌کنی
   * - اینجا keyها به id تبدیل می‌شن
   */
  async setUserSkillsByUserIdAndKeys(
    userId: string,
    skillKeys: string[],
  ): Promise<SkillListResultDto> {
    await this.ensureUserExists(userId);

    if (!skillKeys || skillKeys.length === 0) {
      // اگر خالی بود فقط همه مهارت‌ها رو پاک کن
      return this.setUserSkillsByIds(userId, []);
    }

    const skills = await this.prisma.skill.findMany({
      where: { key: { in: skillKeys } },
    });

    const foundKeys = new Set(skills.map((s) => s.key));
    const missing = skillKeys.filter((k) => !foundKeys.has(k));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Some skills not found for keys: ${missing.join(', ')}`,
      );
    }

    const skillIds = skills.map((s) => s.id);
    return this.setUserSkillsByIds(userId, skillIds);
  }

  /**
   * تنظیم مهارت‌های یک کاربر بر اساس username و skillKeys
   * (ویژه ادمین یا سرویس‌هایی که با username کار می‌کنند)
   */
  async setUserSkillsByUsernameAndKeys(
    username: string,
    skillKeys: string[],
  ): Promise<SkillListResultDto> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.setUserSkillsByUserIdAndKeys(user.id, skillKeys);
  }
}

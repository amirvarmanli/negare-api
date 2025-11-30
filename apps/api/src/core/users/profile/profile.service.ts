// apps/api/src/core/profile/profile.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Prisma as PrismaNS } from '@prisma/client';
import { PrismaService, PrismaTxClient } from '@app/prisma/prisma.service';
import { UpdateProfileDto } from '@app/core/users/profile/dto/update-profile.dto';

// قوانین نام‌کاربری (قبلاً ساختیم)
import {
  USERNAME_MIN,
  USERNAME_MAX,
  USERNAME_REGEX,
  RESERVED_USERNAMES,
} from '@app/core/users/profile/username.rules';

type RoleSlim = { id: string; name: string };

type SkillSlim = {
  id: string;
  key: string;
  nameFa: string;
  nameEn: string | null;
  isActive: boolean;
  sortOrder: number;
};

type ProfileRecord = PrismaNS.UserGetPayload<{
  select: {
    id: true;
    username: true;
    name: true;
    email: true;
    phone: true;
    bio: true;
    city: true;
    avatarUrl: true;
    createdAt: true;
    updatedAt: true;
    userRoles: { select: { role: { select: { id: true; name: true } } } };
    skills: {
      select: {
        skill: {
          select: {
            id: true;
            key: true;
            nameFa: true;
            nameEn: true;
            isActive: true;
            sortOrder: true;
          };
        };
      };
    };
  };
}>;

type UsernameAvailability =
  | { ok: true; available: true; username: string }
  | { ok: true; available: false; username: string; reason: string }
  | { ok: false; available: false; username: string; reason: string };

@Injectable()
export class ProfileService {
  protected static readonly profileSelect = {
    id: true,
    username: true,
    name: true,
    email: true,
    phone: true,
    bio: true,
    city: true,
    avatarUrl: true,
    createdAt: true,
    updatedAt: true,
    userRoles: { select: { role: { select: { id: true, name: true } } } },
    skills: {
      select: {
        skill: {
          select: {
            id: true,
            key: true,
            nameFa: true,
            nameEn: true,
            isActive: true,
            sortOrder: true,
          },
        },
      },
    },
  } as const;

  private static readonly contactChangeError =
    'برای تغییر ایمیل یا موبایل لطفاً از مسیر تایید OTP استفاده کنید.';

  // فقط تامین‌کننده‌ها اجازه‌ی داشتن/ویرایش مهارت دارند
  private static readonly SUPPLIER_ROLE_NAME = 'supplier';

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────────────────
  // Public APIs
  // ────────────────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ProfileService.profileSelect,
    });

    if (!user) {
      throw new NotFoundException('پروفایل کاربر یافت نشد');
    }

    return this.serialize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email !== undefined || dto.phone !== undefined) {
      throw new BadRequestException(ProfileService.contactChangeError);
    }

    const data: PrismaNS.UserUpdateInput = {
      name: this.normalizeNullable(dto.name),
      bio: this.normalizeNullable(dto.bio),
      city: this.normalizeNullable(dto.city),
      avatarUrl: this.normalizeNullable(dto.avatarUrl),
    };

    try {
      const updated = await this.prisma.$transaction(async (trx) => {
        // اول پروفایل را آپدیت می‌کنیم
        const user = await trx.user.update({
          where: { id: userId },
          data,
          select: ProfileService.profileSelect,
        });

        const roles: RoleSlim[] =
          user.userRoles
            ?.map((ur: ProfileRecord['userRoles'][number]) => ur.role)
            .filter(
              (role: RoleSlim | null | undefined): role is RoleSlim =>
                Boolean(role),
            ) ?? [];

        const isSupplier = roles.some(
          (role) => role.name === ProfileService.SUPPLIER_ROLE_NAME,
        );

        // فقط اگر skillIds واقعاً به‌صورت آرایه فرستاده شده باشد، و کاربر تامین‌کننده باشد
        if (Array.isArray(dto.skillIds)) {
          if (!isSupplier) {
            throw new BadRequestException(
              'فقط تامین‌کنندگان می‌توانند مهارت‌های خود را ویرایش کنند.',
            );
          }

          await this.syncUserSkills(trx, userId, dto.skillIds);
        }

        // چون مهارت‌ها را در جدول pivot آپدیت کردیم، برای بازگشت پاسخ دقیق، پروفایل را دوباره می‌خوانیم
        const reloaded = await trx.user.findUnique({
          where: { id: userId },
          select: ProfileService.profileSelect,
        });

        if (!reloaded) {
          throw new NotFoundException('پروفایل کاربر یافت نشد');
        }

        return reloaded;
      });

      return this.serialize(updated);
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('پروفایل کاربر یافت نشد');
      }
      throw error;
    }
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    const data: PrismaNS.UserUpdateInput = {
      avatarUrl: this.normalizeNullable(avatarUrl),
    };

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true },
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error;
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('پروفایل کاربر یافت نشد');
      }
      throw error;
    }
  }

  /**
   * چک سریع اعتبار و موجودبودن نام‌کاربری
   */
  async checkUsernameAvailability(raw: string): Promise<UsernameAvailability> {
    const username = this.normalizeUsername(raw);

    // اعتبارسنجی اولیه
    if (!username) {
      return {
        ok: false,
        available: false,
        username,
        reason: 'نام کاربری نمی‌تواند خالی باشد.',
      };
    }
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return {
        ok: false,
        available: false,
        username,
        reason: `طول نام کاربری باید بین ${USERNAME_MIN} تا ${USERNAME_MAX} باشد.`,
      };
    }
    if (!USERNAME_REGEX.test(username)) {
      return {
        ok: false,
        available: false,
        username,
        reason:
          'فقط حروف انگلیسی، عدد و زیرخط مجاز است؛ با زیرخط شروع/تمام نشود و زیرخط‌های متوالی نداشته باشد.',
      };
    }

    // رزروها
    if (RESERVED_USERNAMES.has(username)) {
      return {
        ok: true,
        available: false,
        username,
        reason: 'این نام کاربری رزرو شده و قابل استفاده نیست.',
      };
    }

    // یونیک بودن (CITEXT در DB)
    const exists = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (exists) {
      return {
        ok: true,
        available: false,
        username,
        reason: 'این نام کاربری قبلاً گرفته شده است.',
      };
    }

    return { ok: true, available: true, username };
  }

  /**
   * تغییر نام‌کاربری کاربر
   */
  async updateUsername(userId: string, raw: string) {
    const check = await this.checkUsernameAvailability(raw);

    if (!check.ok) {
      const reason =
        'reason' in check ? check.reason : 'نام کاربری نامعتبر است.';
      throw new BadRequestException({
        code: 'InvalidUsername',
        message: reason,
      });
    }
    if (!check.available) {
      const reason =
        'reason' in check ? check.reason : 'این نام کاربری قابل استفاده نیست.';
      throw new BadRequestException({
        code: 'UsernameTakenOrReserved',
        message: reason,
      });
    }

    // اعمال تغییر
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { username: check.username } satisfies PrismaNS.UserUpdateInput,
      select: ProfileService.profileSelect,
    });

    return this.serialize(updated);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  private serialize(user: ProfileRecord) {
    const roles: RoleSlim[] =
      user.userRoles
        ?.map((ur: ProfileRecord['userRoles'][number]) => ur.role)
        .filter((role: RoleSlim | null | undefined): role is RoleSlim =>
          Boolean(role),
        ) ?? [];

    const isSupplier = roles.some(
      (role) => role.name === ProfileService.SUPPLIER_ROLE_NAME,
    );

    const skills: SkillSlim[] =
      isSupplier && user.skills
        ? user.skills
            .map((us) => us.skill)
            .filter(
              (skill: SkillSlim | null | undefined): skill is SkillSlim =>
                Boolean(skill),
            )
        : [];

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      city: user.city,
      avatarUrl: user.avatarUrl,
      roles,
      skills,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeNullable(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeUsername(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw.trim().toLowerCase();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Skills sync (UserSkill pivot)
  // ────────────────────────────────────────────────────────────────────────────

  private async syncUserSkills(
    trx: PrismaTxClient,
    userId: string,
    skillIds: string[],
  ): Promise<void> {
    // اگر آرایه خالی بود → همه مهارت‌ها پاک می‌شوند
    if (skillIds.length === 0) {
      await trx.userSkill.deleteMany({
        where: { userId },
      });
      return;
    }

    // چک کنیم همه‌ی skillها معتبر و active باشند
    const skills = await trx.skill.findMany({
      where: {
        id: { in: skillIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validIds = new Set(skills.map((s) => s.id));
    const missing = skillIds.filter((id) => !validIds.has(id));

    if (missing.length > 0) {
      throw new BadRequestException('برخی مهارت‌ها نامعتبر یا غیرفعال هستند.');
    }

    // پاک کردن روابط قبلی
    await trx.userSkill.deleteMany({
      where: { userId },
    });

    // ساختن روابط جدید
    await trx.userSkill.createMany({
      data: skillIds.map((skillId) => ({
        userId,
        skillId,
      })),
      skipDuplicates: true,
    });
  }
}

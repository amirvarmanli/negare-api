/**
 * RolesGuard (TEMP DISABLED)
 *
 * فعلاً سیستم نقش‌ها (RBAC) غیرفعال شده و این گارد
 * همیشه اجازه‌ی دسترسی می‌دهد.
 *
 * بعداً که نقش‌ها و سطح دسترسی‌ها را دقیق طراحی کردیم
 * می‌توانیم لاجیک قبلی را (یا نسخه‌ی بهتر) دوباره برگردانیم.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * در حالت فعلی، برای همهٔ درخواست‌ها true برمی‌گردانیم
   * و هیچ چک نقشی انجام نمی‌شود.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

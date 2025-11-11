import { ForbiddenException } from '@nestjs/common';
import { CurrentUserPayload } from '@app/common/decorators/current-user.decorator';

export function requireUserId(
  user: CurrentUserPayload | undefined,
): string {
  if (!user) {
    throw new ForbiddenException('Authentication required.');
  }
  return user.id;
}

import { PrismaService } from '@app/prisma/prisma.service';
import { OtpChannel } from '@prisma/client';

export interface UserLookup {
  exists(channel: OtpChannel, normalizedIdentifier: string): Promise<boolean>;
}

export const UserLookupProvider = {
  provide: 'UserLookup',
  useFactory: (prisma: PrismaService): UserLookup => ({
    async exists(
      channel: OtpChannel,
      normalizedIdentifier: string,
    ): Promise<boolean> {
      if (channel === OtpChannel.sms) {
        const u = await prisma.user.findFirst({
          where: { phone: normalizedIdentifier }, // ← اگر فیلد شما چیز دیگری است اینجا اصلاح کن
          select: { id: true },
        });
        return !!u;
      }
      const u = await prisma.user.findFirst({
        where: { email: normalizedIdentifier },
        select: { id: true },
      });
      return !!u;
    },
  }),
  inject: [PrismaService],
};

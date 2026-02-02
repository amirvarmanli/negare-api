import { Module } from '@nestjs/common';
import { AdminCreditsController } from '@app/finance/credits/admin-credits.controller';
import { CreditsService } from '@app/finance/credits/credits.service';

@Module({
  controllers: [AdminCreditsController],
  providers: [CreditsService],
})
export class CreditsModule {}

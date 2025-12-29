import { Module } from '@nestjs/common';
import { EntitlementsService } from '@app/finance/entitlements/entitlements.service';

@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}

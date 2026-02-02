import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from '@app/finance/wallet/wallet.service';
import { WalletController } from '@app/finance/wallet/wallet.controller';
import { PaymentsModule } from '@app/finance/payments/payments.module';
import { NotificationsModule } from '@app/notifications/notifications.module';

@Module({
  imports: [forwardRef(() => PaymentsModule), NotificationsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

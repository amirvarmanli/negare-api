import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Kavenegar = require('kavenegar');
import { SmsService } from '@app/sms/sms.service';

@Module({
  imports: [ConfigModule],
  providers: [
    SmsService,
    {
      provide: 'KAVENEGAR_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const key = config.get<string>('KAVENEGAR_API_KEY');
        if (!key) throw new Error('KAVENEGAR_API_KEY not found');
        return Kavenegar.KavenegarApi({ apikey: key });
      },
    },
  ],

  exports: [SmsService],
})
export class SmsModule {}

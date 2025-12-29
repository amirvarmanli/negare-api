import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const zibalEnvSchema = z.object({
  ZIBAL_MERCHANT: z.string().min(1, {
    message: 'ZIBAL_MERCHANT must be provided',
  }),
  ZIBAL_BASE_URL: z.string().url().default('https://gateway.zibal.ir'),
  ZIBAL_CALLBACK_URL: z
    .string()
    .url({ message: 'ZIBAL_CALLBACK_URL must be a valid URL' }),
});

export type ZibalEnv = z.infer<typeof zibalEnvSchema>;

export interface ZibalConfig {
  merchant: string;
  baseUrl: string;
  callbackUrl: string;
}

export const zibalConfig = registerAs('zibal', (): ZibalConfig => {
  const raw = zibalEnvSchema.parse(process.env);

  return {
    merchant: raw.ZIBAL_MERCHANT,
    baseUrl: raw.ZIBAL_BASE_URL,
    callbackUrl: raw.ZIBAL_CALLBACK_URL,
  };
});

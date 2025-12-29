import type { ConfigService } from '@nestjs/config';
import type { AllConfig } from '@app/config/config.module';

export const buildApiBaseUrl = (
  config: ConfigService<AllConfig>,
): string => {
  const base =
    config.get<string>('API_PUBLIC_BASE_URL') ??
    config.get<string>('API_BASE_URL') ??
    'http://localhost:4000';
  const prefix = config.get<string>('GLOBAL_PREFIX') ?? 'api';
  const normalizedBase = base.replace(/\/+$/g, '');
  if (!prefix) {
    return `${normalizedBase}/`;
  }
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
  if (normalizedBase.endsWith(`/${normalizedPrefix}`)) {
    return `${normalizedBase}/`;
  }
  return new URL(`/${normalizedPrefix}/`, `${normalizedBase}/`).toString();
};

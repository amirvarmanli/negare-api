export const REFRESH_ALLOW_PREFIX = 'auth:refresh:allow:';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export interface RefreshAllowRecord {
  userId: string;
  sessionId: string | null;
}

export const refreshAllowKey = (jti: string): string =>
  `${REFRESH_ALLOW_PREFIX}${jti}`;

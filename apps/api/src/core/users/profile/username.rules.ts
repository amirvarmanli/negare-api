export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
// بدون _ اول/آخر، بدون __ متوالی (سخت‌گیرانه‌تر و تمیزتر)
export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'root',
  'system',
  'support',
  'help',
  'contact',
  'negare',
  'api',
  'docs',
  'blog',
  'news',
  'about',
  'login',
  'signup',
]);

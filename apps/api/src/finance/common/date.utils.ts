const TEHRAN_TZ = 'Asia/Tehran';
const BERLIN_TZ = 'Europe/Berlin';

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  const hour = Number(lookup.hour);
  const minute = Number(lookup.minute);
  const second = Number(lookup.second);

  const zonedAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (zonedAsUtc - date.getTime()) / 60000;
}

export function getTehranDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getTehranResetAt(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(nextDayUtc, TEHRAN_TZ);
  return new Date(
    Date.UTC(year, month - 1, day + 1, 0, 0, 0) - offsetMinutes * 60_000,
  );
}

export function getTehranDayBounds(date: Date = new Date()): {
  dateKey: string;
  start: Date;
  end: Date;
} {
  const dateKey = getTehranDateKey(date);
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const startOffset = getTimeZoneOffsetMinutes(startUtc, TEHRAN_TZ);
  const start = new Date(startUtc.getTime() - startOffset * 60_000);

  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  const nextOffset = getTimeZoneOffsetMinutes(nextDayUtc, TEHRAN_TZ);
  const end = new Date(nextDayUtc.getTime() - nextOffset * 60_000 - 1);

  return { dateKey, start, end };
}

export function getBerlinDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getBerlinResetAt(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(nextDayUtc, BERLIN_TZ);
  return new Date(
    Date.UTC(year, month - 1, day + 1, 0, 0, 0) - offsetMinutes * 60_000,
  );
}

export function parseTehranDateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+03:30`);
}

export function buildMonthDateKeyRange(year: number, month: number): {
  startKey: string;
  endKey: string;
} {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  const startKey = getTehranDateKey(start);
  const endKey = getTehranDateKey(end);

  return { startKey, endKey };
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const currentMonth = next.getMonth();
  next.setMonth(currentMonth + months);
  return next;
}

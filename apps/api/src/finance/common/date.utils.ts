const TEHRAN_TZ = 'Asia/Tehran';

export function getTehranDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
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

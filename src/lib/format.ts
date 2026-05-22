/** Fixed-locale formatters to avoid SSR/client hydration mismatches. */

const NUMBER_LOCALE = 'en-US';

export function formatCount(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE).format(value);
}

export function formatLogTimestamp(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

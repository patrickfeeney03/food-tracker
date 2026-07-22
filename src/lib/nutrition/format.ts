import { formatStoredValue } from './math';

type StoredAmountUnit = 'mg' | 'ul';

const integerFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 0
});

export function formatKcal(value: number): string {
  return integerFormatter.format(
    Number(formatStoredValue(BigInt(value), 0))
  );
}

export function formatGrams(value: number, fractionalDigits = 1): string {
  return formatStoredValue(BigInt(value), fractionalDigits);
}

export function formatAmount(value: number, unit: StoredAmountUnit): string {
  const displayUnit = unit === 'mg' ? 'g' : 'ml';
  return `${formatStoredValue(BigInt(value), 3)} ${displayUnit}`;
}

export function formatDate(
  date: string | Date,
  options: { year?: boolean; time?: boolean } = {}
): string {
  const value = typeof date === 'string'
    ? dateFromCalendarString(date)
    : date;

  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    ...(options.year === false ? {} : { year: 'numeric' }),
    ...(options.time === true ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(value);
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, { time: true });
}

function dateFromCalendarString(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

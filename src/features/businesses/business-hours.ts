// Open/closed computation for businesses based on their weekly working hours.
// All comparisons happen in the local Uzbekistan timezone (Asia/Tashkent, UTC+5,
// no daylight saving) so the result matches what residents experience.

const TZ = 'Asia/Tashkent';

export type DbWorkingHour = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  openTime: string | null; // "HH:MM"
  closeTime: string | null; // "HH:MM"
  isClosed: boolean | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Current weekday (0–6) and minutes-since-midnight in Asia/Tashkent. */
function nowInTashkent(now: Date): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  return {
    dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

/**
 * Whether a business is currently open. Returns false when there are no hours,
 * the day is marked closed, or the times are missing/invalid. Handles overnight
 * ranges (e.g. 22:00–02:00).
 */
export function computeIsOpen(hours: DbWorkingHour[], now: Date = new Date()): boolean {
  if (!hours || hours.length === 0) return false;

  const { dayOfWeek, minutes } = nowInTashkent(now);
  const today = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!today || today.isClosed) return false;

  const open = toMinutes(today.openTime);
  const close = toMinutes(today.closeTime);
  if (open == null || close == null || open === close) return false;

  // Normal same-day range.
  if (close > open) return minutes >= open && minutes < close;

  // Overnight range that wraps past midnight (e.g. 22:00–02:00).
  return minutes >= open || minutes < close;
}

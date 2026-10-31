import calendar from './holiday_calendar.json';

const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const solarHolidays: Record<string, string> = {
  '1-1': '🎉',
  '2-23': '🎂',
  '10-31': '🎃',
  '12-24': '🍎',
  '12-25': '🎄',
};

// Entries match the generator: Spring Festival, Lantern Festival, Dragon Boat,
// Qixi, Mid-Autumn, winter solstice. Regular lunar months only, never leap months.
const calendarEmojis = ['🧧', '🏮', '🍙', '💫', '🥮', '🥟'];

/** All users see the same holiday, regardless of their device's time zone. */
export function getHolidayEmoji(now: Date): string | null {
  const beijing = new Date(now.getTime() + BEIJING_OFFSET);
  const year = beijing.getUTCFullYear();
  const month = beijing.getUTCMonth() + 1;
  const day = beijing.getUTCDate();

  // Fixed dates (including the community birthday) win if festivals coincide.
  const fixed = solarHolidays[`${month}-${day}`];
  if (fixed) return fixed;

  const dates = (calendar as Record<string, number[]>)[year];
  const index = dates?.indexOf(month * 100 + day) ?? -1;
  return calendarEmojis[index] ?? null;
}

/** A daily timer, with a small margin past midnight to avoid early firing. */
export function millisecondsUntilBeijingMidnight(now: Date): number {
  const elapsed = (now.getTime() + BEIJING_OFFSET) % DAY;
  return DAY - elapsed + 50;
}

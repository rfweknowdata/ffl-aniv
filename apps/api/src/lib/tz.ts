import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { config } from '../config.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function todayInTz(): { month: number; day: number; year: number } {
  const now = dayjs().tz(config.timezone);
  return { month: now.month() + 1, day: now.date(), year: now.year() };
}

export function toTz(date: Date) {
  return dayjs(date).tz(config.timezone);
}

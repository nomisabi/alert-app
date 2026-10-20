import { subHours, subSeconds } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { formatDate, formatTimeAgo } from './date';

describe('formatDate', () => {
  const date = new Date('2026-10-19T22:30:00Z');

  it('formats with the default pattern', () => {
    expect(formatDate(date, 'PP', 'UTC')).toBe('Oct 19, 2026');
  });

  it('formats in the given time zone', () => {
    // 22:30 UTC is already the next day in Budapest (UTC+2 in October)
    expect(formatDate(date, 'yyyy-MM-dd HH:mm', 'Europe/Budapest')).toBe('2026-10-20 00:30');
  });
});

describe('formatTimeAgo', () => {
  it('says how long ago a date was', () => {
    expect(formatTimeAgo(subHours(new Date(), 2))).toBe('about 2 hours ago');
    expect(formatTimeAgo(subSeconds(new Date(), 10).toISOString())).toBe('less than a minute ago');
  });
});

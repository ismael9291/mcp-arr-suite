import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, truncate, paginate, clampLimit, clampOffset, daysFromNow, today } from '../../../src/shared/formatting.js';

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1_048_576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1_073_741_824)).toBe('1 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1_099_511_627_776)).toBe('1 TB');
  });

  it('formats fractional values', () => {
    expect(formatBytes(1_536)).toBe('1.5 KB');
  });

  it('formats large values with two decimal places max', () => {
    const result = formatBytes(15_728_640_000);
    expect(result).toMatch(/^\d+\.\d{1,2} GB$/);
  });
});

describe('truncate', () => {
  it('returns undefined for undefined', () => {
    expect(truncate(undefined)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(truncate(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(truncate('')).toBeUndefined();
  });

  it('returns the original string when it fits within maxLen', () => {
    const short = 'A short overview.';
    expect(truncate(short, 300)).toBe(short);
  });

  it('truncates at maxLen and appends ellipsis', () => {
    const text = 'a'.repeat(400);
    const result = truncate(text, 300);
    expect(result).toBe('a'.repeat(300) + '…');
  });

  it('uses default maxLen of 300', () => {
    const text = 'a'.repeat(350);
    const result = truncate(text);
    expect(result).toHaveLength(301); // 300 chars + '…'
  });

  it('does not truncate text exactly at the limit', () => {
    const text = 'a'.repeat(300);
    expect(truncate(text, 300)).toBe(text);
  });
});

describe('paginate', () => {
  const items = ['a', 'b', 'c'];

  it('fills the standard envelope fields', () => {
    const result = paginate(items, 10, 0, 3);
    expect(result).toMatchObject({
      total: 10,
      returned: 3,
      offset: 0,
      limit: 3,
      items,
    });
  });

  it('sets hasMore true when more items remain', () => {
    const result = paginate(items, 10, 0, 3);
    expect(result.hasMore).toBe(true);
  });

  it('sets hasMore false when on the last page', () => {
    const result = paginate(items, 3, 0, 10);
    expect(result.hasMore).toBe(false);
  });

  it('sets nextOffset to offset + returned when hasMore is true', () => {
    const result = paginate(items, 10, 4, 3);
    expect(result.nextOffset).toBe(7);
  });

  it('sets nextOffset to null when hasMore is false', () => {
    const result = paginate(items, 3, 0, 10);
    expect(result.nextOffset).toBeNull();
  });

  it('handles empty item array', () => {
    const result = paginate([], 0, 0, 25);
    expect(result).toMatchObject({ total: 0, returned: 0, hasMore: false, nextOffset: null, items: [] });
  });

  it('returns items reference unchanged', () => {
    const result = paginate(items, 10, 0, 3);
    expect(result.items).toBe(items);
  });
});

describe('clampLimit', () => {
  it('returns the value when within range', () => {
    expect(clampLimit(25)).toBe(25);
  });

  it('clamps to 1 when below minimum', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });

  it('clamps to max when above maximum', () => {
    expect(clampLimit(200)).toBe(100);
  });

  it('respects a custom max', () => {
    expect(clampLimit(50, 25)).toBe(25);
    expect(clampLimit(10, 25)).toBe(10);
  });
});

describe('clampOffset', () => {
  it('returns the value for non-negative input', () => {
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(50)).toBe(50);
  });

  it('clamps negative offsets to 0', () => {
    expect(clampOffset(-1)).toBe(0);
    expect(clampOffset(-100)).toBe(0);
  });
});

describe('daysFromNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a date string in ISO format (YYYY-MM-DD)', () => {
    const result = daysFromNow(7);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns correct date 7 days from now', () => {
    expect(daysFromNow(7)).toBe('2024-01-08');
  });

  it('returns correct date 0 days from now (today)', () => {
    expect(daysFromNow(0)).toBe('2024-01-01');
  });

  it('handles negative days (past)', () => {
    expect(daysFromNow(-1)).toBe('2023-12-31');
  });
});

describe('today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T23:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a date string in YYYY-MM-DD format', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the current UTC date', () => {
    expect(today()).toBe('2024-06-15');
  });
});

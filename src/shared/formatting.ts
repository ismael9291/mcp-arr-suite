/**
 * Shared formatting utilities.
 *
 * Centralised here so handlers stay lean and consistent.
 */

/** Convert bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Truncate a long string (e.g. overview/synopsis) to save context */
export function truncate(text: string | undefined | null, maxLen = 300): string | undefined {
  if (!text) return undefined;
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

/**
 * Wrap a paginated result set in a standard envelope.
 *
 * Every list tool uses this so the LLM always knows:
 *   - how many items exist in total
 *   - how many were returned
 *   - whether more pages exist
 *   - what offset to use next
 */
export function paginate<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number
): PaginatedResult<T> {
  return {
    total,
    returned: items.length,
    offset,
    limit,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length < total ? offset + items.length : null,
    items,
  };
}

export interface PaginatedResult<T> {
  total: number;
  returned: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  items: T[];
}

/** Clamp a limit value to [1, max] */
export function clampLimit(limit: number, max = 100): number {
  return Math.max(1, Math.min(limit, max));
}

/** Clamp an offset value to >= 0 */
export function clampOffset(offset: number): number {
  return Math.max(0, offset);
}

/** Build a ISO date string N days from now */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** Today's date as ISO string */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

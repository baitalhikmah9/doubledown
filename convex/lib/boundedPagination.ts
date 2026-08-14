/**
 * Bounded index-scan pagination for admin list queries.
 *
 * Convex cannot substring-search, so list queries that filter on non-indexed
 * fields (type/source/status/search text) walk a timestamp index in pages and
 * apply the filter in memory. The scan is capped so a single request never
 * collects an unbounded number of rows.
 */

export const SCAN_BATCH = 100;
/** ponytail: hard cap on rows scanned per request; heavy filters trade completeness for bounded latency. */
export const MAX_SCAN_ROWS = 2_000;

export type BoundedPage<T> = { items: T[]; nextCursor: number | null };

/**
 * Scan a timestamp-ordered index in descending batches, keeping rows that
 * `matches` accepts until `limit` items are collected or the scan cap is hit.
 *
 * `fetchBatch(upperBound)` returns at most SCAN_BATCH rows strictly older than
 * `upperBound` (or the caller's own initial bound when `upperBound` is
 * undefined). `timestampOf` must return the index field used for ordering.
 *
 * `nextCursor` semantics (all bounds are exclusive, so the next page starts
 * with `createdAt < nextCursor`):
 * - page filled mid-batch: the timestamp of the last row the matcher examined
 *   (the `limit`-th match). Rows after it in the fetched batch are re-examined
 *   by the next page, so no row is ever skipped.
 * - scan cap hit with fewer than `limit` matches: the newest timestamp of the
 *   last scanned batch. Every matching row in the scanned window is already in
 *   `items` and non-matching rows are deterministically excluded, so advancing
 *   past the window loses nothing.
 * - exhausted: null.
 */
export async function scanIndexPage<T>(
  fetchBatch: (upperBound: number | undefined) => Promise<T[]>,
  timestampOf: (row: T) => number,
  matches: (row: T) => boolean,
  limit: number,
  onBatch?: (rows: T[]) => Promise<void>
): Promise<BoundedPage<T>> {
  const items: T[] = [];
  let upperBound: number | undefined;
  let scanned = 0;
  let lastScannedTimestamp: number | null = null;
  let lastMatchedTimestamp: number | null = null;
  let exhausted = false;

  while (items.length < limit && scanned < MAX_SCAN_ROWS) {
    const rows = await fetchBatch(upperBound);
    if (rows.length === 0) {
      exhausted = true;
      break;
    }
    scanned += rows.length;
    lastScannedTimestamp = timestampOf(rows[rows.length - 1]);
    upperBound = lastScannedTimestamp;
    if (onBatch) {
      await onBatch(rows);
    }
    for (const row of rows) {
      if (matches(row)) {
        items.push(row);
        lastMatchedTimestamp = timestampOf(row);
        if (items.length >= limit) break;
      }
    }
  }

  const nextCursor = exhausted
    ? null
    : items.length >= limit
      ? lastMatchedTimestamp
      : lastScannedTimestamp;

  return { items: items.slice(0, limit), nextCursor };
}

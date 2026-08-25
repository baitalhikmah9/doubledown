import { describe, expect, it, jest } from '@jest/globals';
import { MAX_SCAN_ROWS, SCAN_BATCH, scanIndexPage } from '@/convex/lib/boundedPagination';

type Row = { id: string; createdAt: number };

function rowsOf(count: number, start: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row_${start - i}`,
    createdAt: start - i,
  }));
}

function fakeFetch(
  all: Row[],
  batchSize: number = SCAN_BATCH
): (upperBound: number | undefined) => Promise<Row[]> {
  const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
  return async (upperBound) => {
    const window = upperBound === undefined ? sorted : sorted.filter((r) => r.createdAt < upperBound);
    return window.slice(0, batchSize);
  };
}

describe('scanIndexPage', () => {
  it('returns the first page and a cursor when more rows remain', async () => {
    const rows = rowsOf(150, 150);
    const { items, nextCursor } = await scanIndexPage(
      fakeFetch(rows),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(items).toHaveLength(50);
    expect(items[0].id).toBe('row_150');
    expect(nextCursor).not.toBeNull();
  });

  it('pages to the end and returns null cursor when exhausted', async () => {
    const rows = rowsOf(250, 250);
    const fetch = fakeFetch(rows);
    const page1 = await scanIndexPage(fetch, (r) => r.createdAt, () => true, 50);
    expect(page1.items).toHaveLength(50);
    // Page 1 returns rows 250..201; the cursor is the last committed row (201),
    // not the oldest row of the fetched batch (151), so no rows are skipped.
    expect(page1.nextCursor).toBe(201);
    const page2 = await scanIndexPage(
      (upper) => fetch(upper ?? page1.nextCursor ?? undefined),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(page2.items).toHaveLength(50);
    expect(page2.nextCursor).toBe(151);
    const page3 = await scanIndexPage(
      (upper) => fetch(upper ?? page2.nextCursor ?? undefined),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(page3.items).toHaveLength(50);
    expect(page3.nextCursor).toBe(101);
    const page4 = await scanIndexPage(
      (upper) => fetch(upper ?? page3.nextCursor ?? undefined),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(page4.items).toHaveLength(50);
    expect(page4.nextCursor).toBe(51);
    const page5 = await scanIndexPage(
      (upper) => fetch(upper ?? page4.nextCursor ?? undefined),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(page5.items).toHaveLength(50);
    expect(page5.nextCursor).toBe(1);
    const page6 = await scanIndexPage(
      (upper) => fetch(upper ?? page5.nextCursor ?? undefined),
      (r) => r.createdAt,
      () => true,
      50
    );
    expect(page6.items).toHaveLength(0);
    expect(page6.nextCursor).toBeNull();
  });

  it('covers every row across consecutive unfiltered pages with no skips or duplicates', async () => {
    const rows = rowsOf(250, 250); // createdAt 250..1, already newest-first
    const fetch = fakeFetch(rows);
    const seen: number[] = [];
    let cursor: number | undefined;

    for (let page = 0; page < 10; page++) {
      const { items, nextCursor } = await scanIndexPage(
        (upper) => fetch(upper ?? cursor),
        (r) => r.createdAt,
        () => true,
        50
      );
      for (const item of items) seen.push(item.createdAt);
      if (nextCursor === null) break;
      cursor = nextCursor;
    }

    expect(seen).toEqual(rows.map((r) => r.createdAt).sort((a, b) => b - a));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('applies the in-memory filter while scanning', async () => {
    const rows = rowsOf(200, 200).map((r) =>
      r.createdAt % 2 === 0 ? { ...r, keep: true } : { ...r, keep: false }
    );
    const { items, nextCursor } = await scanIndexPage(
      // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
      fakeFetch(rows as any),
      (r) => r.createdAt,
      (r: any) => r.keep,
      5
    );
    expect(items).toHaveLength(5);
    expect(items.every((r: any) => r.keep)).toBe(true);
    // Filter rejected most rows, so a cursor is still emitted for honest paging.
    expect(nextCursor).not.toBeNull();
  });

  it('stops scanning at MAX_SCAN_ROWS and still emits a cursor', async () => {
    const fetch = jest.fn<(upperBound: number | undefined) => Promise<Row[]>>(async () =>
      rowsOf(SCAN_BATCH, MAX_SCAN_ROWS)
    );
    const { items, nextCursor } = await scanIndexPage(
      fetch,
      (r) => r.createdAt,
      () => false,
      10
    );
    expect(items).toHaveLength(0);
    expect(nextCursor).not.toBeNull();
    // MAX_SCAN_ROWS / SCAN_BATCH batches, no more.
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(MAX_SCAN_ROWS / SCAN_BATCH);
  });

  it('calls onBatch for each scanned batch before matching', async () => {
    const onBatch = jest.fn<(...args: unknown[]) => Promise<void>>(async () => {});
    const rows = rowsOf(10, 10);
    await scanIndexPage(fakeFetch(rows), (r) => r.createdAt, () => true, 5, onBatch);
    expect(onBatch).toHaveBeenCalled();
    expect(onBatch.mock.calls[0][0]).toHaveLength(10);
  });
});

import { describe, expect, it } from '@jest/globals';
import { buildBoard, getPlayableCategories } from '@/features/play/data';

describe('play question selection', () => {
  it('does not put previously asked questions on the next board', () => {
    const category = getPlayableCategories(['en'])[0]!;
    const firstBoard = buildBoard([category.slug]);
    const askedCanonicalKeys = new Set(firstBoard.map((question) => question.canonicalKey));
    const nextBoard = buildBoard([category.slug], ['en'], askedCanonicalKeys);

    expect(nextBoard).toHaveLength(firstBoard.length);
    expect(nextBoard.every((question) => !askedCanonicalKeys.has(question.canonicalKey))).toBe(true);
  });
});

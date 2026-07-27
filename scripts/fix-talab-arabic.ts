/**
 * Restore Arabic script in Talab-ul Ilm questions where placeholders were saved as "?".
 * Source CSV: QF full(Pre fosis).csv — that file also lacks Arabic (export corruption).
 *
 * Run: bun run tsx scripts/fix-talab-arabic.ts
 * Then: bun run seed:normalize
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ARABIC_PLACEHOLDER_REPLACEMENTS,
  restoreArabicPlaceholders,
} from './arabic-placeholder-map';

function countReplacements(before: string, after: string): number {
  let total = 0;
  for (const [from] of ARABIC_PLACEHOLDER_REPLACEMENTS) {
    total += before.split(from).length - 1;
  }
  void after;
  return total;
}

function applyReplacements(filePath: string): number {
  const before = fs.readFileSync(filePath, 'utf-8');
  const after = restoreArabicPlaceholders(before);
  if (before === after) {
    return 0;
  }

  const total = countReplacements(before, after);
  fs.writeFileSync(filePath, after, 'utf-8');
  return total;
}

const questionsPath = path.join(process.cwd(), 'constants', 'questions.json');
const replaced = applyReplacements(questionsPath);

const remaining = [...fs.readFileSync(questionsPath, 'utf-8').matchAll(/\([^)]*\?{2,}[^)]*\)/g)].map(
  (m) => m[0]
);

console.log(`Replaced ${replaced} corrupted Arabic placeholder(s) in constants/questions.json`);
if (remaining.length) {
  console.warn('Remaining parenthetical ? patterns:', [...new Set(remaining)]);
}

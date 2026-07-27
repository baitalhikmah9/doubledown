/**
 * Patch the QF source CSV with restored Arabic terms, writing UTF-8 output.
 *
 * Default input: ~/Downloads/QF full(Pre fosis).csv
 * Default output: constants/source-questions.csv (gitignored copy for imports)
 *
 * Run: bun run tsx scripts/patch-source-csv-arabic.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { restoreArabicPlaceholders } from './arabic-placeholder-map';

const defaultInput = path.join(os.homedir(), 'Downloads', 'QF full(Pre fosis).csv');
const inputPath = process.argv[2] ?? defaultInput;
const outputPath =
  process.argv[3] ?? path.join(process.cwd(), 'constants', 'source-questions.csv');

if (!fs.existsSync(inputPath)) {
  console.error(`Source CSV not found: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'latin1');
const lines = raw.split(/\r?\n/);
const header = lines[0] ?? '';
const body = lines.slice(1).map((line) => restoreArabicPlaceholders(line));
const patched = [header, ...body].join('\n');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, patched, 'utf-8');

const beforeTriple = (raw.match(/\?{3,}/g) ?? []).length;
const afterTriple = (patched.match(/\?{3,}/g) ?? []).length;

console.log(`Patched CSV written to ${outputPath}`);
console.log(`Triple+ ? runs: ${beforeTriple} → ${afterTriple}`);

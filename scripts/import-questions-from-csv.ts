/**
 * Import constants/questions.json from the QF trivia spreadsheet.
 * Deduplicates exact duplicate rows (same topic, prompt, answer, difficulty).
 * Applies Arabic placeholder restoration from scripts/arabic-placeholder-map.ts.
 *
 * Default CSV: ~/Downloads/QF full - Copy(No dupes).csv
 *
 * Run: bun run seed:import
 */
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { restoreArabicPlaceholders } from './arabic-placeholder-map';

interface CsvRow {
  userId: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
}

interface SourceQA {
  text: string;
  answer: string;
}

interface SourceGroup {
  id: string;
  questionAndanswer: SourceQA[];
  categoryId: string;
  name: string;
  points: number;
}

const DIFFICULTY_POINTS: Record<CsvRow['difficulty'], number> = {
  Easy: 100,
  Medium: 200,
  Hard: 300,
};

const DEFAULT_CSV = path.join(
  os.homedir(),
  'Downloads',
  'QF full - Copy(No dupes).csv'
);

function repairTopicName(topic: string): string {
  return topic.trim().replace(/^Kurulu\?: Osman$/, 'Kuruluş: Osman');
}

function repairText(text: string): string {
  return restoreArabicPlaceholders(text.trim());
}

/** Minimal RFC-style CSV parser (quoted fields, commas). */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // skip
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function loadCategoryMaps(questionsPath: string) {
  const categoryIdByTopic = new Map<string, string>();
  const groupIdByTopicPoints = new Map<string, string>();

  if (!fs.existsSync(questionsPath)) {
    return { categoryIdByTopic, groupIdByTopicPoints, nextGroupNum: 1 };
  }

  const existing = JSON.parse(fs.readFileSync(questionsPath, 'utf-8')) as SourceGroup[];
  let maxGroupNum = 0;

  for (const group of existing) {
    categoryIdByTopic.set(group.name, group.categoryId);
    groupIdByTopicPoints.set(`${group.name}|${group.points}`, group.id);
    const match = /^q_(\d+)$/.exec(group.id);
    if (match) {
      maxGroupNum = Math.max(maxGroupNum, Number(match[1]));
    }
  }

  return {
    categoryIdByTopic,
    groupIdByTopicPoints,
    nextGroupNum: maxGroupNum + 1,
  };
}

function assignCategoryId(topic: string, categoryIdByTopic: Map<string, string>): string {
  const existing = categoryIdByTopic.get(topic);
  if (existing) {
    return existing;
  }

  const prefix = topic.startsWith('ARK') || /^[A-Z]/.test(topic) && !topic.includes(':')
    ? 'g'
    : topic.includes('Century') || topic === 'Talab-ul Ilm' || topic.startsWith('WW')
      ? 'h'
      : topic.match(/Premier|Cricket|NBA|UFC|FIFA|Formula|UEFA|Which Player/)
        ? 's'
        : topic.match(/Naruto|Breaking|Marvel|Disney|Friends|Avatar|Dexter|Harry|Star|Game|Office|Peaky|Prison|Suits|Stranger|Sponge|James|Fast|How I|Dragon|One Piece|Pirates|Pokemon|Attack|Kurulu/)
          ? 'pc'
          : 'gen';

  let n = 1;
  const used = new Set(categoryIdByTopic.values());
  while (used.has(`${prefix}${n}`)) {
    n += 1;
  }
  const id = `${prefix}${n}`;
  categoryIdByTopic.set(topic, id);
  return id;
}

function writeCategoriesTs(groups: SourceGroup[]) {
  const categoriesPath = path.join(process.cwd(), 'constants', 'categories.ts');
  const byTopic = new Map<string, string>();
  for (const group of groups) {
    if (!byTopic.has(group.name)) {
      byTopic.set(group.name, group.categoryId);
    }
  }

  const entries = [...byTopic.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const lines = entries.map(
    ([name, id]) => `  { id: '${id}', name: ${JSON.stringify(name)} },`
  );

  const contents = `/**
 * Categories derived from constants/questions.json (via scripts/import-questions-from-csv.ts).
 * Slug format matches scripts/normalize-questions.ts (slugify of name).
 * Used when Convex is not seeded.
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Unique categories from questions.json: id, slug (for selection), title (English display) */
const RAW_CATEGORIES: { id: string; name: string }[] = [
${lines.join('\n')}
];

export const FALLBACK_CATEGORIES = RAW_CATEGORIES.map((c) => ({
  id: c.id,
  slug: slugify(c.name),
  title: c.name,
}));
`;

  fs.writeFileSync(categoriesPath, contents, 'utf-8');
  console.log(`Wrote ${entries.length} categories to ${categoriesPath}`);
}

function readCsvFile(csvPath: string): string {
  const buffer = fs.readFileSync(csvPath);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  return buffer.toString('latin1');
}

function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const questionsPath = path.join(process.cwd(), 'constants', 'questions.json');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const raw = readCsvFile(csvPath);
  const table = parseCsv(raw);
  const header = table[0];
  if (!header || header[0] !== 'UserID') {
    console.error('Unexpected CSV header:', header);
    process.exit(1);
  }

  const { categoryIdByTopic, groupIdByTopicPoints, nextGroupNum } =
    loadCategoryMaps(questionsPath);
  let groupCounter = nextGroupNum;

  const seen = new Set<string>();
  const buckets = new Map<string, SourceQA[]>();
  let skippedDupes = 0;

  for (const row of table.slice(1)) {
    if (row.length < 5) {
      continue;
    }
    const [userId, question, answer, difficulty, topic] = row;
    if (!question?.trim() || !topic?.trim()) {
      continue;
    }

    const repairedTopic = repairTopicName(topic);
    const diff = difficulty?.trim() as CsvRow['difficulty'];
    if (!(diff in DIFFICULTY_POINTS)) {
      console.warn(`Skipping row ${userId}: unknown difficulty ${difficulty}`);
      continue;
    }

    const prompt = repairText(question);
    const ans = repairText(answer);
    const dedupeKey = `${repairedTopic}\0${prompt}\0${ans}\0${diff}`;
    if (seen.has(dedupeKey)) {
      skippedDupes += 1;
      continue;
    }
    seen.add(dedupeKey);

    const points = DIFFICULTY_POINTS[diff];
    const bucketKey = `${repairedTopic}|${points}`;
    const list = buckets.get(bucketKey) ?? [];
    list.push({ text: prompt, answer: ans });
    buckets.set(bucketKey, list);
  }

  const groups: SourceGroup[] = [];
  const sortedBucketKeys = [...buckets.keys()].sort((a, b) => {
    const [topicA, pointsA] = a.split('|');
    const [topicB, pointsB] = b.split('|');
    const catA = categoryIdByTopic.get(topicA!) ?? topicA!;
    const catB = categoryIdByTopic.get(topicB!) ?? topicB!;
    if (catA !== catB) {
      return catA.localeCompare(catB);
    }
    if (topicA !== topicB) {
      return topicA!.localeCompare(topicB!);
    }
    return Number(pointsA) - Number(pointsB);
  });

  for (const bucketKey of sortedBucketKeys) {
    const [topic, pointsStr] = bucketKey.split('|');
    const points = Number(pointsStr);
    const categoryId = assignCategoryId(topic!, categoryIdByTopic);
    let id = groupIdByTopicPoints.get(bucketKey);
    if (!id) {
      id = `q_${groupCounter}`;
      groupCounter += 1;
    }

    groups.push({
      id,
      questionAndanswer: buckets.get(bucketKey)!,
      categoryId,
      name: topic!,
      points,
    });
  }

  fs.writeFileSync(questionsPath, `${JSON.stringify(groups, null, 2)}\n`, 'utf-8');
  writeCategoriesTs(groups);

  const totalQuestions = groups.reduce((n, g) => n + g.questionAndanswer.length, 0);
  const topics = new Set(groups.map((g) => g.name));

  console.log(`Imported ${totalQuestions} questions across ${topics.size} topics`);
  console.log(`Skipped ${skippedDupes} exact duplicate CSV rows`);
  console.log(`Wrote ${groups.length} groups to ${questionsPath}`);
}

main();

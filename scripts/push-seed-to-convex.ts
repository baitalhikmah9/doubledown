/**
 * Push convex/seed/*.json to a Convex deployment.
 *
 * Usage:
 *   bun run seed:push              # dev (from .env.local)
 *   bun run seed:push -- --prod    # production
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const seedDir = path.join(process.cwd(), 'convex', 'seed');
const QUESTION_BATCH_SIZE = 200;
const DEV_DEPLOYMENT = 'successful-wildcat-165';
const prod = process.argv.includes('--prod');

function deploymentArgs(push = false): string[] {
  if (prod) {
    return push ? ['--prod'] : ['--prod'];
  }
  return ['--deployment-name', DEV_DEPLOYMENT];
}

function runConvex(functionName: string, args: unknown, options?: { push?: boolean }) {
  const cliArgs = ['convex', 'run'];
  if (options?.push) {
    cliArgs.push('--push');
  }
  cliArgs.push(...deploymentArgs(), functionName, JSON.stringify(args));

  const result = spawnSync('bunx', cliArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`convex run ${functionName} failed:\n${detail}`);
  }

  return result.stdout.trim();
}

function pushCode() {
  if (!prod) {
    return;
  }

  const cliArgs = ['convex', 'deploy', '-y'];

  const result = spawnSync('bunx', cliArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error('convex deploy failed');
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function main() {
  const categories = JSON.parse(fs.readFileSync(path.join(seedDir, 'categories.json'), 'utf8'));
  const translations = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'categoryTranslations.json'), 'utf8')
  );
  const questions = JSON.parse(fs.readFileSync(path.join(seedDir, 'questions.json'), 'utf8'));

  const target = prod ? 'production (energized-hummingbird-439)' : `development (${DEV_DEPLOYMENT})`;
  console.log(`Pushing seed to ${target}...`);

  console.log('Deploying Convex functions...');
  pushCode();

  console.log(`Seeding ${categories.length} categories...`);
  runConvex('seed:seedCategories', { categories }, { push: !prod });

  console.log(`Seeding ${translations.length} category translations...`);
  runConvex('seed:seedCategoryTranslations', { translations });

  const activeSlugs = categories.map((category: { slug: string }) => category.slug);
  console.log('Retiring categories not in seed...');
  const retired = runConvex('seed:retireCategoriesNotInSeed', { activeSlugs });
  console.log(retired);

  const questionBatches = chunk(questions, QUESTION_BATCH_SIZE);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`Seeding ${questions.length} questions in ${questionBatches.length} batches...`);
  for (let i = 0; i < questionBatches.length; i += 1) {
    const batch = questionBatches[i];
    const result = runConvex('seed:seedQuestions', { questions: batch });
    const parsed = JSON.parse(result) as { inserted: number; updated: number; skipped: number };
    inserted += parsed.inserted;
    updated += parsed.updated;
    skipped += parsed.skipped;
    console.log(
      `  batch ${i + 1}/${questionBatches.length}: +${parsed.inserted} inserted, ${parsed.updated} updated, ${parsed.skipped} skipped`
    );
  }

  console.log('Seeding token products...');
  runConvex('seed:seedTokenProducts', {});

  console.log(
    `Done (${target}): ${inserted} inserted, ${updated} updated, ${skipped} skipped across ${questions.length} questions`
  );
}

main();

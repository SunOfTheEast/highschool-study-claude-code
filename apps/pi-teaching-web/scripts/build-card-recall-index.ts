import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export type CardRecallIndexRow = {
  path: string;
  goal: string[];
  method: string[];
  structure: string[];
  choice_count: number;
  part_count: number;
  stem: string;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, field: string, path: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: ${field} must be an object`);
  }
  return value as UnknownRecord;
}

function requiredString(value: unknown, field: string, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path}: ${field} must be a non-empty string`);
  }
  return value;
}

function optionalStringArray(value: unknown, field: string, path: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${path}: ${field} must be a string array`);
  }
  return value as string[];
}

function optionalRecordArray(value: unknown, field: string, path: string): UnknownRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${path}: ${field} must be an array`);
  }
  return value.map((item, index) => asRecord(item, `${field}[${index}]`, path));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export type LegacyCardSemanticProjection = {
  id: string;
  stem: string;
  core: string[];
  related: string[];
};

export function cardToRecallRow(card: unknown, path: string): CardRecallIndexRow {
  const root = asRecord(card, 'card', path);
  const graph = asRecord(root.graph, 'graph', path);
  const goal = asRecord(graph.goal, 'graph.goal', path);
  const method = asRecord(graph.method, 'graph.method', path);
  const structure = asRecord(graph.structure, 'graph.structure', path);
  const partLevel = optionalRecordArray(goal.part_level, 'graph.goal.part_level', path);
  const originalProblem = root.original_problem === undefined
    ? {}
    : asRecord(root.original_problem, 'original_problem', path);

  const goals = unique([
    requiredString(goal.primary, 'graph.goal.primary', path),
    ...partLevel.map((part, index) => (
      requiredString(part.goal, `graph.goal.part_level[${index}].goal`, path)
    )),
  ]);
  const methods = unique([
    requiredString(method.primary, 'graph.method.primary', path),
    ...optionalStringArray(method.secondary, 'graph.method.secondary', path),
  ]);
  const structures = unique([
    requiredString(structure.primary, 'graph.structure.primary', path),
    ...optionalStringArray(structure.secondary, 'graph.structure.secondary', path),
  ]);

  const explicitPartCount = countArray(originalProblem.parts) || countArray(root.parts);

  return {
    path,
    goal: goals,
    method: methods,
    structure: structures,
    choice_count: countArray(originalProblem.choices) || countArray(root.choices),
    part_count: partLevel.length || explicitPartCount || 1,
    stem: requiredString(root.stem, 'stem', path),
  };
}

export function legacyCardSemanticProjection(
  card: unknown,
  path: string,
): LegacyCardSemanticProjection {
  const root = asRecord(card, 'card', path);
  const graph = asRecord(root.graph, 'graph', path);
  const goal = asRecord(graph.goal, 'graph.goal', path);
  const method = asRecord(graph.method, 'graph.method', path);
  const structure = asRecord(graph.structure, 'graph.structure', path);
  const core = unique([
    requiredString(goal.primary, 'graph.goal.primary', path),
    requiredString(method.primary, 'graph.method.primary', path),
    requiredString(structure.primary, 'graph.structure.primary', path),
  ]);
  const coreSet = new Set(core);
  const related = unique([
    ...optionalRecordArray(goal.part_level, 'graph.goal.part_level', path)
      .map((part, index) => requiredString(
        part.goal,
        `graph.goal.part_level[${index}].goal`,
        path,
      )),
    ...optionalStringArray(method.secondary, 'graph.method.secondary', path),
    ...optionalStringArray(method.subroute, 'graph.method.subroute', path),
    ...optionalStringArray(structure.secondary, 'graph.structure.secondary', path),
  ]).filter((tag) => !coreSet.has(tag));
  return {
    id: requiredString(root.content_item_id, 'content_item_id', path),
    stem: requiredString(root.stem, 'stem', path),
    core,
    related,
  };
}

function renderRow(row: CardRecallIndexRow): string {
  return [
    row.path,
    JSON.stringify(row.goal),
    JSON.stringify(row.method),
    JSON.stringify(row.structure),
    String(row.choice_count),
    String(row.part_count),
    row.stem.replace(/\s*\n\s*/g, ' ').replaceAll('\t', ' '),
  ].join('\t');
}

export async function buildCardRecallIndex(learningSetRoot: string): Promise<string> {
  const root = resolve(learningSetRoot);
  const glob = new Bun.Glob('cards/**/*.card.yaml');
  const paths: string[] = [];

  for await (const path of glob.scan({ cwd: root, onlyFiles: true })) {
    const normalized = path.replaceAll('\\', '/');
    if (!normalized.split('/').includes('.revisions')) paths.push(normalized);
  }
  paths.sort();

  if (paths.length === 0) {
    throw new Error(`${root}: no cards/**/*.card.yaml files found`);
  }

  const rows = paths.map((path) => {
    const card = parseYaml(readFileSync(join(root, path), 'utf8')) as unknown;
    return cardToRecallRow(card, path);
  });

  return [
    'path\tgoal\tmethod\tstructure\tchoice_count\tpart_count\tstem',
    ...rows.map(renderRow),
    '',
  ].join('\n');
}

if (import.meta.main) {
  const learningSetRoot = process.argv[2];
  if (!learningSetRoot) {
    throw new Error(
      'Usage: bun run scripts/build-card-recall-index.ts <learning-set-root> [output-path]',
    );
  }

  const resolvedRoot = resolve(learningSetRoot);
  const outputPath = process.argv[3]
    ? resolve(process.argv[3])
    : join(resolvedRoot, 'graph/card-recall-index.tsv');
  const index = await buildCardRecallIndex(resolvedRoot);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, index);
  process.stdout.write(`Wrote ${index.trimEnd().split('\n').length - 1} rows to ${outputPath}\n`);
}

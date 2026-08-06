import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCardRecallIndex } from '../../scripts/build-card-recall-index';

const learningSetRoot = join(
  import.meta.dir,
  '../fixtures/card-recall-learning-set',
);
const committedIndexPath = join(
  learningSetRoot,
  'graph/card-recall-index.tsv',
);

const columns = [
  'path',
  'goal',
  'method',
  'structure',
  'choice_count',
  'part_count',
  'stem',
] as const;

type RecallRow = {
  path: string;
  goal: string[];
  method: string[];
  structure: string[];
  stem: string;
  choice_count: number;
  part_count: number;
};

function parseRows(tsv: string): RecallRow[] {
  const [header, ...lines] = tsv.trimEnd().split('\n');
  expect(header).toBe(columns.join('\t'));

  return lines.map((line) => {
    const cells = line.split('\t');
    expect(cells).toHaveLength(columns.length);
    const [path, goal, method, structure, choiceCount, partCount, stem] = cells;
    return {
      path: path!,
      goal: JSON.parse(goal!) as string[],
      method: JSON.parse(method!) as string[],
      structure: JSON.parse(structure!) as string[],
      choice_count: Number(choiceCount),
      part_count: Number(partCount),
      stem: stem!,
    };
  });
}

describe('safe problem-card recall index', () => {
  test('is deterministic, complete, and contains only public recall fields', async () => {
    const generated = await buildCardRecallIndex(learningSetRoot);

    expect(existsSync(committedIndexPath)).toBe(true);
    expect(generated).toBe(readFileSync(committedIndexPath, 'utf8'));

    const lines = generated.trimEnd().split('\n').slice(1);
    const rows = parseRows(generated);
    expect(rows).toEqual([{
      path: 'cards/public-sample.card.yaml',
      goal: ['求最值'],
      method: ['配方法'],
      structure: ['二次函数结构'],
      choice_count: 0,
      part_count: 1,
      stem: '已知函数 $f(x)=x^2-2ax+1$，求其最小值并说明参数的作用。',
    }]);
    expect(rows.map((row) => row.path)).toEqual(
      rows.map((row) => row.path).toSorted(),
    );

    for (const row of rows) {
      expect(row.path).toMatch(/^cards\/.+\.card\.yaml$/);
      expect(existsSync(join(learningSetRoot, row.path))).toBe(true);
      expect(row.goal.length).toBeGreaterThan(0);
      expect(row.method.length).toBeGreaterThan(0);
      expect(row.structure.length).toBeGreaterThan(0);
      expect([...row.goal, ...row.method, ...row.structure].every(
        (value) => typeof value === 'string' && value.length > 0,
      )).toBe(true);
      expect(row.stem.length).toBeGreaterThan(0);
      expect(Number.isInteger(row.choice_count)).toBe(true);
      expect(row.choice_count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(row.part_count)).toBe(true);
      expect(row.part_count).toBeGreaterThanOrEqual(0);
    }

    expect(lines).toHaveLength(1);
    expect(generated).not.toMatch(/\b(?:answer|solution)\b|答案|解答|1-a\^?2|1-a²/i);
  });
});

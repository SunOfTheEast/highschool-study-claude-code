import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCardRecallIndex } from '../../scripts/build-card-recall-index';

const learningSetRoot = join(
  import.meta.dir,
  '../../../../examples/derivative-m0/learning-set',
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
    expect(rows).toHaveLength(519);
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

    const metadataPrefixLengths = lines.map((line) => (
      `${line.split('\t').slice(0, 6).join('\t')}\t`.length
    ));
    expect(Math.max(...metadataPrefixLengths)).toBeLessThanOrEqual(232);
    expect(lines.filter((line) => line.length <= 500).length).toBeGreaterThanOrEqual(496);

    const multi = rows.find((row) => row.path.includes(
      'mst_p0178_product_max_candidates_ex34_multi.card.yaml',
    ));
    expect(multi).toEqual(expect.objectContaining({
      choice_count: 4,
      part_count: 1,
    }));
    expect(multi?.stem).toContain('多选 T11');

    const multipart = rows.find((row) => row.path.includes(
      'mst_p0239_ae2x_plus_a_minus2_ex_minus_x_two_zeros_param_ch6_main_object_ex13.card.yaml',
    ));
    expect(multipart).toEqual(expect.objectContaining({
      choice_count: 0,
      part_count: 2,
    }));
    expect(multipart?.stem).toContain('讨论 $f(x)$ 的单调性');
    expect(JSON.stringify(multipart)).not.toContain('0<a<1');
  });
});

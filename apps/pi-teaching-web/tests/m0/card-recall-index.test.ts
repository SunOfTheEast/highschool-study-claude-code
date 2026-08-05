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
  'graph/card-recall-index.jsonl',
);

const allowedKeys = [
  'path',
  'content_revision_id',
  'goal',
  'method',
  'structure',
  'stem',
  'choice_count',
  'part_count',
] as const;

type RecallRow = {
  path: string;
  content_revision_id: string;
  goal: string[];
  method: string[];
  structure: string[];
  stem: string;
  choice_count: number;
  part_count: number;
};

function parseRows(jsonl: string): RecallRow[] {
  return jsonl.trimEnd().split('\n').map((line) => JSON.parse(line) as RecallRow);
}

describe('safe problem-card recall index', () => {
  test('is deterministic, complete, and contains only public recall fields', async () => {
    const generated = await buildCardRecallIndex(learningSetRoot);

    expect(existsSync(committedIndexPath)).toBe(true);
    expect(generated).toBe(readFileSync(committedIndexPath, 'utf8'));

    const rows = parseRows(generated);
    expect(rows).toHaveLength(519);
    expect(rows.map((row) => row.path)).toEqual(
      rows.map((row) => row.path).toSorted(),
    );

    for (const row of rows) {
      expect(Object.keys(row)).toEqual([...allowedKeys]);
      expect(row.path).toMatch(/^cards\/.+\.card\.yaml$/);
      expect(existsSync(join(learningSetRoot, row.path))).toBe(true);
      expect(row.content_revision_id.length).toBeGreaterThan(0);
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

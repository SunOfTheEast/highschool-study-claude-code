import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TSchema } from 'typebox';
import { Check } from 'typebox/value';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

type LessonToolContracts = {
  lessonBlockIdSchema(root: string, lessonPath: string): TSchema;
  lessonPartQuestionSchema(root: string, lessonPath: string): TSchema | null;
};

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

async function contracts(): Promise<LessonToolContracts | null> {
  try {
    return await import('../../src/runtime/lesson-tool-contracts') as LessonToolContracts;
  } catch {
    return null;
  }
}

test('binds Block IDs to the current Session-owned Lesson', async () => {
  const value = await contracts();
  expect(value).not.toBeNull();
  if (!value) return;

  const schema = value.lessonBlockIdSchema(
    domainIntegrityFixtureRoot,
    'lessons/lesson-003.md',
  );

  expect(Check(schema, 'assessment-01')).toBeTrue();
  expect(Check(schema, 'reflection')).toBeTrue();
  expect(Check(schema, 'invented-block')).toBeFalse();
});

test('exposes only real part labels and returns null when the Lesson has none', async () => {
  const value = await contracts();
  expect(value).not.toBeNull();
  if (!value) return;

  expect(value.lessonPartQuestionSchema(
    domainIntegrityFixtureRoot,
    'lessons/lesson-003.md',
  )).toBeNull();

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'lesson-tool-contracts-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(domainIntegrityFixtureRoot, temporaryRoot, { recursive: true });
  const cardPath = join(
    temporaryRoot,
    'cards/derivative/mst_p0032_ex22.card.yaml',
  );
  const card = readFileSync(cardPath, 'utf8').replace(
    'parts: &a1 []',
    [
      'parts: &a1',
      '  - part_id: 第（1）问',
      '  - part_id: 第（2）问',
    ].join('\n'),
  );
  writeFileSync(cardPath, card);

  const schema = value.lessonPartQuestionSchema(
    temporaryRoot,
    'lessons/lesson-003.md',
  );
  expect(schema).not.toBeNull();
  if (!schema) return;
  expect(Check(schema, '第（1）问')).toBeTrue();
  expect(Check(schema, '第（2）问')).toBeTrue();
  expect(Check(schema, '随便一问')).toBeFalse();
});

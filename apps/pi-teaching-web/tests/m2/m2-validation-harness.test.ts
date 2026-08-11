import { afterEach, expect, test } from 'bun:test';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureLearningSetState,
  diffLearningSetState,
  parseM2ValidationArguments,
} from '../../scripts/m2-validation/cli';
import {
  M2_VALIDATION_SCENARIOS,
  m2ValidationScenario,
} from '../../scripts/m2-validation/scenarios';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('freezes the nine M2 acceptance scenarios without scripting teacher conclusions', () => {
  expect(M2_VALIDATION_SCENARIOS.map((scenario) => scenario.id)).toEqual([
    'question-formation',
    'brainstorming',
    'note-proposal',
    'plan-problem-card',
    'focus-cycle',
    'calendar',
    'direct-review',
    'batch-review',
    'lesson-review',
  ]);
  expect(m2ValidationScenario('brainstorming').gates).toContain(
    '论文检索只能在学生明确同意后发生，拒绝或失败后对话仍可继续',
  );
  expect(JSON.stringify(M2_VALIDATION_SCENARIOS)).not.toMatch(/思维链|CoT|掌握率/);
});

test('dry-run arguments and tree snapshots record paths and hashes without credentials or file bodies', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m2-validation-fixture-'));
  roots.push(root);
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# 验收学习集\n');
  const before = captureLearningSetState(root);
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# 已修改\n');
  writeFileSync(join(root, 'new.md'), '不应进入报告正文\n');
  const after = captureLearningSetState(root);
  expect(diffLearningSetState(before, after)).toEqual({
    created: ['new.md'],
    modified: ['LEARNING_GUIDE.md'],
    deleted: [],
  });
  expect(JSON.stringify(after)).not.toContain('不应进入报告正文');

  expect(parseM2ValidationArguments([
    '--root', root,
    '--api-base', 'http://127.0.0.1:65127',
    '--scenario', 'question-formation',
    '--dry-run', 'true',
  ])).toMatchObject({
    root,
    apiBase: 'http://127.0.0.1:65127/',
    scenario: 'question-formation',
    dryRun: true,
  });
  expect(() => parseM2ValidationArguments([
    '--root', root,
    '--api-base', 'https://example.com',
  ])).toThrow('M2_VALIDATION_API_BASE_INVALID');
});

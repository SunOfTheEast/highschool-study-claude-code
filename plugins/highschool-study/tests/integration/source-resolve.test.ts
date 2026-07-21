import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSet } from '../helpers/learning-set';
import { sourceResolve } from '../../server/src/sources';

test('resolves real Markdown heading anchors and copied YAML card steps', () => {
  const root = makeLearningSet();

  expect(sourceResolve(root, {
    fromPath: 'lessons/lesson-001.md',
    target: '#freeze-the-variable',
  })).toEqual({
    valid: true,
    path: 'lessons/lesson-001.md',
    fragment: 'freeze-the-variable',
    excerpt: 'Freeze the Variable',
    error: null,
  });
  expect(sourceResolve(root, {
    fromPath: 'lessons/lesson-001.md',
    target: '../cards/conics/freeze-variable-01.yaml#step=identify-freeze',
  })).toEqual({
    valid: true,
    path: 'cards/conics/freeze-variable-01.yaml',
    fragment: 'step=identify-freeze',
    excerpt: '识别可冻结组合量',
    error: null,
  });
});

test('returns the exact invalid envelope for outside, missing, and invalid fragments', () => {
  const root = makeLearningSet();
  const fromPath = 'lessons/lesson-001.md';

  expect(sourceResolve(root, { fromPath, target: '../../outside.md' })).toEqual({
    valid: false,
    path: null,
    fragment: null,
    excerpt: null,
    error: 'OUTSIDE_LEARNING_SET',
  });
  expect(sourceResolve(root, { fromPath, target: '/outside.md' })).toEqual({
    valid: false,
    path: null,
    fragment: null,
    excerpt: null,
    error: 'OUTSIDE_LEARNING_SET',
  });
  expect(sourceResolve(root, { fromPath, target: '../cards/missing.yaml' })).toEqual({
    valid: false,
    path: null,
    fragment: null,
    excerpt: null,
    error: 'MISSING_FILE',
  });
  expect(sourceResolve(root, {
    fromPath,
    target: '../cards/conics/freeze-variable-01.yaml#step=missing',
  })).toEqual({
    valid: false,
    path: 'cards/conics/freeze-variable-01.yaml',
    fragment: 'step=missing',
    excerpt: null,
    error: 'MISSING_FRAGMENT',
  });

  writeFileSync(join(root, 'materials/not-a-card.yaml'), `rubric:
  criteria:
    - step_id: identify-freeze
      description: Not a problem card
`);
  expect(sourceResolve(root, {
    fromPath,
    target: '../materials/not-a-card.yaml#step=identify-freeze',
  })).toEqual({
    valid: false,
    path: 'materials/not-a-card.yaml',
    fragment: 'step=identify-freeze',
    excerpt: null,
    error: 'MISSING_FRAGMENT',
  });
});

import { copyFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendTrace } from '../../server/src/traces';

const packageRoot = join(import.meta.dir, '../..');

export function makeLearningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'highschool-study-learning-set-'));
  cpSync(join(packageRoot, 'learning-set-template'), root, { recursive: true });
  mkdirSync(join(root, 'cards/conics'), { recursive: true });
  copyFileSync(
    join(packageRoot, 'subject-packs/highschool-math/cards/conics/freeze-variable-01.yaml'),
    join(root, 'cards/conics/freeze-variable-01.yaml'),
  );
  writeFileSync(join(root, 'lessons/lesson-001.md'), `---
id: lesson-001
kind: lesson
plan_id: max-value
---
# Lesson 001

## Freeze the Variable

Use the target quantity as a stable parameter.
`);
  return root;
}

export function makeLearningSetWithLesson(): string {
  const root = makeLearningSet();
  writeFileSync(join(root, 'lessons/lesson-001.md'), `---
id: lesson-001
kind: lesson
plan_id: max-value
---
# Lesson 001

## Block step-01

Introduce the target quantity.

## Block step-02

Freeze the target quantity and check its domain.

## Aliases

- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml
`);
  writeFileSync(join(root, 'graph/vocabulary.yaml'), `schema: highschool-study.taxonomy.v1
nodes:
  - node_id: method.freeze-variable
    facet: method_cluster
    canonical_name: 冻结变量法
    aliases: [冻元法]
  - node_id: method.parameterize
    facet: method_cluster
    canonical_name: 参数化与消元
`);
  return root;
}

export function makeLearningSetWithHistory(): string {
  const root = makeLearningSetWithLesson();
  copyFileSync(
    join(packageRoot, 'subject-packs/highschool-math/cards/conics/freeze-variable-transfer-02.yaml'),
    join(root, 'cards/conics/freeze-variable-transfer-02.yaml'),
  );

  const cardTrace = {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: 'identify-freeze',
    materialPath: null,
    assessment: 'partially_correct' as const,
    support: 'none' as const,
    note: 'Used the freeze variable method and checked the domain.',
    supersedes: null,
    methods: { primary: '冻结变量法', secondary: ['参数化与消元'] },
  };
  appendTrace(root, cardTrace, () => new Date('2026-07-21T02:00:00Z'));
  appendTrace(root, {
    ...cardTrace,
    assessment: 'incorrect',
    note: 'First domain check was incorrect.',
  }, () => new Date('2026-07-21T02:05:00Z'));
  appendTrace(root, {
    ...cardTrace,
    note: 'Revised the domain check using the card evidence.',
    supersedes: 'event-002',
  }, () => new Date('2026-07-21T02:10:00Z'));
  appendTrace(root, {
    ...cardTrace,
    cardAlias: null,
    cardStepId: null,
    assessment: 'incomplete',
    support: 'external',
    note: 'Cardless question about the domain boundary.',
  }, () => new Date('2026-07-21T02:15:00Z'));
  return root;
}

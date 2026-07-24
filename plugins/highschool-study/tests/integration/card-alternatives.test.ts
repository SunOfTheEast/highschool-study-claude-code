import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendCardAlternative, readCardAlternatives } from '../../server/src/alternatives';
import { searchCards } from '../../server/src/cards';
import { appendTrace, readActiveTraces } from '../../server/src/traces';
import { makeLearningSetWithLesson } from '../helpers/learning-set';

const traceInput = {
  lessonPath: 'lessons/lesson-001.md',
  blockId: 'step-02',
  cardAlias: 'Q-FREEZE-01',
  cardStepId: 'identify-freeze',
  materialPath: null,
  assessment: 'correct' as const,
  support: 'none' as const,
  note: 'Found a complete alternative route.',
  supersedes: null,
  methods: { primary: '冻结变量法', secondary: [] },
};

test('writes and reads a card-bound alternative through its active Trace', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, traceInput, () => new Date('2026-07-21T02:00:00Z'));

  const alternative = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '先作代换，再从约束中消去参数。',
    method: '参数化与消元',
    support: 'external',
  }, () => new Date('2026-07-21T02:05:00Z'));

  expect(alternative).toMatchObject({
    id: 'alt-001',
    cardPath: 'cards/conics/freeze-variable-01.yaml',
    sourceTrace: 'lessons/lesson-001.md#trace-event-001',
    question: '整题',
    method: '参数化与消元',
    support: 'external',
  });
  expect(readCardAlternatives(root, alternative.cardPath)).toEqual([alternative]);
  expect(searchCards(root, { query: 'freeze variable', limit: 3 }).cards[0]?.alternatives)
    .toEqual([alternative]);
  expect(readFileSync(join(root, 'cards/conics/freeze-variable-01.alternatives.md'), 'utf8'))
    .toContain('<!-- studyforge-alternative id="alt-001" question="整题" -->');
});

test('appends same-source alternatives with stable IDs and keeps them after Trace supersession', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, traceInput, () => new Date('2026-07-21T02:00:00Z'));
  const first = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '第一条路线。',
    method: '冻结变量法',
    support: 'tutor',
  }, () => new Date('2026-07-21T02:01:00Z'));
  const second = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '第二条路线。',
    method: null,
    support: 'none',
  }, () => new Date('2026-07-21T02:02:00Z'));
  expect([first.id, second.id]).toEqual(['alt-001', 'alt-002']);
  expect(readCardAlternatives(root, first.cardPath).map((item) => item.solution))
    .toEqual(['第一条路线。', '第二条路线。']);

  appendTrace(root, {
    ...traceInput,
    assessment: 'correct',
    note: 'Superseding observation.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-21T02:03:00Z'));
  expect(readCardAlternatives(root, first.cardPath).map((item) => item.id))
    .toEqual(['alt-001', 'alt-002']);
  expect(readFileSync(join(root, 'cards/conics/freeze-variable-01.alternatives.md'), 'utf8'))
    .toContain('第二条路线。');
});

test('rejects alternatives without an active correct card Trace', () => {
  const root = makeLearningSetWithLesson();
  expect(() => appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '无证据。',
    method: null,
    support: 'none',
  }, () => new Date())).toThrow();

  appendTrace(root, { ...traceInput, assessment: 'partially_correct' }, () => new Date());
  expect(() => appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '非完整解。',
    method: null,
    support: 'none',
  }, () => new Date())).toThrow();
});

test('normalizes a unique method alias and rejects an unknown method', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, traceInput, () => new Date('2026-07-21T02:00:00Z'));
  expect(appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '使用别名对应的路线。',
    method: '冻元法',
    support: 'none',
  }, () => new Date()).method).toBe('冻结变量法');

  expect(() => appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '伪节点路线。',
    method: '不存在的方法',
    support: 'none',
  }, () => new Date())).toThrow(
    'INVALID_ALTERNATIVE: method is not a canonical graph node',
  );
});

test('resolves a concrete part when the card declares parts', () => {
  const root = makeLearningSetWithLesson();
  const cardPath = join(root, 'cards/conics/freeze-variable-01.yaml');
  writeFileSync(cardPath, `${readFileSync(cardPath, 'utf8').replace('parts: []', 'parts:\n  - part_id: (1)\n    stem: 第一问\n  - part_id: (2)\n    stem: 第二问\n')}`);
  appendTrace(root, traceInput, () => new Date('2026-07-21T02:00:00Z'));
  expect(appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '(2)',
    solution: '只解第二问。',
    method: null,
    support: 'none',
  }, () => new Date()).question).toBe('(2)');
});

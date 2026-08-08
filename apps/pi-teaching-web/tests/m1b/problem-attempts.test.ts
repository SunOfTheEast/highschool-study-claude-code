import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { planProblemCardSave } from '../../src/study/learning-assets';
import {
  readProblemActivity,
  recordProblemAttempt,
  revealProblemAnswer,
} from '../../src/study/problem-attempts';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function learningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-attempts-'));
  cpSync(fixture, root, { recursive: true });
  commitDocumentCandidates(root, planProblemCardSave(root, 'seed-session', {
    stem: '为什么加入 NaCl 会使 AgCl 析出？',
    standardAnswer: '氯离子增大使离子积超过 Ksp，随后析出直至重新平衡。',
    teacherRationale: '区分离子积的瞬时变化与 Ksp 不变。',
    studentNote: '',
    sources: [],
    tags: { core: ['测试题'], related: [] },
  }, '2026-08-08T09:00:00.000Z').candidates);
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('appends an answer before a later reveal without rewriting the attempt', () => {
  const root = learningSet();
  const attempt = recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: '因为平衡常数变小了。',
  }, 'request-attempt-1', '2026-08-08T10:00:00.000Z');
  const path = join(root, 'activity/problem-attempts/problem-001.md');
  const beforeReveal = readFileSync(path, 'utf8');
  const reveal = revealProblemAnswer(
    root,
    'problem-001',
    'request-reveal-1',
    '2026-08-08T10:01:00.000Z',
  );
  const afterReveal = readFileSync(path, 'utf8');

  expect(attempt).toMatchObject({
    kind: 'attempt',
    id: 'event-001',
    cardId: 'problem-001',
    cardRevision: 1,
    answerViewedBefore: false,
    response: { kind: 'answer', text: '因为平衡常数变小了。' },
  });
  expect(reveal.event).toMatchObject({
    kind: 'answer-reveal',
    id: 'event-002',
    attemptId: 'event-001',
  });
  expect(reveal.standardAnswer).toContain('离子积超过 Ksp');
  expect(afterReveal.startsWith(beforeReveal)).toBe(true);
  expect(beforeReveal).not.toContain('answer-reveal');
});

test('records cannot answer and derives whether the current answer was already seen', () => {
  const root = learningSet();
  recordProblemAttempt(
    root,
    'problem-001',
    { kind: 'cannot' },
    'request-cannot-1',
    '2026-08-08T10:00:00.000Z',
  );
  revealProblemAnswer(
    root,
    'problem-001',
    'request-reveal-1',
    '2026-08-08T10:01:00.000Z',
  );
  const second = recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: '第二次尝试。',
  }, 'request-attempt-2', '2026-08-08T10:02:00.000Z');
  const activity = readProblemActivity(root, 'problem-001');

  expect(activity.events[0]).toMatchObject({ response: { kind: 'cannot' } });
  expect(second.answerViewedBefore).toBe(true);
  expect(activity.latestAttempt?.id).toBe('event-003');
  expect(activity.answerRevealedForLatestAttempt).toBe(false);
  expect(activity).not.toHaveProperty('correct');
  expect(activity).not.toHaveProperty('mastery');
});

test('binds the source revision and makes request retries idempotent', () => {
  const root = learningSet();
  const first = recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: '一次提交。',
  }, 'request-attempt-1', '2026-08-08T10:00:00.000Z');
  const replay = recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: '一次提交。',
  }, 'request-attempt-1', '2026-08-08T10:05:00.000Z');

  expect(replay).toEqual(first);
  expect(readProblemActivity(root, 'problem-001').events).toHaveLength(1);
  expect(() => recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: '同一个请求却换了内容。',
  }, 'request-attempt-1', '2026-08-08T10:06:00.000Z')).toThrow('REQUEST_ID_CONFLICT');
});

test('does not reveal an answer before an attempt exists', () => {
  const root = learningSet();

  expect(() => revealProblemAnswer(
    root,
    'problem-001',
    'request-reveal-1',
    '2026-08-08T10:00:00.000Z',
  )).toThrow('ANSWER_REVEAL_REQUIRES_ATTEMPT');
  expect(readProblemActivity(root, 'problem-001').events).toEqual([]);
});

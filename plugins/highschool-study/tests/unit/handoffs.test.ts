import { expect, test } from 'bun:test';
import {
  parseHandoff,
  parseSourceHandle,
  renderHandoff,
  renderSourceOnlyHandoff,
  type HandoffDraft,
  type HandoffIdentity,
} from '../../server/src/handoffs';

const identity = {
  id: 'lesson-006/handoff',
  from: 'lesson:lesson-006',
  to: 'plan:route-choice',
  sealedAt: '2026-08-04T12:32:00.000Z',
} satisfies HandoffIdentity;

const draft = {
  learnerClaims: [{
    statement: '学生能独立识别两条可行路线。',
    scope: '本节两道同类题。',
    sources: [
      'trace:trace-00000001-1111-4111-8111-111111111111',
      'session:session-006#message:message-028',
    ],
    boundary: '尚未证明跨题型稳定。',
    nextUse: '下一课测试限时路线选择。',
  }],
  teachingClaims: [{
    statement: '先比较路线成本有助于学生独立选择。',
    scope: '本节第二道题及迁移尝试。',
    sources: [
      'claim:lesson-006/handoff#learner-c1',
      'trace:trace-00000001-1111-4111-8111-111111111111',
    ],
    boundary: '尚未验证陌生题型。',
    nextUse: '下一课保持陌生外壳。',
  }],
  openQuestions: [{
    question: '犹豫来自成本判断还是路线陌生？',
    sources: ['claim:lesson-006/handoff#learner-c1'],
    nextCheck: '保持题型，只改变路线成本差。',
  }],
} satisfies HandoffDraft;

test('binds runtime identity and allocates stable claim anchors', () => {
  const rendered = renderHandoff(identity, draft);
  expect(rendered).toContain('- ID: lesson-006/handoff');
  expect(rendered).toContain('- From: lesson:lesson-006');
  expect(rendered).toContain('- To: plan:route-choice');
  expect(rendered).toContain('- Sealed at: 2026-08-04T12:32:00.000Z');
  expect(rendered).toContain('### Learner C1');
  expect(rendered).toContain('### Teaching T1');
  expect(rendered).toContain('### Open Question Q1');

  expect(parseHandoff(rendered)).toEqual({
    identity,
    mode: 'claims',
    learnerClaims: [{
      id: 'C1',
      sourceRef: 'claim:lesson-006/handoff#learner-c1',
      ...draft.learnerClaims[0]!,
    }],
    teachingClaims: [{
      id: 'T1',
      sourceRef: 'claim:lesson-006/handoff#teaching-t1',
      ...draft.teachingClaims[0]!,
    }],
    openQuestions: [{
      id: 'Q1',
      ...draft.openQuestions[0]!,
    }],
    sourceIndex: [
      'trace:trace-00000001-1111-4111-8111-111111111111',
      'session:session-006#message:message-028',
      'claim:lesson-006/handoff#learner-c1',
    ],
  });
});

test('accepts only canonical source handles', () => {
  expect(parseSourceHandle('trace:trace-00000001-1111-4111-8111-111111111111'))
    .toEqual({
      kind: 'trace',
      traceId: 'trace-00000001-1111-4111-8111-111111111111',
    });
  expect(parseSourceHandle('session:session-006#message:message-028'))
    .toEqual({
      kind: 'session',
      sessionId: 'session-006',
      messageId: 'message-028',
    });
  expect(parseSourceHandle('card:cards/derivative/example.card.yaml'))
    .toEqual({ kind: 'card', cardPath: 'cards/derivative/example.card.yaml' });
  expect(parseSourceHandle('block:lesson-006/block-002'))
    .toEqual({ kind: 'block', lessonId: 'lesson-006', blockId: 'block-002' });
  expect(parseSourceHandle('claim:lesson-006/handoff#teaching-t2'))
    .toEqual({
      kind: 'claim',
      handoffId: 'lesson-006/handoff',
      claimKind: 'teaching',
      claimId: 'T2',
    });
  expect(parseSourceHandle('memory:student/S3'))
    .toEqual({ kind: 'memory', owner: 'student', entryId: 'S3' });

  for (const source of [
    'trace:event-001',
    'session:session-006#message:',
    'card:../secrets.yaml',
    'card:materials/book.md',
    'block:lesson-006/../../ROADMAP.md',
    'claim:lesson-006/handoff#open-q1',
    'memory:coach/S1',
  ]) {
    expect(() => parseSourceHandle(source)).toThrow('INVALID_HANDOFF_SOURCE');
  }
});

test('rejects model text with missing evidence or injected identity', () => {
  expect(() => renderHandoff(identity, {
    ...draft,
    learnerClaims: [{
      ...draft.learnerClaims[0]!,
      sources: [],
    }],
  })).toThrow('INVALID_HANDOFF_DRAFT');

  expect(() => renderHandoff({
    ...identity,
    id: 'lesson-999/handoff',
  }, draft)).toThrow('INVALID_HANDOFF_IDENTITY');

  expect(() => parseHandoff(
    renderHandoff(identity, draft).replace(
      '### Learner C1',
      '### Learner C9',
    ),
  )).toThrow('INVALID_HANDOFF_FORMAT');
});

test('renders source-only handoff without claims or open questions', () => {
  const rendered = renderSourceOnlyHandoff(identity, [
    'trace:trace-00000001-1111-4111-8111-111111111111',
    'session:session-006',
  ]);
  expect(rendered).toContain('### Source Index');
  expect(rendered).not.toContain('### Learner ');
  expect(rendered).not.toContain('### Teaching ');
  expect(rendered).not.toContain('### Open Question ');
  expect(parseHandoff(rendered)).toEqual({
    identity,
    mode: 'source-only',
    learnerClaims: [],
    teachingClaims: [],
    openQuestions: [],
    sourceIndex: [
      'trace:trace-00000001-1111-4111-8111-111111111111',
      'session:session-006',
    ],
  });
  expect(() => parseHandoff(
    rendered.replace(
      '### Source Index',
      '### Learner C1\n\n- Statement: \"伪造结论\"\n\n### Source Index',
    ),
  )).toThrow('INVALID_HANDOFF_FORMAT');
});

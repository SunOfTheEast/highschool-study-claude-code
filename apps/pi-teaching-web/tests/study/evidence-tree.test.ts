import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendTrace,
  renderHandoff,
  renderSourceOnlyHandoff,
} from 'highschool-study-markdown/study-domain';
import {
  resolveEvidenceTree,
  type NodeSessionScope,
  type SessionEvidenceReader,
} from '../../src/study/evidence-tree';

const planScope = {
  nodeKind: 'plan',
  nodeId: 'plan-a',
  nodePath: 'plans/plan-a.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
} satisfies NodeSessionScope;

function fixture(): {
  root: string;
  activeTrace: string;
  invalidatedTrace: string;
  sessions: SessionEvidenceReader;
} {
  const root = mkdtempSync(join(tmpdir(), 'study-evidence-tree-'));
  for (const directory of ['plans', 'lessons', 'cards/topic', 'memory']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  writeFileSync(join(root, 'ROADMAP.md'), `---
id: roadmap
kind: roadmap
---
# Roadmap
`);
  writeFileSync(join(root, 'cards/topic/card-001.yaml'), `schema: highschool-study.problem-card.v1
id: card-001
title: Route comparison
goal: Compare routes.
problem:
  stem: Test problem.
methods:
  primary: Route A
  secondary: []
steps:
  - id: solve
    prompt: Solve.
`);
  writeFileSync(join(root, 'lessons/lesson-001.md'), `---
id: lesson-001
kind: lesson
parent_id: plan-a
parent_path: plans/plan-a.md
status: closed
tutor_session: session-001
---
# Lesson 001

## Block block-001

## Aliases

- CARD-001: ../cards/topic/card-001.yaml
`);
  const first = appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-001',
    cardAlias: 'CARD-001',
    cardStepId: null,
    materialPath: null,
    assessment: 'incorrect',
    support: 'none',
    methods: null,
    note: '第一次判断有误。',
    supersedes: null,
  }, () => new Date('2026-08-04T12:00:00.000Z'), () => (
    '00000001-1111-4111-8111-111111111111'
  ));
  const second = appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-001',
    cardAlias: 'CARD-001',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    methods: null,
    note: '学生自行更正。',
    supersedes: first.traceId,
  }, () => new Date('2026-08-04T12:05:00.000Z'), () => (
    '00000002-1111-4111-8111-111111111111'
  ));
  const lessonHandoff = renderHandoff({
    id: 'lesson-001/handoff',
    from: 'lesson:lesson-001',
    to: 'plan:plan-a',
    sealedAt: '2026-08-04T12:10:00.000Z',
  }, {
    learnerClaims: [{
      statement: '学生能在比较后自行换路。',
      scope: '本节路线比较题。',
      sources: [second.sourceRef, 'session:session-001#message:message-009'],
      boundary: '尚未检查跨题型迁移。',
      nextUse: '下一课更换题型外壳。',
    }],
    teachingClaims: [],
    openQuestions: [],
  });
  writeFileSync(
    join(root, 'lessons/lesson-001.md'),
    `${readFileSync(join(root, 'lessons/lesson-001.md'), 'utf8')}\n${lessonHandoff}`,
  );

  writeFileSync(join(root, 'plans/plan-a.md'), `---
id: plan-a
kind: plan
parent_id: roadmap
parent_path: ROADMAP.md
status: active
coach_session: session-plan-a
---
# Plan A

${renderHandoff({
    id: 'plan-a/handoff',
    from: 'plan:plan-a',
    to: 'roadmap:roadmap',
    sealedAt: '2026-08-04T12:20:00.000Z',
  }, {
    learnerClaims: [{
      statement: '学生已开始形成换路意识。',
      scope: '本 Plan。',
      sources: ['claim:lesson-001/handoff#learner-c1'],
      boundary: '只有一节课。',
      nextUse: '继续观察。',
    }],
    teachingClaims: [],
    openQuestions: [],
  })}
`);
  writeFileSync(join(root, 'plans/plan-b.md'), `---
id: plan-b
kind: plan
parent_id: roadmap
parent_path: ROADMAP.md
status: active
---
# Plan B
`);
  writeFileSync(join(root, 'memory/student-profile.md'), `# Student Profile

## Active Preferences

### S1

- Content: 喜欢先独立尝试。
`);
  writeFileSync(join(root, 'memory/teaching-profile.md'), `# Teaching Profile

## Active Preferences
`);

  const sessions: SessionEvidenceReader = {
    readSession: (source) => source === 'session:session-001'
      ? {
        sessionId: 'session-001',
        ownerId: 'lesson-001',
        ownerPath: 'lessons/lesson-001.md',
      }
      : null,
    readMessage: (source) => (
      source === 'session:session-001#message:message-009'
        ? { role: 'student', text: '我比较后自行换了路线。' }
        : null
    ),
  };
  return {
    root,
    activeTrace: second.sourceRef,
    invalidatedTrace: first.sourceRef,
    sessions,
  };
}

test('expands a same-plan claim to active trace and owned session evidence', () => {
  const value = fixture();
  try {
    const tree = resolveEvidenceTree(
      value.root,
      'claim:lesson-001/handoff#learner-c1',
      planScope,
      value.sessions,
    );
    expect(tree.state).toBe('active');
    expect(tree.label).toContain('学生能在比较后自行换路');
    expect(tree.children.map((child) => child.source)).toEqual([
      value.activeTrace,
      'session:session-001#message:message-009',
    ]);
    expect(tree.children.every((child) => child.state === 'active')).toBe(true);
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('marks superseded trace and every dependent claim invalidated', () => {
  const value = fixture();
  try {
    const trace = resolveEvidenceTree(
      value.root,
      value.invalidatedTrace,
      planScope,
      value.sessions,
    );
    expect(trace.state).toBe('invalidated');

    const lessonPath = join(value.root, 'lessons/lesson-001.md');
    const source = readFileSync(lessonPath, 'utf8');
    writeFileSync(
      lessonPath,
      source.replaceAll(value.activeTrace, value.invalidatedTrace),
    );
    const claim = resolveEvidenceTree(
      value.root,
      'claim:lesson-001/handoff#learner-c1',
      planScope,
      value.sessions,
    );
    expect(claim.state).toBe('invalidated');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('forbids a lesson claim from another Plan branch', () => {
  const value = fixture();
  try {
    expect(resolveEvidenceTree(
      value.root,
      'claim:lesson-001/handoff#learner-c1',
      { ...planScope, nodeId: 'plan-b', nodePath: 'plans/plan-b.md' },
      value.sessions,
    ).state).toBe('forbidden');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('requires a real Session owner and exact message', () => {
  const value = fixture();
  try {
    expect(resolveEvidenceTree(
      value.root,
      'session:session-001#message:missing',
      planScope,
      value.sessions,
    ).state).toBe('missing');
    expect(resolveEvidenceTree(
      value.root,
      'session:session-001',
      { ...planScope, nodeId: 'plan-b', nodePath: 'plans/plan-b.md' },
      value.sessions,
    ).state).toBe('forbidden');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('keeps source-only handoff as an index and exposes no claim', () => {
  const value = fixture();
  try {
    writeFileSync(join(value.root, 'lessons/lesson-002.md'), `---
id: lesson-002
kind: lesson
parent_id: plan-a
parent_path: plans/plan-a.md
status: closed
---
# Lesson 002

${renderSourceOnlyHandoff({
    id: 'lesson-002/handoff',
    from: 'lesson:lesson-002',
    to: 'plan:plan-a',
    sealedAt: '2026-08-04T13:00:00.000Z',
  }, [value.activeTrace])}
`);
    expect(resolveEvidenceTree(
      value.root,
      'claim:lesson-002/handoff#learner-c1',
      planScope,
      value.sessions,
    ).state).toBe('missing');
    expect(resolveEvidenceTree(
      value.root,
      value.activeTrace,
      planScope,
      value.sessions,
    ).state).toBe('active');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('resolves current confirmed memory and rejects claim cycles', () => {
  const value = fixture();
  try {
    expect(resolveEvidenceTree(
      value.root,
      'memory:student/S1',
      planScope,
      value.sessions,
    )).toMatchObject({
      state: 'active',
      label: '喜欢先独立尝试。',
    });

    const planPath = join(value.root, 'plans/plan-a.md');
    writeFileSync(planPath, `---
id: plan-a
kind: plan
parent_id: roadmap
parent_path: ROADMAP.md
status: active
---
# Plan A

${renderHandoff({
    id: 'plan-a/handoff',
    from: 'plan:plan-a',
    to: 'roadmap:roadmap',
    sealedAt: '2026-08-04T13:10:00.000Z',
  }, {
    learnerClaims: [{
      statement: '循环结论。',
      scope: '本 Plan。',
      sources: ['claim:plan-a/handoff#learner-c1'],
      boundary: '无。',
      nextUse: '无。',
    }],
    teachingClaims: [],
    openQuestions: [],
  })}
`);
    expect(resolveEvidenceTree(
      value.root,
      'claim:plan-a/handoff#learner-c1',
      {
        nodeKind: 'roadmap',
        nodeId: 'roadmap',
        nodePath: 'ROADMAP.md',
        parentId: null,
        parentPath: null,
      },
      value.sessions,
    ).state).toBe('forbidden');
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

import { join } from 'node:path';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { appendTrace } from 'highschool-study-markdown/study-domain';
import { ROADMAP_COACH_SESSION_KEY } from '../../src/shared/contracts';
import type {
  AbilityProjection,
  ChatMessage,
  ConversationItem,
  SessionKey,
} from '../../src/shared/contracts';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import {
  readPlanWorkspace,
  readRoadmapWorkspace,
} from '../../src/study/read-workspace';
import {
  closeLesson,
  registerPlan,
  setBlockStatus,
  setFrontmatterField,
  updatePlan,
} from '../../src/study/write-workspace';
import { resolvePersona } from '../../src/study/persona';
import { PreparedLessonValidationError } from '../../src/study/validate-prepared-lesson';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type { WorkflowSnapshot, WorkflowTaskState } from '../../src/workflows/contracts';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const sourceRoot = domainIntegrityFixtureRoot;
const root = mkdtempSync(`${tmpdir()}/studyforge-e2e-`);
cpSync(sourceRoot, root, { recursive: true });
const lesson003Path = join(root, 'lessons/lesson-003.md');
const lesson003Baseline = readFileSync(lesson003Path, 'utf8');
const planPath = join(root, 'plans/domain-integrity.md');
const planBaseline = readFileSync(planPath, 'utf8');
const hub = new EventHub();
const coachKey: SessionKey = 'coach:domain-integrity';
const roadmapKey: SessionKey = ROADMAP_COACH_SESSION_KEY;

function task(
  id: string,
  label: string,
  role: string,
  dependsOn: string[],
  status: WorkflowTaskState['status'],
): WorkflowTaskState {
  return {
    id,
    label,
    role,
    instruction: `private ${id} instruction`,
    dependsOn,
    sourceHandles: [`cards/${id}.card.yaml`],
    readRoots: ['cards', 'lessons'],
    status,
    runId: status === 'completed' ? `run-${id}` : null,
    tokens: status === 'completed' ? 200 : 0,
    durationMs: status === 'completed' ? 100 : 0,
    toolCount: status === 'completed' ? 2 : 0,
    currentTool: null,
    result: status === 'completed'
      ? {
        findings: [`private ${id} finding`],
        evidence_refs: [`cards/${id}.card.yaml`],
        recommended_action: `private ${id} action`,
        risks: [],
      }
      : null,
    error: null,
  };
}

const workflows = new Map<SessionKey, WorkflowSnapshot[]>([[coachKey, [
  {
    id: 'wf-proposed',
    parentSessionKey: coachKey,
    goal: '备课多视角检查',
    mode: 'deep',
    status: 'proposed',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    tasks: [
      task('evidence', '整理真实证据', '证据分析员', [], 'queued'),
      task('design', '设计课堂活动', '课堂设计员', ['evidence'], 'queued'),
      task('spoiler', '检查学生视图', '防剧透审查员', ['design'], 'queued'),
    ],
  },
  {
    id: 'wf-cancellable',
    parentSessionKey: coachKey,
    goal: '可取消会诊',
    mode: 'deep',
    status: 'running',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-22T00:01:00Z',
    updatedAt: '2026-07-22T00:01:10Z',
    tasks: [
      task('completed-evidence', '已完成证据', '证据分析员', [], 'completed'),
      task('pending-design', '尚未完成设计', '课堂设计员', ['completed-evidence'], 'running'),
    ],
  },
]]]);
const deepMode = new Map<SessionKey, boolean>();
const personaSelections = new Map<SessionKey, string>();
const proposedMemoryReview = {
  id: 'fixture-memory-review',
  planId: 'domain-integrity',
  status: 'proposed',
  items: [{
    id: 'preference-add',
    operation: 'add',
    owner: 'student',
    currentText: null,
    proposedText: '先独立尝试，再请求方向性提示。',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '在本周期多节训练中反复出现。',
    counterEvidence: '新概念首次接触时可能需要示范。',
    scope: '复习与专项训练。',
  }, {
    id: 'teaching-revise',
    operation: 'revise',
    owner: 'teaching',
    currentText: '立即指出错误位置。',
    proposedText: '先请学生说明判断依据，再决定是否指出错误位置。',
    sources: ['lessons/lesson-002.md#lesson-summary'],
    rationale: '学生先表达依据时，后续修正更稳定。',
    counterEvidence: '时间紧张的验收课不一定适用。',
    scope: '常规互动讲解。',
  }, {
    id: 'preference-delete',
    operation: 'delete',
    owner: 'student',
    currentText: '每一步都需要确认。',
    proposedText: null,
    sources: ['plans/domain-integrity.md#plan-summary'],
    rationale: '后续独立作答已不支持这条旧记录。',
    counterEvidence: '复杂新题仍可能主动请求核对。',
    scope: '本学习周期。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;
let currentMemoryReview: MemoryReviewSnapshot = proposedMemoryReview;
const fixtureHistory = new Map<SessionKey, ConversationItem[]>();
fixtureHistory.set(roadmapKey, [{
  kind: 'message',
  message: {
    id: 'fixture-roadmap-message',
    role: 'coach',
    text: '这里用于回看整个学习集，并在你确认后开启新的学习周期。',
    complete: true,
  },
}]);
fixtureHistory.set(coachKey, [{
  kind: 'message',
  message: {
    id: 'fixture-memory-intro',
    role: 'coach',
    text: '这个学习周期已经结束。我从课堂记录中整理了三条长期记忆候选，请你逐项确认。',
    complete: true,
  },
}, {
  kind: 'memory-review',
  review: currentMemoryReview,
}]);
const workflowListeners = new Map<SessionKey, Set<(snapshot: WorkflowSnapshot) => void>>();
const sessionListeners = new Map<SessionKey, Set<(event: unknown) => void>>();
const abilityProjection: AbilityProjection = {
  nodes: [{
    method: '链式求导',
    state: 'unstable',
    score: 0.7,
    evidenceCount: 2,
    sources: ['traces/fixture-trace.json'],
  }],
};
let rejectNextLessonStart = false;

function list(key: SessionKey): WorkflowSnapshot[] {
  return structuredClone(workflows.get(key) ?? []);
}

function notify(key: SessionKey, snapshot: WorkflowSnapshot): void {
  for (const listener of workflowListeners.get(key) ?? []) listener(structuredClone(snapshot));
}

const registry = {
  roadmapSnapshot: () => readRoadmapWorkspace(root),
  snapshot: (planId = 'domain-integrity') => readPlanWorkspace(root, planId),
  history: (key: SessionKey) => structuredClone(fixtureHistory.get(key) ?? []),
  memoryReview: async (key: SessionKey) => (
    key === coachKey ? structuredClone(currentMemoryReview) : null
  ),
  submitMemoryReview: async (
    key: SessionKey,
    reviewId: string,
    decisions: MemoryReviewDecision[],
  ) => {
    if (key !== coachKey || reviewId !== currentMemoryReview.id) {
      throw new Error('MEMORY_REVIEW_NOT_FOUND');
    }
    currentMemoryReview = {
      ...currentMemoryReview,
      status: 'submitted',
      decisions: structuredClone(decisions),
    };
    fixtureHistory.set(coachKey, (fixtureHistory.get(coachKey) ?? []).map((item) => (
      item.kind === 'memory-review' && item.review.id === reviewId
        ? { kind: 'memory-review', review: currentMemoryReview }
        : item
    )));
    for (const listener of sessionListeners.get(key) ?? []) {
      listener({ type: 'agent_end', messages: [], willRetry: false });
    }
    return structuredClone(currentMemoryReview);
  },
  subscribe: (key: SessionKey, listener: (event: unknown) => void) => {
    const current = sessionListeners.get(key) ?? new Set();
    current.add(listener);
    sessionListeners.set(key, current);
    return () => current.delete(listener);
  },
  subscribeWorkflows: (
    key: SessionKey,
    listener: (snapshot: WorkflowSnapshot) => void,
  ) => {
    const current = workflowListeners.get(key) ?? new Set();
    current.add(listener);
    workflowListeners.set(key, current);
    return () => current.delete(listener);
  },
  personaId: (key: SessionKey) => personaSelections.get(key) ?? resolvePersona(root).id,
  setPersona: async (key: SessionKey, id: string) => {
    resolvePersona(root, id);
    personaSelections.set(key, id);
  },
  openSession: async (key: SessionKey) => ({
    sessionId: key === roadmapKey ? 'fixture-roadmap-coach' : `fixture-${key}`,
  }),
  setDeepMode: async (key: SessionKey, enabled: boolean) => { deepMode.set(key, enabled); },
  deepMode: async (key: SessionKey) => deepMode.get(key) ?? false,
  workflows: async (key: SessionKey) => list(key),
  confirmWorkflow: async (key: SessionKey, id: string) => {
    const snapshot = workflows.get(key)?.find((item) => item.id === id);
    if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
    snapshot.status = 'running';
    notify(key, snapshot);
    await Promise.resolve();
    for (const item of snapshot.tasks) {
      item.status = 'completed';
      item.runId = `run-${item.id}`;
      item.tokens = 200;
      item.durationMs = 100;
      item.result = {
        findings: [`private ${item.id} finding`],
        evidence_refs: [`cards/${item.id}.card.yaml`],
        recommended_action: `private ${item.id} action`,
        risks: [],
      };
    }
    snapshot.status = 'completed';
    notify(key, snapshot);
    return structuredClone(snapshot);
  },
  cancelWorkflow: async (key: SessionKey, id: string) => {
    const snapshot = workflows.get(key)?.find((item) => item.id === id);
    if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
    snapshot.status = 'cancelled';
    for (const item of snapshot.tasks) {
      if (item.status === 'queued' || item.status === 'running') item.status = 'cancelled';
    }
    notify(key, snapshot);
  },
  startLesson: async (lessonId: string) => {
    if (rejectNextLessonStart) {
      rejectNextLessonStart = false;
      throw new PreparedLessonValidationError([{
        code: 'LESSON_ALIAS_MISSING',
        message: 'Block assessment-01 的 Uses 缺少 alias：Q-MISSING',
      }]);
    }
    const lesson = readPlanWorkspace(root, 'domain-integrity').lessons
      .find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    setFrontmatterField(root, lesson.path, 'status', 'active');
    const orientation = lesson.blocks.find((block) => block.id === 'orientation');
    const firstProblem = lesson.blocks.find((block) => block.kind === 'problem');
    if (orientation) setBlockStatus(root, lesson.path, orientation.id, 'completed');
    if (firstProblem) setBlockStatus(root, lesson.path, firstProblem.id, 'active');
    return {};
  },
  triggerLessonStart: async () => {},
  pauseLesson: async (lessonId: string) => {
    const lesson = readPlanWorkspace(root, 'domain-integrity').lessons
      .find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    setFrontmatterField(root, lesson.path, 'status', 'paused');
  },
  abandonForReprepare: async () => {},
  send: async (key: SessionKey) => {
    if (!key.startsWith('tutor:')) return;
    for (const listener of sessionListeners.get(key) ?? []) {
      listener({
        type: 'tool_execution_end',
        toolName: 'trace_append',
        isError: false,
      });
    }
  },
};
const clients = new Set<{ send(data: string): void }>();
hub.subscribe((event) => {
  const data = JSON.stringify(event);
  for (const client of clients) client.send(data);
});
const appFetch = createRequestHandler({
  root,
  authoring: false,
  registry: registry as never,
  hub,
  readAbilityProjection: () => abilityProjection,
});

function createPanelFlowFixture(): void {
  writeFileSync(planPath, planBaseline);
  for (const id of ['lesson-004', 'lesson-005', 'lesson-006']) {
    rmSync(join(root, 'lessons', `${id}.md`), { force: true });
  }
  const copyLesson = (
    id: string,
    status: 'active' | 'paused' | 'abandoned',
    title: string,
  ) => {
    const source = lesson003Baseline
      .replace('id: lesson-003', `id: ${id}`)
      .replace('status: prepared', `status: ${status}`)
      .replace(
        '# Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验',
        `# ${title}`,
      );
    const path = `lessons/${id}.md`;
    writeFileSync(join(root, path), source);
    setBlockStatus(root, path, 'orientation', 'completed');
    setBlockStatus(root, path, 'assessment-01', 'active');
  };
  copyLesson('lesson-004', 'active', 'Lesson 004：正在进行的连续性核验');
  copyLesson('lesson-005', 'paused', 'Lesson 005：已暂停的迁移练习');
  copyLesson('lesson-006', 'abandoned', 'Lesson 006：已归档的旧安排');

  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace(
      '\n## Current Position',
      [
        '4. [Lesson 004：正在进行的连续性核验](../lessons/lesson-004.md) — active。',
        '5. [Lesson 005：已暂停的迁移练习](../lessons/lesson-005.md) — paused。',
        '6. [Lesson 006：已归档的旧安排](../lessons/lesson-006.md) — abandoned。',
        '',
        '## Current Position',
      ].join('\n'),
    ),
  );

  appendTrace(root, {
    lessonPath: 'lessons/lesson-004.md',
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: 'step_2',
    materialPath: null,
    assessment: 'incomplete',
    support: 'tutor',
    note: 'unique-superseded-term：旧判断，等待学生补充。',
    supersedes: null,
    methods: { primary: '同构变形与换元法', secondary: ['参变量分离'] },
  }, () => new Date('2026-07-28T08:00:00Z'));
  appendTrace(root, {
    lessonPath: 'lessons/lesson-004.md',
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: 'step_2',
    materialPath: null,
    assessment: 'partially_correct',
    support: 'none',
    note: 'unique-active-term：已独立写出定义域，参数边界仍需核验。',
    supersedes: 'event-001',
    methods: { primary: '同构变形与换元法', secondary: ['参变量分离'] },
  }, () => new Date('2026-07-28T08:01:00Z'));

  mkdirSync(join(root, 'materials'), { recursive: true });
  writeFileSync(
    join(root, 'materials/panel-flow-note.md'),
    '# 公开研习材料\n\npanel-material-term：只包含学生可见的复习说明。',
  );
  mkdirSync(join(root, '.claude/personas'), { recursive: true });
  writeFileSync(join(root, '.claude/personas/custom-guide.md'), `# Custom Guide

- ID: \`custom-guide\`
- Display name: 青黛学伴
- Student preview: 温和而利落，先听清你的路线再回应。
- Glyph: 黛
- Accent: #48636f

- INTERNAL: this line is prompt-only
`);
}

function resetPanelFlowFixture(): void {
  writeFileSync(planPath, planBaseline);
  for (const id of ['lesson-004', 'lesson-005', 'lesson-006']) {
    rmSync(join(root, 'lessons', `${id}.md`), { force: true });
  }
  rmSync(join(root, 'materials/panel-flow-note.md'), { force: true });
  rmSync(join(root, '.claude/personas/custom-guide.md'), { force: true });
  personaSelections.clear();
}

Bun.serve({
  hostname: '127.0.0.1',
  port: 65000,
  fetch(request, server) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/__test/panel-flow/start') {
      createPanelFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/panel-flow/reset') {
      resetPanelFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/register-plan') {
      writeFileSync(join(root, 'plans/isomorphic-transformation.md'), `---
id: isomorphic-transformation
kind: plan
status: active
coach_session: null
---
# Plan：同构变形

## Goal

识别同构结构。

## Observable Capability Standard

在陌生外壳中独立说明同构结构。

## Test

完成一张未见题的首次尝试。

## Planning Basis

当前测试需要一份完整 Plan。来源：[Roadmap](../ROADMAP.md#plan-graph)。

## Lesson Index

（暂无）

## Current Position

等待开始。

## Next Lesson Candidate

待讨论。

## Plan Summary

尚无。
`);
      registerPlan(root, 'isomorphic-transformation');
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/complete-isomorphic-plan') {
      const lessonPath = 'lessons/isomorphic-evidence.md';
      writeFileSync(join(root, lessonPath), `---
id: isomorphic-evidence
kind: lesson
plan_id: isomorphic-transformation
status: closed
---
# 同构评估证据

## Lesson Configuration

- Primary template: \`assessment\`

## Block assessment-01（必做）

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

独立完成评估。

## Lesson Summary

学生独立完成评估。

## Aliases

（本课不使用题卡别名）

## Traces
`);
      const isomorphicPlanPath = join(root, 'plans/isomorphic-transformation.md');
      writeFileSync(
        isomorphicPlanPath,
        readFileSync(isomorphicPlanPath, 'utf8').replace(
          '（暂无）',
          '1. [同构评估证据](../lessons/isomorphic-evidence.md) — closed。',
        ),
      );
      const trace = appendTrace(root, {
        lessonPath,
        blockId: 'assessment-01',
        cardAlias: null,
        cardStepId: null,
        materialPath: null,
        assessment: 'correct',
        support: 'none',
        note: '学生无提示独立完成评估。',
        supersedes: null,
      }, () => new Date('2026-07-29T08:00:00Z'));
      updatePlan(root, 'plans/isomorphic-transformation.md', {
        decision: 'complete',
        currentPosition: '本周期已完成。',
        nextLessonCandidate: '由学生选择其他 Plan。',
        learningReview: {
          conclusion: '已完成测试 Plan。',
          boundary: '只用于 E2E 路由验收，不代表真实能力结论。',
          nextStep: '由学生选择其他 Plan。',
          keyEvidence: [{
            claim: '无提示独立完成测试评估。',
            source: trace.sourceAnchor,
          }],
          supportingEvidence: [],
          openQuestions: [],
        },
      });
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/reject-next-lesson-start') {
      setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'prepared');
      rejectNextLessonStart = true;
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/close-lesson') {
      closeLesson(root, 'lessons/lesson-003.md', {
        summary: '完成第一项核验；第二项尚未进行。来源：#trace-event-001。',
      });
      const message: ChatMessage = {
        id: 'fixture-close-message',
        role: 'tutor',
        text: '这节课先停在这里。第一项已完成，第二项留到下次。',
        complete: true,
      };
      fixtureHistory.set('tutor:lesson-003', [{ kind: 'message', message }]);
      hub.publish({
        type: 'message',
        sessionKey: 'tutor:lesson-003',
        message,
      });
      hub.publish({
        type: 'snapshot',
        workspace: readPlanWorkspace(root, 'domain-integrity'),
      });
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/reset-close-lesson') {
      writeFileSync(lesson003Path, lesson003Baseline);
      fixtureHistory.delete('tutor:lesson-003');
      return Response.json({ ok: true });
    }
    return appFetch(request, server);
  },
  websocket: {
    open(socket) { clients.add(socket); },
    close(socket) { clients.delete(socket); },
    message() {},
  },
});

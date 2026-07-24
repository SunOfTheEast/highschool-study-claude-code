import { join, resolve } from 'node:path';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { AbilityProjection, SessionKey } from '../../src/shared/contracts';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import {
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

const sourceRoot = resolve(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
const root = mkdtempSync(`${tmpdir()}/studyforge-e2e-`);
cpSync(sourceRoot, root, { recursive: true });
const hub = new EventHub();
const coachKey: SessionKey = 'coach:domain-integrity';

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
  snapshot: (planId = 'domain-integrity') => readPlanWorkspace(root, planId),
  history: () => [],
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
  personaId: () => resolvePersona(root).id,
  setPersona: async () => {},
  openCoach: async () => ({ sessionId: 'fixture-coach' }),
  openTutor: async () => ({ sessionId: 'fixture-tutor' }),
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
  pauseLesson: async () => {},
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

Bun.serve({
  hostname: '127.0.0.1',
  port: 65000,
  fetch(request, server) {
    const url = new URL(request.url);
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
      updatePlan(root, 'plans/isomorphic-transformation.md', {
        decision: 'complete',
        currentPosition: '本周期已完成。',
        nextLessonCandidate: '由学生选择其他 Plan。',
        planSummary: '测试用 completed Plan。',
      });
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/reject-next-lesson-start') {
      setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'prepared');
      rejectNextLessonStart = true;
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

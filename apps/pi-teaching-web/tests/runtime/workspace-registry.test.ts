import { afterEach, expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderHandoff } from 'highschool-study-markdown/study-domain';
import type { StudySession, StudySessionFactory } from '../../src/runtime/session-factory';
import { appendSessionOwner } from '../../src/runtime/session-owner';
import type { NodeSessionScope } from '../../src/runtime/session-scope';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'study-registry-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

function moveLessonToNestedPath(root: string): void {
  const flat = join(root, 'lessons/lesson-003.md');
  const nestedDirectory = join(root, 'lessons/unit-a');
  const nested = join(nestedDirectory, 'lesson-003.md');
  mkdirSync(nestedDirectory, { recursive: true });
  writeFileSync(
    nested,
    readFileSync(flat, 'utf8').replaceAll('../cards/', '../../cards/'),
  );
  rmSync(flat);

  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace(
      '../lessons/lesson-003.md',
      '../lessons/unit-a/lesson-003.md',
    ),
  );
}

function editLesson(root: string, edit: (source: string) => string): string {
  const path = join(root, 'lessons/lesson-003.md');
  writeFileSync(path, edit(readFileSync(path, 'utf8')));
  return path;
}

function editPlan(root: string, edit: (source: string) => string): string {
  const path = join(root, 'plans/domain-integrity.md');
  writeFileSync(path, edit(readFileSync(path, 'utf8')));
  return path;
}

function completePlanForMemoryReview(root: string): void {
  editPlan(root, (source) => {
    const handoff = renderHandoff({
      id: 'domain-integrity/handoff',
      from: 'plan:domain-integrity',
      to: 'roadmap:roadmap',
      sealedAt: '2026-08-06T10:00:00.000Z',
    }, {
      learnerClaims: [{
        statement: '学生更适合先独立尝试。',
        scope: '训练课。',
        sources: ['trace:trace-fixture-002'],
        boundary: '新概念课尚未核验。',
        nextUse: '作为学生偏好候选。',
      }],
      teachingClaims: [],
      openQuestions: [],
    });
    return `${source
      .replace('status: active', 'status: completed')
      .replace(/\n## Handoff[\s\S]*$/, '')
      .trimEnd()}\n\n${handoff}`;
  });
}

function idleWorkflowMethods() {
  return {
    entries: [],
    triggerLessonStart: async () => {},
    deepModeEnabled: () => false,
    setDeepMode: () => {},
    workflows: () => [],
    memoryReview: () => null,
    saveMemoryReview: () => {},
    notifyMemoryReviewApplied: async () => {},
    confirmWorkflow: async () => { throw new Error('WORKFLOW_NOT_FOUND'); },
    cancelWorkflow: () => {},
    subscribeWorkflows: () => () => {},
  };
}

test('refreshes a cached parent Session before the next turn', async () => {
  const root = fixture();
  const refreshed: string[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    ...idleWorkflowMethods(),
    refreshNodeContext: async () => {
      refreshed.push(`${role}:${ownerId}`);
    },
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  });
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.openCoach('domain-integrity');
  expect(refreshed).toEqual([]);

  await registry.openCoach('domain-integrity');
  expect(refreshed).toEqual(['coach:domain-integrity']);
});

test('applies student-confirmed memory in trusted Runtime and notifies the same Plan Coach', async () => {
  const root = fixture();
  let latest: MemoryReviewSnapshot = {
    id: 'review-1',
    planId: 'domain-integrity',
    status: 'proposed',
    items: [{
      id: 'preference-1',
      operation: 'add',
      owner: 'student',
      currentId: null,
      currentText: null,
      proposedText: '先独立尝试。',
      sources: ['claim:domain-integrity/handoff#learner-c1'],
      rationale: '重复出现。',
      counterEvidence: '暂无。',
      scope: '训练课。',
    }],
    decisions: [],
  } satisfies MemoryReviewSnapshot;
  const saved: MemoryReviewSnapshot['status'][] = [];
  const notified: MemoryReviewSnapshot[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    ...idleWorkflowMethods(),
    memoryReview: () => role === 'coach' && ownerId === 'domain-integrity'
      ? latest
      : null,
    saveMemoryReview: (snapshot) => {
      latest = snapshot;
      saved.push(snapshot.status);
    },
    notifyMemoryReviewApplied: async (snapshot) => {
      notified.push(snapshot);
    },
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  });
  const beforeStudent = readFileSync(join(root, 'memory/student-profile.md'), 'utf8');
  const registry = new WorkspaceRegistry(root, factory, async () => null);
  await registry.openCoach('domain-integrity');
  completePlanForMemoryReview(root);

  expect(await registry.memoryReview('coach:domain-integrity')).toEqual(latest);
  await expect(registry.memoryReview('coach:@roadmap'))
    .rejects.toThrow('MEMORY_REVIEW_PLAN_COACH_ONLY');
  await expect(registry.memoryReview('tutor:lesson-003'))
    .rejects.toThrow('MEMORY_REVIEW_PLAN_COACH_ONLY');

  const decisions: MemoryReviewDecision[] = [{
    itemId: 'preference-1',
    action: 'accept',
    text: null,
  }];
  const applied = await registry.submitMemoryReview(
    'coach:domain-integrity',
    'review-1',
    decisions,
  );
  expect(applied).toMatchObject({
    status: 'applied',
    decisions,
    receipt: { appliedItems: ['preference-1'] },
  });
  expect(saved).toEqual(['submitted', 'applied']);
  expect(notified).toEqual([applied]);
  expect(readFileSync(join(root, 'memory/student-profile.md'), 'utf8'))
    .not.toBe(beforeStudent);
  expect(readFileSync(join(root, 'memory/student-profile.md'), 'utf8'))
    .toContain('先独立尝试。');
});

test('restores the owned completed Plan Session only for trusted memory confirmation', async () => {
  const root = fixture();
  editPlan(root, (source) => source.replace(
    'coach_session: null',
    'coach_session: session-memory-review',
  ));
  completePlanForMemoryReview(root);
  let latest: MemoryReviewSnapshot = {
    id: 'review-restore',
    planId: 'domain-integrity',
    status: 'proposed',
    items: [{
      id: 'preference-restore',
      operation: 'add',
      owner: 'student',
      currentId: null,
      currentText: null,
      proposedText: '先自己比较两条路线。',
      sources: ['claim:domain-integrity/handoff#learner-c1'],
      rationale: 'Plan 结论支持。',
      counterEvidence: '新概念课尚未核验。',
      scope: '训练课。',
    }],
    decisions: [],
  };
  const opened: Array<string | null> = [];
  const factory: StudySessionFactory = async (input) => {
    opened.push(input.sessionFile);
    return {
      sessionId: 'session-memory-review',
      sessionFile: input.sessionFile ?? undefined,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      memoryReview: () => latest,
      saveMemoryReview: (snapshot) => { latest = snapshot; },
      notifyMemoryReviewApplied: async () => {},
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(
    root,
    factory,
    async (_root, sessionId, scope) => {
      expect(sessionId).toBe('session-memory-review');
      expect(scope).toMatchObject({
        nodeKind: 'plan',
        nodeId: 'domain-integrity',
        nodePath: 'plans/domain-integrity.md',
      });
      return '/tmp/session-memory-review.jsonl';
    },
  );

  expect(await registry.memoryReview('coach:domain-integrity')).toEqual(latest);
  expect(opened).toEqual(['/tmp/session-memory-review.jsonl']);
  expect(await registry.submitMemoryReview(
    'coach:domain-integrity',
    'review-restore',
    [{ itemId: 'preference-restore', action: 'accept', text: null }],
  )).toMatchObject({ status: 'applied' });
});

test('creates Coach eagerly and Tutor only after start', async () => {
  const created: string[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    created.push(`${role}:${ownerId}`);
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    } satisfies StudySession;
  };
  const registry = new WorkspaceRegistry(fixture(), factory, async () => null);
  await registry.openCoach('domain-integrity');
  expect(created).toEqual(['coach:domain-integrity']);
  expect(registry.snapshot('domain-integrity').lessons[2]?.tutorSessionId).toBeNull();

  await registry.startLesson('lesson-003');
  expect(created).toEqual(['coach:domain-integrity', 'tutor:lesson-003']);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('active');
});

test('keeps a prepared Plan sessionless until the explicit start action', async () => {
  const root = fixture();
  editPlan(root, (source) => source
    .replace('status: active', 'status: prepared')
    .replace(
      'Activated at: 2026-07-21T08:00:00.000Z',
      'Activated at: pending',
    ));
  let factoryCalls = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    factoryCalls += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  expect(registry.snapshot('domain-integrity').plan.status).toBe('prepared');
  expect(await registry.readHistory('coach:domain-integrity')).toEqual([]);
  await expect(registry.openCoach('domain-integrity'))
    .rejects.toThrow('PLAN_SESSION_NOT_ACTIVE: prepared');
  expect(factoryCalls).toBe(0);

  const receipt = await registry.startPlan('domain-integrity');
  expect(receipt).toMatchObject({
    nodeKind: 'plan',
    sessionKey: 'coach:domain-integrity',
    shouldKickoff: true,
  });
  expect(factoryCalls).toBe(1);
  expect(registry.snapshot('domain-integrity').plan.status).toBe('active');
});

test('coalesces concurrent starts into one Tutor Session and one kickoff leader', async () => {
  const root = fixture();
  let tutorCreations = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    if (role === 'tutor') tutorCreations += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  const starts = await Promise.all([
    registry.startLesson('lesson-003'),
    registry.startLesson('lesson-003'),
  ]);

  expect(tutorCreations).toBe(1);
  expect(starts.map((start) => start.shouldKickoff)).toEqual([true, false]);
  expect(registry.snapshot('domain-integrity').lessons[2]).toMatchObject({
    status: 'active',
    tutorSessionId: 'tutor-lesson-003',
  });
});

test('resumes a paused Lesson with the same live Tutor Session', async () => {
  const root = fixture();
  let tutorCreations = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    if (role === 'tutor') tutorCreations += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.startLesson('lesson-003');
  await registry.pauseLesson('lesson-003');
  const resumed = await registry.startLesson('lesson-003');

  expect(resumed.shouldKickoff).toBe(true);
  expect(tutorCreations).toBe(1);
  expect(registry.snapshot('domain-integrity').lessons[2]).toMatchObject({
    status: 'active',
    tutorSessionId: 'tutor-lesson-003',
  });
});

test('keeps a prepared Lesson prepared until its Tutor Session exists', async () => {
  const root = fixture();
  let notifyTutorEntered!: () => void;
  let releaseTutor!: () => void;
  const tutorEntered = new Promise<void>((resolve) => {
    notifyTutorEntered = resolve;
  });
  const tutorReleased = new Promise<void>((resolve) => {
    releaseTutor = resolve;
  });
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    if (role === 'tutor') {
      notifyTutorEntered();
      await tutorReleased;
    }
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  const starting = registry.startLesson('lesson-003');
  await tutorEntered;

  expect(registry.snapshot('domain-integrity').lessons[2]).toMatchObject({
    status: 'prepared',
    tutorSessionId: null,
  });

  releaseTutor();
  await starting;

  expect(registry.snapshot('domain-integrity').lessons[2]).toMatchObject({
    status: 'active',
    tutorSessionId: 'tutor-lesson-003',
  });
});

test('leaves a prepared Lesson unchanged when Tutor Session creation fails', async () => {
  const root = fixture();
  const lessonPath = join(root, 'lessons/lesson-003.md');
  const before = readFileSync(lessonPath, 'utf8');
  const factory: StudySessionFactory = async () => {
    throw new Error('tutor factory failed');
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await expect(registry.startLesson('lesson-003'))
    .rejects.toThrow('tutor factory failed');

  expect(readFileSync(lessonPath, 'utf8')).toBe(before);
  expect(registry.snapshot('domain-integrity').lessons[2]).toMatchObject({
    status: 'prepared',
    tutorSessionId: null,
  });
});

test('restores terminal Lesson history from its owned Pi JSONL without creating an Agent', async () => {
  const root = fixture();
  const manager = SessionManager.create(root, join(root, 'pi-sessions'));
  appendSessionOwner(manager, {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  });
  manager.appendMessage({
    role: 'user',
    content: '这是进程重启前保留下来的作答。',
    timestamp: Date.now(),
  });
  manager.appendMessage({
    role: 'assistant',
    content: [{ type: 'text', text: '这条反馈也应当被恢复。' }],
    api: 'openai-completions',
    provider: 'test',
    model: 'test-model',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  });
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) throw new Error('TEST_SESSION_NOT_PERSISTED');
  editLesson(root, (source) => source
    .replace('status: prepared', 'status: closed')
    .replace('tutor_session: null', `tutor_session: ${manager.getSessionId()}`));
  let factoryCalls = 0;
  const registry = new WorkspaceRegistry(
    root,
    async () => {
      factoryCalls += 1;
      throw new Error('replay must not create an Agent Session');
    },
    async (_root, sessionId, expected) => {
      if (sessionId !== manager.getSessionId()) return null;
      expect(sessionId).toBe(manager.getSessionId());
      expect(expected).toEqual({
        nodeKind: 'lesson',
        nodeId: 'lesson-003',
        nodePath: 'lessons/lesson-003.md',
        parentId: 'domain-integrity',
        parentPath: 'plans/domain-integrity.md',
      });
      return sessionFile;
    },
  );

  const history = await registry.replayHistory('lesson-003');

  expect(factoryCalls).toBe(0);
  expect(history).toEqual([
    {
      kind: 'message',
      message: expect.objectContaining({
        role: 'student',
        text: '这是进程重启前保留下来的作答。',
        complete: true,
      }),
    },
    {
      kind: 'message',
      message: expect.objectContaining({
        role: 'tutor',
        text: '这条反馈也应当被恢复。',
        complete: true,
      }),
    },
  ]);
});

test('builds read-only safe Session evidence for a historical Lesson message', async () => {
  const root = fixture();
  const manager = SessionManager.create(root, join(root, 'pi-evidence-sessions'));
  appendSessionOwner(manager, {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  });
  manager.appendMessage({
    role: 'user',
    content: '我先检查定义域，再比较两条路线。',
    timestamp: Date.now(),
  });
  manager.appendMessage({
    role: 'assistant',
    content: [{
      type: 'text',
      text: 'PRIVATE_TOOL_PREAMBLE',
    }, {
      type: 'toolCall',
      id: 'tool-1',
      name: 'trace_search',
      arguments: {},
    }],
    api: 'openai-completions',
    provider: 'test',
    model: 'test-model',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: 'toolUse',
    timestamp: Date.now(),
  });
  const message = manager.getBranch().find((entry) => (
    entry.type === 'message'
    && (entry.message as { role?: unknown }).role === 'user'
  ));
  const hiddenAssistant = manager.getBranch().find((entry) => (
    entry.type === 'message'
    && (entry.message as { role?: unknown }).role === 'assistant'
  ));
  if (!message || !hiddenAssistant) throw new Error('TEST_MESSAGE_NOT_PERSISTED');
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) throw new Error('TEST_SESSION_NOT_PERSISTED');
  editLesson(root, (source) => source
    .replace('status: prepared', 'status: closed')
    .replace('tutor_session: null', `tutor_session: ${manager.getSessionId()}`));
  let factoryCalls = 0;
  const registry = new WorkspaceRegistry(
    root,
    async () => {
      factoryCalls += 1;
      throw new Error('evidence reads must not create an Agent Session');
    },
    async (_root, sessionId, expected) => {
      if (sessionId !== manager.getSessionId()) return null;
      expect(sessionId).toBe(manager.getSessionId());
      expect(expected).toMatchObject({
        nodeKind: 'lesson',
        nodeId: 'lesson-003',
        nodePath: 'lessons/lesson-003.md',
      });
      return sessionFile;
    },
  );

  const reader = await registry.sessionEvidenceReader();
  expect(factoryCalls).toBe(0);
  expect(reader.readSession(`session:${manager.getSessionId()}`)).toEqual({
    sessionId: manager.getSessionId(),
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  });
  expect(reader.readMessage(
    `session:${manager.getSessionId()}#message:${message.id}`,
  )).toEqual({
    role: 'student',
    text: '我先检查定义域，再比较两条路线。',
  });
  expect(reader.readMessage(
    `session:${manager.getSessionId()}#message:${hiddenAssistant.id}`,
  )).toBeNull();
});

test('omits Session evidence when the owner-checked lookup rejects the node', async () => {
  const root = fixture();
  editLesson(root, (source) => source
    .replace('status: prepared', 'status: closed')
    .replace('tutor_session: null', 'tutor_session: mismatched-session'));
  let lookupCalls = 0;
  const registry = new WorkspaceRegistry(
    root,
    async () => {
      throw new Error('evidence reads must not create an Agent Session');
    },
    async (_root, sessionId, expected) => {
      if (sessionId !== 'mismatched-session') return null;
      lookupCalls += 1;
      expect(sessionId).toBe('mismatched-session');
      expect(expected.nodeId).toBe('lesson-003');
      return null;
    },
  );

  const reader = await registry.sessionEvidenceReader();
  expect(lookupCalls).toBe(1);
  expect(reader.readSession('session:mismatched-session')).toBeNull();
});

test('reads terminal Plan history but never reopens it for writing', async () => {
  const root = fixture();
  const manager = SessionManager.create(root, join(root, 'pi-plan-sessions'));
  appendSessionOwner(manager, {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  manager.appendMessage({
    role: 'assistant',
    content: [{ type: 'text', text: '周期已经封存。' }],
    api: 'openai-completions',
    provider: 'test',
    model: 'test-model',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  });
  const sessionFile = manager.getSessionFile();
  if (!sessionFile) throw new Error('TEST_SESSION_NOT_PERSISTED');
  editPlan(root, (source) => source
    .replace('status: active', 'status: completed')
    .replace('coach_session: null', `coach_session: ${manager.getSessionId()}`));
  let factoryCalls = 0;
  const registry = new WorkspaceRegistry(
    root,
    async () => {
      factoryCalls += 1;
      throw new Error('terminal Plan must stay cold');
    },
    async () => sessionFile,
  );

  expect(await registry.readHistory('coach:domain-integrity'))
    .toEqual([{
      kind: 'message',
      message: expect.objectContaining({
        role: 'coach',
        text: '周期已经封存。',
      }),
    }]);
  await expect(registry.send('coach:domain-integrity', '继续'))
    .rejects.toThrow('PLAN_SESSION_NOT_ACTIVE: completed');
  expect(factoryCalls).toBe(0);
});

test('leaves every non-active Lesson unchanged when pause is requested', async () => {
  for (const status of ['prepared', 'paused', 'closed', 'abandoned'] as const) {
    const root = fixture();
    if (status !== 'prepared') {
      editLesson(root, (source) => source.replace('status: prepared', `status: ${status}`));
    }
    const lessonPath = join(root, 'lessons/lesson-003.md');
    const before = readFileSync(lessonPath, 'utf8');
    const registry = new WorkspaceRegistry(
      root,
      async () => { throw new Error('pause must not create a Session'); },
      async () => null,
    );

    await expect(registry.pauseLesson('lesson-003'))
      .rejects.toThrow(`LESSON_NOT_ACTIVE: ${status}`);
    expect(readFileSync(lessonPath, 'utf8')).toBe(before);
  }
});

test('creates one canonical Roadmap Coach and writes its Session back to ROADMAP.md', async () => {
  const root = fixture();
  const created: Array<{
    nodeKind: 'roadmap' | 'plan' | 'lesson';
    nodeId: string;
    nodePath: string;
    parentId: string | null;
    parentPath: string | null;
    role: 'coach' | 'tutor';
    ownerId: string;
    ownerPath: string;
    sessionFile: string | null;
  }> = [];
  const factory: StudySessionFactory = async (scope) => {
    created.push(scope);
    return {
      sessionId: 'roadmap-session-new',
      sessionFile: '/tmp/roadmap-session-new.jsonl',
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  expect(registry.roadmapSnapshot().coach.sessionId).toBeNull();
  const opened = await registry.openRoadmapCoach();
  expect(await registry.openRoadmapCoach()).toBe(opened);
  expect(await registry.openSession('coach:@roadmap')).toBe(opened);

  expect(created).toEqual([{
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
    role: 'coach',
    ownerId: 'roadmap',
    ownerPath: 'ROADMAP.md',
    sessionFile: null,
  }]);
  expect(readFileSync(join(root, 'ROADMAP.md'), 'utf8'))
    .toContain('roadmap_coach_session: roadmap-session-new');
  expect(registry.roadmapSnapshot().coach.sessionId).toBe('roadmap-session-new');
});

test('reuses a persisted Roadmap Session only after canonical owner validation', async () => {
  const root = fixture();
  const roadmapPath = join(root, 'ROADMAP.md');
  writeFileSync(
    roadmapPath,
    readFileSync(roadmapPath, 'utf8').replace(
      'status: active',
      'status: active\nroadmap_coach_session: saved-roadmap-session',
    ),
  );
  const checked: Array<{ sessionId: string; expected: NodeSessionScope }> = [];
  const opened: Array<{ sessionFile: string | null }> = [];
  const factory: StudySessionFactory = async ({ sessionFile }) => {
    opened.push({ sessionFile });
    return {
      sessionId: 'saved-roadmap-session',
      sessionFile: sessionFile ?? '/tmp/fresh-roadmap-session.jsonl',
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async (_root, sessionId, expected) => {
    checked.push({ sessionId, expected });
    return '/tmp/saved-roadmap-session.jsonl';
  });

  await registry.openRoadmapCoach();

  expect(checked).toEqual([{
    sessionId: 'saved-roadmap-session',
    expected: {
      nodeKind: 'roadmap',
      nodeId: 'roadmap',
      nodePath: 'ROADMAP.md',
      parentId: null,
      parentPath: null,
    },
  }]);
  expect(opened).toEqual([{ sessionFile: '/tmp/saved-roadmap-session.jsonl' }]);
});

test('passes canonical owner paths to Coach and Tutor factories', async () => {
  const root = fixture();
  moveLessonToNestedPath(root);
  const created: Array<{ role: 'coach' | 'tutor'; ownerId: string; ownerPath: string }> = [];
  const factory: StudySessionFactory = async ({ role, ownerId, ownerPath }) => {
    created.push({ role, ownerId, ownerPath });
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    } satisfies StudySession;
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.openCoach('domain-integrity');
  await registry.startLesson('lesson-003');

  expect(created).toEqual([
    {
      role: 'coach',
      ownerId: 'domain-integrity',
      ownerPath: 'plans/domain-integrity.md',
    },
    {
      role: 'tutor',
      ownerId: 'lesson-003',
      ownerPath: 'lessons/unit-a/lesson-003.md',
    },
  ]);
});

test('checks persisted Session IDs against the canonical owner scope before reuse', async () => {
  const root = fixture();
  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8')
      .replace('coach_session: null', 'coach_session: foreign-coach-session'),
  );
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('tutor_session: null', 'tutor_session: foreign-tutor-session'),
  );
  const checked: Array<{ sessionId: string; expected: NodeSessionScope }> = [];
  const opened: Array<{ role: string; sessionFile: string | null }> = [];
  const factory: StudySessionFactory = async ({ role, ownerId, sessionFile }) => {
    opened.push({ role, sessionFile });
    return {
      sessionId: `fresh-${role}-${ownerId}`,
      sessionFile: `/tmp/fresh-${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async (_root, sessionId, expected) => {
    checked.push({ sessionId, expected });
    return null;
  });

  await registry.openCoach('domain-integrity');
  await registry.startLesson('lesson-003');

  expect(checked).toEqual([
    {
      sessionId: 'foreign-coach-session',
      expected: {
        nodeKind: 'plan',
        nodeId: 'domain-integrity',
        nodePath: 'plans/domain-integrity.md',
        parentId: 'roadmap',
        parentPath: 'ROADMAP.md',
      },
    },
  ]);
  expect(opened).toEqual([
    { role: 'coach', sessionFile: null },
    { role: 'tutor', sessionFile: null },
  ]);
  expect(readFileSync(planPath, 'utf8')).toContain(
    'coach_session: fresh-coach-domain-integrity',
  );
  expect(readFileSync(lessonPath, 'utf8')).toContain(
    'tutor_session: fresh-tutor-lesson-003',
  );
});

test('starts a Lesson with one hidden Tutor kickoff and no student prompt', async () => {
  const kickoffs: string[] = [];
  const prompts: string[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    ...idleWorkflowMethods(),
    triggerLessonStart: async () => { kickoffs.push(ownerId); },
    prompt: async (text) => { prompts.push(text); },
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  });
  const registry = new WorkspaceRegistry(fixture(), factory, async () => null);

  await registry.startLesson('lesson-003');
  await registry.triggerLessonStart('lesson-003');

  expect(kickoffs).toEqual(['lesson-003']);
  expect(prompts).toEqual([]);
});

test('abandons an already-started Lesson before asking Coach to reprepare', async () => {
  const root = fixture();
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    ...idleWorkflowMethods(),
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  });
  const registry = new WorkspaceRegistry(root, factory, async () => null);
  await registry.startLesson('lesson-003');
  await registry.abandonForReprepare('lesson-003');
  expect(readFileSync(join(root, 'lessons/lesson-003.md'), 'utf8')).toContain('status: abandoned');
});

test('keeps Coach and Tutor persona overrides independent across reopening', async () => {
  const root = fixture();
  const selected = new Map<string, string>();
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    const owner = `${role}:${ownerId}`;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => selected.get(owner) ?? null,
      setPersona: async (id) => { selected.set(owner, id); },
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };

  const registry = new WorkspaceRegistry(root, factory, async () => '/tmp/session.jsonl');
  await registry.setPersona('coach:domain-integrity', 'energetic-classmate');
  await registry.startLesson('lesson-003');
  await registry.setPersona('tutor:lesson-003', 'neutral-tutor');
  expect(registry.personaId('coach:domain-integrity')).toBe('energetic-classmate');
  expect(registry.personaId('tutor:lesson-003')).toBe('neutral-tutor');

  registry.dispose();
  const reopened = new WorkspaceRegistry(root, factory, async () => '/tmp/session.jsonl');
  await reopened.openCoach('domain-integrity');
  await reopened.openTutor('lesson-003');
  expect(reopened.personaId('coach:domain-integrity')).toBe('energetic-classmate');
  expect(reopened.personaId('tutor:lesson-003')).toBe('neutral-tutor');
});

test('keeps deep mode scoped and refuses to open a prepared Tutor', async () => {
  const root = fixture();
  const enabled = new Map<string, boolean>();
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    const key = `${role}:${ownerId}`;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      entries: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      deepModeEnabled: () => enabled.get(key) ?? false,
      setDeepMode: (value) => { enabled.set(key, value); },
      workflows: () => [],
      memoryReview: () => null,
      saveMemoryReview: () => {},
      notifyMemoryReviewApplied: async () => {},
      confirmWorkflow: async () => { throw new Error('WORKFLOW_NOT_FOUND'); },
      cancelWorkflow: () => {},
      subscribeWorkflows: () => () => {},
      triggerLessonStart: async () => {},
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);
  await registry.setDeepMode('coach:domain-integrity', true);
  expect(await registry.deepMode('coach:domain-integrity')).toBe(true);
  await expect(registry.setDeepMode('tutor:lesson-003', true))
    .rejects.toThrow('LESSON_SESSION_NOT_ACTIVE: prepared');

  await registry.startLesson('lesson-003');
  await registry.setDeepMode('tutor:lesson-003', true);
  await registry.setDeepMode('coach:domain-integrity', false);
  expect(await registry.deepMode('coach:domain-integrity')).toBe(false);
  expect(await registry.deepMode('tutor:lesson-003')).toBe(true);
});

test.each([
  [
    'a required top-level section is missing',
    (source: string) => source.replace('## Aliases', '## Alias Draft'),
    'LESSON_SECTION_MISSING',
  ],
  [
    'a used alias is undeclared',
    (source: string) => source.replace(
      '- Uses: Q-DOMAIN-EX22',
      '- Uses: Q-NOT-DECLARED',
    ),
    'LESSON_ALIAS_MISSING',
  ],
  [
    'a used alias does not resolve to a problem card',
    (source: string) => source.replace(
      '- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml',
      '- Q-DOMAIN-EX22: ../cards/derivative/does-not-exist.card.yaml',
    ),
    'LESSON_ALIAS_INVALID',
  ],
  [
    'a problem block has no card',
    (source: string) => source.replace(
      '- Uses: Q-DOMAIN-EX22',
      '- Uses:',
    ),
    'LESSON_PROBLEM_CARD_COUNT',
  ],
  [
    'a problem block has multiple cards',
    (source: string) => source.replace(
      '- Uses: Q-DOMAIN-EX22',
      '- Uses: Q-DOMAIN-EX22, Q-DOMAIN-EX16',
    ),
    'LESSON_PROBLEM_CARD_COUNT',
  ],
] as const)('keeps a prepared Lesson unchanged when %s', async (_name, edit, code) => {
  const root = fixture();
  const path = editLesson(root, edit);
  const before = readFileSync(path, 'utf8');
  let factoryCalls = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    factoryCalls += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await expect(registry.startLesson('lesson-003')).rejects.toThrow(code);

  expect(factoryCalls).toBe(0);
  expect(readFileSync(path, 'utf8')).toBe(before);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('prepared');
});

test('starts a prepared Lesson with zero Reflection Blocks', async () => {
  const root = fixture();
  editLesson(root, (source) => source.replace(
    '## Block reflection（必做）\n\n### Node State\n\n- Kind: reflection',
    '## Block reflection（必做）\n\n### Node State\n\n- Kind: dialogue',
  ));
  let factoryCalls = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    factoryCalls += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.startLesson('lesson-003');

  expect(factoryCalls).toBe(1);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('active');
});

test('does not repeat prepared admission when resuming a paused Lesson', async () => {
  const root = fixture();
  editLesson(root, (source) => source
    .replace('status: prepared', 'status: paused')
    .replace('Activated at: pending', 'Activated at: 2026-07-30T00:00:00.000Z')
    .replace('## Aliases', '## Alias Draft'));
  let factoryCalls = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    factoryCalls += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.startLesson('lesson-003');

  expect(factoryCalls).toBe(1);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('active');
});

import { afterEach, expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StudySession, StudySessionFactory } from '../../src/runtime/session-factory';
import { appendSessionOwner } from '../../src/runtime/session-owner';
import type { StudySessionScope } from '../../src/runtime/session-scope';
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

function idleWorkflowMethods() {
  return {
    entries: [],
    triggerLessonStart: async () => {},
    deepModeEnabled: () => false,
    setDeepMode: () => {},
    workflows: () => [],
    memoryReview: () => null,
    submitMemoryReview: async () => { throw new Error('MEMORY_REVIEW_NOT_FOUND'); },
    confirmWorkflow: async () => { throw new Error('WORKFLOW_NOT_FOUND'); },
    cancelWorkflow: () => {},
    subscribeWorkflows: () => () => {},
  };
}

test('keeps memory review owned by one Plan Coach Session', async () => {
  const root = fixture();
  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('status: active', 'status: completed'),
  );
  const proposed = {
    id: 'review-1',
    planId: 'domain-integrity',
    status: 'proposed',
    items: [{
      id: 'preference-1',
      operation: 'add',
      owner: 'student',
      currentText: null,
      proposedText: '先独立尝试。',
      sources: ['lessons/lesson-001.md#trace-event-001'],
      rationale: '重复出现。',
      counterEvidence: '暂无。',
      scope: '训练课。',
    }],
    decisions: [],
  } satisfies MemoryReviewSnapshot;
  const submittedCalls: Array<{
    id: string;
    decisions: MemoryReviewDecision[];
  }> = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    ...idleWorkflowMethods(),
    memoryReview: () => role === 'coach' && ownerId === 'domain-integrity'
      ? proposed
      : null,
    submitMemoryReview: async (id, decisions) => {
      submittedCalls.push({ id, decisions });
      return { ...proposed, status: 'submitted', decisions };
    },
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  });
  const beforeStudent = readFileSync(join(root, 'memory/student-profile.md'), 'utf8');
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  expect(await registry.memoryReview('coach:domain-integrity')).toEqual(proposed);
  await expect(registry.memoryReview('coach:@roadmap'))
    .rejects.toThrow('MEMORY_REVIEW_PLAN_COACH_ONLY');
  await expect(registry.memoryReview('tutor:lesson-003'))
    .rejects.toThrow('MEMORY_REVIEW_PLAN_COACH_ONLY');

  const decisions: MemoryReviewDecision[] = [{
    itemId: 'preference-1',
    action: 'accept',
    text: null,
  }];
  expect(await registry.submitMemoryReview(
    'coach:domain-integrity',
    'review-1',
    decisions,
  )).toMatchObject({ status: 'submitted', decisions });
  expect(submittedCalls).toEqual([{ id: 'review-1', decisions }]);
  expect(readFileSync(join(root, 'memory/student-profile.md'), 'utf8')).toBe(beforeStudent);
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
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
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
  editLesson(root, (source) => source.replace(
    'status: prepared',
    `status: closed\ntutor_session: ${manager.getSessionId()}`,
  ));
  let factoryCalls = 0;
  const registry = new WorkspaceRegistry(
    root,
    async () => {
      factoryCalls += 1;
      throw new Error('replay must not create an Agent Session');
    },
    async (_root, sessionId, expected) => {
      expect(sessionId).toBe(manager.getSessionId());
      expect(expected).toEqual({
        role: 'tutor',
        ownerId: 'lesson-003',
        ownerPath: 'lessons/lesson-003.md',
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
    role: 'coach',
    ownerId: '@roadmap',
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
  const checked: Array<{ sessionId: string; expected: StudySessionScope }> = [];
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
      role: 'coach',
      ownerId: '@roadmap',
      ownerPath: 'ROADMAP.md',
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
    readFileSync(planPath, 'utf8').replace(
      'status: active',
      'status: active\ncoach_session: foreign-coach-session',
    ),
  );
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace(
      'status: prepared',
      'status: prepared\ntutor_session: foreign-tutor-session',
    ),
  );
  const checked: Array<{ sessionId: string; expected: StudySessionScope }> = [];
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
        role: 'coach',
        ownerId: 'domain-integrity',
        ownerPath: 'plans/domain-integrity.md',
      },
    },
    {
      sessionId: 'foreign-tutor-session',
      expected: {
        role: 'tutor',
        ownerId: 'lesson-003',
        ownerPath: 'lessons/lesson-003.md',
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
      submitMemoryReview: async () => { throw new Error('MEMORY_REVIEW_NOT_FOUND'); },
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
  await expect(registry.setDeepMode('tutor:lesson-003', true)).rejects.toThrow('LESSON_NOT_OPEN');

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

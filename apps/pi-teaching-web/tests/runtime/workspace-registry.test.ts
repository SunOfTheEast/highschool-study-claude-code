import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StudySession, StudySessionFactory } from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'study-registry-'));
  roots.push(root);
  cpSync(join(import.meta.dir, '../../../../examples/derivative-demo/learning-set'), root, {
    recursive: true,
  });
  return root;
}

function idleWorkflowMethods() {
  return {
    triggerLessonStart: async () => {},
    deepModeEnabled: () => false,
    setDeepMode: () => {},
    workflows: () => [],
    confirmWorkflow: async () => { throw new Error('WORKFLOW_NOT_FOUND'); },
    cancelWorkflow: () => {},
    subscribeWorkflows: () => () => {},
  };
}

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
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      deepModeEnabled: () => enabled.get(key) ?? false,
      setDeepMode: (value) => { enabled.set(key, value); },
      workflows: () => [],
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

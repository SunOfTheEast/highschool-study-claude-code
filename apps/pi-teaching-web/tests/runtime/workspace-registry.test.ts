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

test('creates Coach eagerly and Tutor only after start', async () => {
  const created: string[] = [];
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    created.push(`${role}:${ownerId}`);
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
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

test('abandons an already-started Lesson before asking Coach to reprepare', async () => {
  const root = fixture();
  const factory: StudySessionFactory = async ({ role, ownerId }) => ({
    sessionId: `${role}-${ownerId}`,
    sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
    messages: [],
    isStreaming: false,
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

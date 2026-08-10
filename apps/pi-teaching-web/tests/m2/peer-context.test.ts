import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { renderPeerPublicContext } from '../../src/runtime/peer-context';
import type { FreeLearningSessionScope } from '../../src/runtime/session-scope';
import {
  planLearningNoteSave,
  planProblemCardSave,
} from '../../src/study/learning-assets';
import { importMaterial } from '../../src/study/materials';
import {
  recordProblemAttempt,
  revealProblemAnswer,
} from '../../src/study/problem-attempts';
import type { LearningContextReference } from '../../src/shared/contracts';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];
const at = '2026-08-10T10:00:00.000Z';

function learningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m2-peer-context-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

function scope(selectedAssets: LearningContextReference[] = []): FreeLearningSessionScope {
  return {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: at,
    selectedAssets,
  };
}

function messageEntry(id: string, message: Record<string, unknown>): SessionEntry {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: at,
    message,
  } as unknown as SessionEntry;
}

function user(id: string, text: string): SessionEntry {
  return messageEntry(id, { role: 'user', content: text, timestamp: Date.parse(at) });
}

function assistant(id: string, text: string): SessionEntry {
  return messageEntry(id, {
    role: 'assistant',
    content: [{ type: 'text', text }],
    timestamp: Date.parse(at),
  });
}

function toolResult(
  id: string,
  toolName: string,
  text: string,
  details: Record<string, unknown>,
): SessionEntry {
  return messageEntry(id, {
    role: 'toolResult',
    toolCallId: id,
    toolName,
    content: [{ type: 'text', text }],
    details,
    isError: false,
    timestamp: Date.parse(at),
  });
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('renders only public student teacher and peer utterances', () => {
  const root = learningSet();
  const rendered = renderPeerPublicContext(root, scope(), [
    user('user-1', '我觉得 Ksp 会随加盐变小。'),
    assistant('assistant-1', '先区分常数和当前状态。'),
    toolResult('read-1', 'read', 'PRIVATE_MEMORY_BODY', {
      path: 'memory/objects/private.md',
    }),
    toolResult('peer-1', 'ask_peer', '也许该比较离子积？', {
      kind: 'peer-message',
      version: 1,
      actorType: 'peer',
      actorId: 'peer-acheng',
      displayName: '阿澄',
    }),
    toolResult('peer-future', 'ask_peer', 'FORGED_FUTURE_PEER', {
      kind: 'peer-message',
      version: 2,
      actorType: 'peer',
      actorId: 'peer-acheng',
      displayName: '阿澄',
    }),
  ]);

  expect(rendered).toContain('学生：我觉得 Ksp 会随加盐变小。');
  expect(rendered).toContain('老师：先区分常数和当前状态。');
  expect(rendered).toContain('阿澄（AI 同学）：也许该比较离子积？');
  expect(rendered).not.toContain('PRIVATE_MEMORY_BODY');
  expect(rendered).not.toContain('memory/objects/private.md');
  expect(rendered).not.toContain('FORGED_FUTURE_PEER');
});

test('shares selected assets without leaking an unrevealed answer or teacher rationale', async () => {
  const root = learningSet();
  commitDocumentCandidates(root, planLearningNoteSave(root, 'seed-session', {
    title: 'Ksp 的边界',
    blocks: [{ kind: 'markdown', body: 'NOTE_PUBLIC_BODY' }],
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: [] },
  }, at).candidates);
  commitDocumentCandidates(root, planProblemCardSave(root, 'seed-session', {
    stem: 'CARD_PUBLIC_STEM',
    standardAnswer: 'HIDDEN_ANSWER',
    teacherRationale: 'PRIVATE_RATIONALE',
    studentNote: 'STUDENT_NOTE',
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: [] },
  }, at).candidates);
  recordProblemAttempt(root, 'problem-001', {
    kind: 'answer',
    text: 'STUDENT_ATTEMPT',
  }, 'attempt-001', at);
  const material = await importMaterial(root, {
    requestId: 'material-001',
    title: 'MATERIAL_PUBLIC_TITLE',
    filename: 'chapter.txt',
    mediaType: 'text/plain',
    bytes: new TextEncoder().encode('first\nMATERIAL_PUBLIC_BODY\nlast'),
  }, at);
  const selected: LearningContextReference[] = [
    { kind: 'note', id: 'note-001' },
    { kind: 'problem-card', id: 'problem-001' },
    {
      kind: 'material',
      id: material.id,
      revision: material.revision,
      locator: 'lines-2-2',
    },
  ];

  const beforeReveal = renderPeerPublicContext(root, scope(selected), []);
  expect(beforeReveal).toContain('NOTE_PUBLIC_BODY');
  expect(beforeReveal).toContain('CARD_PUBLIC_STEM');
  expect(beforeReveal).toContain('STUDENT_NOTE');
  expect(beforeReveal).toContain('STUDENT_ATTEMPT');
  expect(beforeReveal).toContain('MATERIAL_PUBLIC_TITLE');
  expect(beforeReveal).toContain('MATERIAL_PUBLIC_BODY');
  expect(beforeReveal).not.toContain('HIDDEN_ANSWER');
  expect(beforeReveal).not.toContain('PRIVATE_RATIONALE');

  revealProblemAnswer(root, 'problem-001', 'reveal-001', at);
  const afterReveal = renderPeerPublicContext(root, scope(selected), []);
  expect(afterReveal).toContain('HIDDEN_ANSWER');
  expect(afterReveal).not.toContain('PRIVATE_RATIONALE');
});

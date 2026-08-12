import { afterEach, expect, test } from 'bun:test';
import { Check } from 'typebox/value';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { EventHub } from '../../src/server/event-hub';
import { createRequestHandler } from '../../src/server/app';
import {
  createAssetReviewCandidateQueryTool,
} from '../../src/runtime/asset-review-tools';
import { createFreeLearningTools } from '../../src/runtime/free-learning-tools';
import { createLessonTools } from '../../src/runtime/lesson-tools';
import { createPlanTools } from '../../src/runtime/plan-tools';
import {
  loadStaticFreeLearningResources,
} from '../../src/runtime/resource-loader';
import {
  appendSessionOwner,
  readSessionOwner,
} from '../../src/runtime/session-owner';
import {
  META_MODEL_TOOLS,
  modelToolsForFreeLearning,
  modelToolsForNode,
  type FreeLearningSessionScope,
} from '../../src/runtime/session-scope';
import type {
  SessionFactoryInput,
  StudySession,
  StudySessionFactory,
} from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readProblemCard,
} from '../../src/study/learning-assets';
import {
  readAssetReviewHistory,
  recordAssetReviewEvent,
} from '../../src/study/asset-reviews';
import { refreshSemanticRecallIndex } from '../../src/study/semantic-index';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const course = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copy(source = blank): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-guided-review-'));
  cpSync(source, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function manager(id = 'free-session-001') {
  return {
    getSessionId: () => id,
    getBranch: () => [] as SessionEntry[],
  };
}

async function execute(
  tool: { execute: (...arguments_: any[]) => Promise<any> },
  callId: string,
  input: unknown,
) {
  const result = await tool.execute(callId, input, undefined, undefined, {});
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, any>;
}

function named<T extends { name: string }>(tools: readonly T[], name: string): T {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function fakeSession(id: string): StudySession {
  return {
    sessionId: id,
    sessionFile: `/sessions/${id}.jsonl`,
    messages: [],
    entries: [],
    isStreaming: false,
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    sendCustomMessage: async () => {},
    dispose: () => {},
  };
}

test('persists review intent, upgrades legacy owners to open, and restores one compact brief', async () => {
  const root = copy();
  const note = planLearningNoteSave(root, 'seed-session', {
    title: 'Ksp 的边界',
    blocks: [{ kind: 'markdown', body: '纯固体活度并入平衡常数。' }],
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['固体活度'] },
  }, '2026-08-01T08:00:00.000Z');
  commitDocumentCandidates(root, note.candidates);

  const scope: FreeLearningSessionScope = {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-12T08:00:00.000Z',
    selectedAssets: [{ kind: 'note', id: note.note.id }],
    intent: 'review',
  };
  const entries: unknown[] = [];
  const ownerManager = {
    appendCustomEntry: (customType: string, data?: unknown) => {
      entries.push({ type: 'custom', customType, data });
    },
    getEntries: () => entries,
  };
  appendSessionOwner(ownerManager, scope);
  expect(readSessionOwner(ownerManager)).toEqual(scope);

  const legacyManager = {
    getEntries: () => [{
      type: 'custom',
      customType: 'studyforge.m0.session-owner.v1',
      data: { ...scope, intent: undefined },
    }],
  };
  expect(readSessionOwner(legacyManager)).toMatchObject({ intent: 'open' });

  const inputs: SessionFactoryInput[] = [];
  const factory: StudySessionFactory = async (input) => {
    inputs.push(input);
    return fakeSession('review-session-001');
  };
  const registry = new WorkspaceRegistry(root, factory);
  await registry.createFreeLearning(scope.selectedAssets, 'review');
  expect(inputs[0]).toMatchObject({ intent: 'review', sessionFile: null });

  const resources = loadStaticFreeLearningResources(root, scope);
  const brief = resources.agentsFiles.find((item) => item.path.includes('asset-review-brief'));
  expect(brief?.content).toContain('source-1');
  expect(brief?.content).toContain('2026-08-02');
  expect(brief?.content).toContain('stage: 0');
  expect(brief?.content).not.toContain('纯固体活度并入平衡常数');
  expect(brief?.content).not.toContain('event-001');
});

test('opens a 13-item review from one complete lightweight index while ordinary context stays bounded', async () => {
  const root = copy();
  const selected = [] as Array<{ kind: 'note'; id: string }>;
  for (let index = 1; index <= 13; index += 1) {
    const planned = planLearningNoteSave(root, 'seed-session', {
      title: `复习候选 ${index}`,
      blocks: [{ kind: 'markdown', body: `不应批量注入的秘密正文 ${index}` }],
      sources: [],
      tags: { core: [`标签 ${index}`], related: [] },
    }, `2026-08-${String(index).padStart(2, '0')}T08:00:00.000Z`);
    commitDocumentCandidates(root, planned.candidates);
    selected.push({ kind: 'note', id: planned.note.id });
  }
  refreshSemanticRecallIndex(root);

  const factory: StudySessionFactory = async () => fakeSession('review-session-many');
  const registry = new WorkspaceRegistry(root, factory);
  const created = await registry.createFreeLearning(selected, 'review');
  expect(created.selectedAssets).toHaveLength(13);
  await expect(registry.createFreeLearning(selected, 'open'))
    .rejects.toThrow('SELECTED_CONTEXT_LIMIT_EXCEEDED');

  const reviewScope: FreeLearningSessionScope = {
    sessionKind: 'free-learning', title: '自由学习', intent: 'review',
    createdAt: '2026-08-12T10:00:00.000Z', selectedAssets: selected,
  };
  const resources = loadStaticFreeLearningResources(root, reviewScope);
  const brief = resources.agentsFiles.find((item) => item.path.includes('asset-review-brief'));
  const serialized = resources.agentsFiles.map((item) => item.content).join('\n');
  expect(brief?.content).toContain('source-13');
  expect(brief?.content).toContain('title: "复习候选 13"');
  expect(brief?.content).toContain('tags: ["标签 13"]');
  expect(brief?.content).toContain('path: notes/note-013.note.yaml');
  expect(resources.agentsFiles.some((item) => item.path.includes('selected-assets'))).toBeFalse();
  expect(resources.agentsFiles.some((item) => item.path.includes('problem-activity'))).toBeFalse();
  expect(serialized).not.toContain('不应批量注入的秘密正文');

  const openScope: FreeLearningSessionScope = { ...reviewScope, intent: 'open', selectedAssets: selected.slice(0, 12) };
  const ordinary = loadStaticFreeLearningResources(root, openScope);
  expect(ordinary.agentsFiles.find((item) => item.path.includes('selected-assets'))?.content)
    .toContain('不应批量注入的秘密正文 12');

  const httpRegistry = new WorkspaceRegistry(
    root,
    async () => fakeSession('review-session-http-many'),
  );
  const handler = createRequestHandler({
    root,
    registry: httpRegistry,
    hub: new EventHub(),
  });
  const response = await handler(new Request('http://local/api/free-learning', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ selectedAssets: selected, intent: 'review' }),
  }));
  expect(response?.status).toBe(201);
});

test('records only selected Free Learning aliases and leaves untouched batch assets due', async () => {
  const root = copy();
  const note = planLearningNoteSave(root, 'seed-session', {
    title: 'Note A', blocks: [{ kind: 'markdown', body: 'A' }], sources: [],
    tags: { core: ['A'], related: [] },
  }, '2026-08-01T08:00:00.000Z');
  commitDocumentCandidates(root, note.candidates);
  const card = planProblemCardSave(root, 'seed-session', {
    stem: 'Card B', standardAnswer: 'B', teacherRationale: 'B', studentNote: '',
    sources: [], tags: { core: ['B'], related: [] },
  }, '2026-08-01T08:10:00.000Z');
  commitDocumentCandidates(root, card.candidates);
  const scope: FreeLearningSessionScope = {
    sessionKind: 'free-learning', title: '自由学习',
    createdAt: '2026-08-12T08:00:00.000Z', intent: 'review',
    selectedAssets: [
      { kind: 'note', id: note.note.id },
      { kind: 'problem-card', id: card.card.id },
    ],
  };
  const tool = named(createFreeLearningTools(root, scope, manager()), 'record_asset_review');
  expect(Check(tool.parameters, { alias: 'source-1', result: 'effortful' })).toBeTrue();
  expect(Check(tool.parameters, {
    alias: 'source-1', result: 'effortful', revision: 1, sessionKey: 'free:forged',
  })).toBeFalse();

  const result = await execute(tool, 'review-note-once', {
    alias: 'source-1', result: 'effortful',
  });
  expect(result).toMatchObject({
    ok: true,
    asset: { alias: 'source-1', kind: 'note', id: note.note.id, revision: 1 },
    result: 'effortful',
  });
  expect(readAssetReviewHistory(root, { kind: 'note', id: note.note.id }).events.at(-1))
    .toMatchObject({
      kind: 'reviewed', result: 'effortful',
      evidence: { kind: 'session', sessionKey: 'free:free-session-001' },
    });
  expect(readAssetReviewHistory(root, { kind: 'problem-card', id: card.card.id }).events)
    .toHaveLength(1);
  await expect(execute(tool, 'review-note-twice', {
    alias: 'source-1', result: 'fluent',
  })).rejects.toThrow('ASSET_REVIEW_ALREADY_RECORDED_TODAY');
  await expect(execute(tool, 'forged-alias', {
    alias: 'source-3', result: 'forgot',
  })).rejects.toThrow('ASSET_REVIEW_ALIAS_UNKNOWN');
});

test('binds Lesson review writes to current Uses and keeps the write tool out of planning scopes', async () => {
  const root = copy(course);
  const card = readProblemCard(root, 'sample-card');
  recordAssetReviewEvent(root, { kind: 'problem-card', id: card.id }, {
    requestId: 'manual-enrollment',
    at: '2026-08-01T08:00:00.000Z',
    localDate: '2026-08-01',
    event: { kind: 'enrolled', assetRevision: card.revision, trigger: { kind: 'manual' } },
  });
  const lessonScope = {
    nodeKind: 'lesson' as const,
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  };
  const tool = named(
    createLessonTools(root, lessonScope.nodePath, manager('lesson-session-001'), undefined, undefined, lessonScope),
    'record_asset_review',
  );
  await execute(tool, 'lesson-review', { alias: 'source-1', result: 'fluent' });
  expect(readAssetReviewHistory(root, { kind: 'problem-card', id: card.id }).events.at(-1))
    .toMatchObject({
      kind: 'reviewed', result: 'fluent',
      evidence: { kind: 'session', sessionKey: 'lesson:plan-001:lesson-001' },
    });
  await expect(execute(tool, 'lesson-forged', {
    alias: 'source-2', result: 'forgot',
  })).rejects.toThrow('ASSET_REVIEW_ALIAS_UNKNOWN');

  expect(modelToolsForNode('lesson')).toContain('record_asset_review');
  expect(modelToolsForNode('plan')).not.toContain('record_asset_review');
  expect(modelToolsForNode('roadmap')).not.toContain('record_asset_review');
  expect(META_MODEL_TOOLS).not.toContain('record_asset_review');
  expect(modelToolsForFreeLearning(false, false, false, false, false))
    .not.toContain('record_asset_review');
  expect(modelToolsForFreeLearning(false, false, false, false, true))
    .toContain('record_asset_review');
});

test('returns one bounded read-only preparation list without leaking asset bodies or review history', async () => {
  const root = copy();
  for (let index = 1; index <= 9; index += 1) {
    const note = planLearningNoteSave(root, 'seed-session', {
      title: `复习候选 ${index}`,
      blocks: [{ kind: 'markdown', body: `不应进入摘要的正文 ${index}` }],
      sources: [], tags: { core: [`标签 ${index}`], related: [] },
    }, `2026-08-0${index}T08:00:00.000Z`);
    commitDocumentCandidates(root, note.candidates);
  }
  refreshSemanticRecallIndex(root);
  const indexBefore = readFileSync(join(root, 'activity/asset-reviews/index.tsv'), 'utf8');
  const firstLogBefore = readFileSync(
    join(root, 'activity/asset-reviews/notes/note-001.md'),
    'utf8',
  );
  const tool = createAssetReviewCandidateQueryTool(
    root,
    () => new Date('2026-08-20T08:00:00.000Z'),
  );
  expect(Check(tool.parameters, { limit: 3 })).toBeTrue();
  expect(Check(tool.parameters, { limit: 9 })).toBeFalse();
  const result = await execute(tool, 'prepare-query', { limit: 3 });
  expect(result.matched).toBe(9);
  expect(result.candidates).toHaveLength(3);
  expect(result.candidates[0]).toMatchObject({
    alias: 'review-1', kind: 'note', title: '复习候选 1', tags: ['标签 1'],
  });
  expect(JSON.stringify(result)).not.toContain('不应进入摘要的正文');
  expect(JSON.stringify(result)).not.toContain('event-001');
  expect(readFileSync(join(root, 'activity/asset-reviews/index.tsv'), 'utf8'))
    .toBe(indexBefore);
  expect(readFileSync(join(root, 'activity/asset-reviews/notes/note-001.md'), 'utf8'))
    .toBe(firstLogBefore);

  const planScope = {
    nodeKind: 'plan' as const, nodeId: 'plan-001',
    nodePath: 'plans/plan-001/PLAN.md', parentId: 'roadmap', parentPath: 'ROADMAP.md',
  };
  expect(createPlanTools(root, planScope).map((candidate) => candidate.name))
    .toContain('list_due_asset_reviews');
  expect(modelToolsForNode('plan')).toContain('list_due_asset_reviews');
  expect(modelToolsForNode('roadmap')).not.toContain('list_due_asset_reviews');
});

test('keeps one teaching bright line in the Free, Lesson, and preparation routes', () => {
  const skills = join(import.meta.dir, '../../resources/skills');
  const shared = readFileSync(
    join(skills, 'references/learning-methods/batch-asset-review.md'),
    'utf8',
  );
  expect(shared).toContain('先做未受提示污染的检索');
  expect(shared).toContain('只记录真正触及的资产');
  expect(shared).toContain('当天第一次冷检索');
  expect(readFileSync(join(skills, 'free-learning/SKILL.md'), 'utf8'))
    .toContain('batch-asset-review.md');
  expect(readFileSync(join(skills, 'tutor-lesson/SKILL.md'), 'utf8'))
    .toContain('batch-asset-review.md');
  const prepare = readFileSync(join(skills, 'prepare-approved-lesson/SKILL.md'), 'utf8');
  expect(prepare).toContain('list_due_asset_reviews');
  expect(prepare).toContain('读取候选不构成复习');
});

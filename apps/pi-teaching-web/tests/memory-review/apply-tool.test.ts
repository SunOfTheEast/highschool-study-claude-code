import { afterEach, expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createMemoryReviewApplyTool,
  type ProfileFileOps,
} from '../../src/memory-review/apply-tool';
import type {
  MemoryReviewDecision,
  MemoryReviewItem,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import {
  parseProfileDocument,
  renderProfileDocument,
  type ProfileEntry,
  type ProfileOwner,
} from '../../src/memory-review/profile-document';
import { MemoryReviewStore } from '../../src/memory-review/store';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(
  student: ProfileEntry[] = [],
  teaching: ProfileEntry[] = [],
): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-review-apply-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('status: active', 'status: completed'),
  );
  for (const [owner, entries] of [
    ['student', student],
    ['teaching', teaching],
  ] as const) {
    const path = join(root, `memory/${owner}-profile.md`);
    writeFileSync(
      path,
      renderProfileDocument(readFileSync(path, 'utf8'), owner, entries),
    );
  }
  return root;
}

function add(
  id: string,
  owner: ProfileOwner,
  proposedText: string,
): MemoryReviewItem {
  return {
    id,
    operation: 'add',
    owner,
    currentText: null,
    proposedText,
    sources: ['lessons/lesson-003.md#lesson-summary'],
    rationale: '这个偏好在本周期重复出现。',
    counterEvidence: '暂无。',
    scope: '当前 Roadmap',
  };
}

function submitted(
  items: MemoryReviewItem[],
  decisions: MemoryReviewDecision[],
  id = 'review-1',
): MemoryReviewSnapshot {
  return {
    id,
    planId: 'domain-integrity',
    status: 'submitted',
    items,
    decisions,
  };
}

async function execute(
  root: string,
  store: MemoryReviewStore,
  reviewId = 'review-1',
  fileOps?: ProfileFileOps,
) {
  const tool = createMemoryReviewApplyTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    store,
    fileOps,
  );
  return tool.execute(
    'apply-1',
    { reviewId },
    new AbortController().signal,
    undefined,
    {} as never,
  );
}

function entries(root: string, owner: ProfileOwner): ProfileEntry[] {
  return parseProfileDocument(
    readFileSync(join(root, `memory/${owner}-profile.md`), 'utf8'),
    owner,
  );
}

test('allocates stable S/T IDs for accepted additions and persists an applied receipt', async () => {
  const root = fixture();
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const items = [
    add('student-add', 'student', '先独立尝试，再请求提示。'),
    add('teaching-add', 'teaching', '先等待学生完成第一轮尝试。'),
  ];
  store.save(submitted(items, items.map((item) => ({
    itemId: item.id,
    action: 'accept',
    text: null,
  }))));

  const result = await execute(root, store);
  expect(entries(root, 'student')).toEqual([
    expect.objectContaining({ id: 'S1', content: items[0]!.proposedText }),
  ]);
  expect(entries(root, 'teaching')).toEqual([
    expect.objectContaining({ id: 'T1', content: items[1]!.proposedText }),
  ]);
  expect(store.latest()).toMatchObject({
    status: 'applied',
    receipt: {
      reviewId: 'review-1',
      appliedItems: ['student-add', 'teaching-add'],
      unchangedItems: [],
    },
  });
  const content = result.content[0];
  if (content?.type !== 'text') throw new Error('Expected text receipt');
  expect(JSON.parse(content.text)).toMatchObject({
    ok: true,
    reviewId: 'review-1',
  });
});

test('applies revise/delete/rewrite semantics and leaves rejected candidates unchanged', async () => {
  const initialStudent: ProfileEntry[] = [
    {
      id: 'S1',
      content: '喜欢每一步都确认。',
      scope: '导数专题',
      sources: ['plans/domain-integrity.md#plan-summary'],
      rationale: '旧阶段观察。',
      counterEvidence: '暂无。',
    },
    {
      id: 'S2',
      content: '希望保留自己的解法。',
      scope: '训练课',
      sources: ['lessons/lesson-002.md#lesson-summary'],
      rationale: '旧阶段观察。',
      counterEvidence: '暂无。',
    },
  ];
  const initialTeaching: ProfileEntry[] = [{
    id: 'T1',
    content: '先给完整讲解。',
    scope: '训练课',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '旧阶段观察。',
    counterEvidence: '暂无。',
  }];
  const root = fixture(initialStudent, initialTeaching);
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const items: MemoryReviewItem[] = [
    {
      ...add('revise-teaching', 'teaching', '先等待学生完整尝试。'),
      operation: 'revise',
      currentText: '先给完整讲解。',
    },
    {
      ...add('delete-student', 'student', 'unused'),
      operation: 'delete',
      currentText: '喜欢每一步都确认。',
      proposedText: null,
    },
    {
      ...add('rewrite-delete', 'student', 'unused'),
      operation: 'delete',
      currentText: '希望保留自己的解法。',
      proposedText: null,
    },
    add('reject-add', 'student', '希望每题都看标准解。'),
  ];
  store.save(submitted(items, [
    { itemId: 'revise-teaching', action: 'accept', text: null },
    { itemId: 'delete-student', action: 'accept', text: null },
    { itemId: 'rewrite-delete', action: 'rewrite', text: '希望先比较自己的解法。' },
    { itemId: 'reject-add', action: 'reject', text: null },
  ]));

  await execute(root, store);
  expect(entries(root, 'student').map(({ id, content }) => ({ id, content }))).toEqual([
    { id: 'S2', content: '希望先比较自己的解法。' },
  ]);
  expect(entries(root, 'teaching').map(({ id, content }) => ({ id, content }))).toEqual([
    { id: 'T1', content: '先等待学生完整尝试。' },
  ]);
  expect(store.latest()).toMatchObject({
    status: 'applied',
    receipt: {
      appliedItems: ['revise-teaching', 'delete-student', 'rewrite-delete'],
      unchangedItems: ['reject-add'],
    },
  });
});

test('uses the student rewrite text for add and revise operations', async () => {
  const root = fixture([], [{
    id: 'T1',
    content: '先给完整讲解。',
    scope: '训练课',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '旧阶段观察。',
    counterEvidence: '暂无。',
  }]);
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const items: MemoryReviewItem[] = [
    add('rewrite-add', 'student', '模型原提议。'),
    {
      ...add('rewrite-revise', 'teaching', '模型原提议。'),
      operation: 'revise',
      currentText: '先给完整讲解。',
    },
  ];
  store.save(submitted(items, [
    { itemId: 'rewrite-add', action: 'rewrite', text: '学生改成先独立尝试。' },
    { itemId: 'rewrite-revise', action: 'rewrite', text: '学生改成先问卡点。' },
  ]));

  await execute(root, store);
  expect(entries(root, 'student')[0]?.content).toBe('学生改成先独立尝试。');
  expect(entries(root, 'teaching')[0]?.content).toBe('学生改成先问卡点。');
});

test('rejects a stale exact current text before changing either profile', async () => {
  const root = fixture([], [{
    id: 'T1',
    content: '当前真实内容。',
    scope: '训练课',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '旧阶段观察。',
    counterEvidence: '暂无。',
  }]);
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const item: MemoryReviewItem = {
    ...add('stale-revise', 'teaching', '新内容。'),
    operation: 'revise',
    currentText: '已经过期的内容。',
  };
  store.save(submitted(
    [item],
    [{ itemId: item.id, action: 'accept', text: null }],
  ));
  const studentPath = join(root, 'memory/student-profile.md');
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const beforeStudent = readFileSync(studentPath, 'utf8');
  const beforeTeaching = readFileSync(teachingPath, 'utf8');

  await expect(execute(root, store))
    .rejects.toThrow('MEMORY_REVIEW_CURRENT_TEXT_MISMATCH: stale-revise');
  expect(readFileSync(studentPath, 'utf8')).toBe(beforeStudent);
  expect(readFileSync(teachingPath, 'utf8')).toBe(beforeTeaching);
});

test('is idempotent after application and rejects a non-latest or foreign review', async () => {
  const root = fixture();
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const item = add('student-add', 'student', '先独立尝试。');
  store.save(submitted([item], [{ itemId: item.id, action: 'accept', text: null }]));
  const first = await execute(root, store);
  const before = readFileSync(join(root, 'memory/student-profile.md'), 'utf8');
  const second = await execute(root, store);
  expect(second.content).toEqual(first.content);
  expect(readFileSync(join(root, 'memory/student-profile.md'), 'utf8')).toBe(before);

  await expect(execute(root, store, 'review-older'))
    .rejects.toThrow('MEMORY_REVIEW_NOT_FOUND');
  const foreign = createMemoryReviewApplyTool(
    root,
    'another-plan',
    'plans/domain-integrity.md',
    store,
  );
  await expect(foreign.execute(
    'foreign',
    { reviewId: 'review-1' },
    new AbortController().signal,
    undefined,
    {} as never,
  )).rejects.toThrow('MEMORY_REVIEW_OWNER_MISMATCH');
});

test('restores both profile files when installing the second target fails', async () => {
  const root = fixture();
  const store = new MemoryReviewStore(SessionManager.inMemory(root));
  const items = [
    add('student-add', 'student', '先独立尝试。'),
    add('teaching-add', 'teaching', '先等待学生尝试。'),
  ];
  store.save(submitted(items, items.map((item) => ({
    itemId: item.id,
    action: 'accept',
    text: null,
  }))));
  const studentPath = join(root, 'memory/student-profile.md');
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const beforeStudent = readFileSync(studentPath, 'utf8');
  const beforeTeaching = readFileSync(teachingPath, 'utf8');
  const fileOps: ProfileFileOps = {
    read: (path) => readFileSync(path, 'utf8'),
    write: (path, source) => writeFileSync(path, source),
    rename: (from, to) => {
      if (to.endsWith('/memory/teaching-profile.md') && from.includes('.tmp')) {
        throw new Error('INJECTED_SECOND_RENAME_FAILURE');
      }
      renameSync(from, to);
    },
    remove: (path) => rmSync(path, { force: true }),
    exists: existsSync,
  };

  await expect(execute(root, store, 'review-1', fileOps))
    .rejects.toThrow('INJECTED_SECOND_RENAME_FAILURE');
  expect(readFileSync(studentPath, 'utf8')).toBe(beforeStudent);
  expect(readFileSync(teachingPath, 'utf8')).toBe(beforeTeaching);
  expect(store.latest()?.status).toBe('submitted');
});

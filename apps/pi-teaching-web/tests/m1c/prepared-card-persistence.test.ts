import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { NodeSessionScope } from '../../src/runtime/session-scope';
import { createPlanTools } from '../../src/runtime/plan-tools';
import { readProblemCard } from '../../src/study/learning-assets';
import { readLesson } from '../../src/study/markdown';
import { readSemanticTags } from '../../src/study/semantic-tags';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];
const scope: NodeSessionScope = {
  nodeKind: 'plan',
  nodeId: 'plan-001',
  nodePath: 'plans/plan-001/PLAN.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
};

function copyFixture(prepared = true): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-prepared-card-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  if (prepared) {
    const path = join(root, lessonPath);
    writeFileSync(path, readFileSync(path, 'utf8').replace('status: active', 'status: prepared'));
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function message(id: string, role: 'user' | 'assistant', text: string): SessionEntry {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-08-09T11:00:00.000Z',
    message: { role, content: [{ type: 'text', text }], timestamp: Date.now() },
  } as SessionEntry;
}

function manager(entries: SessionEntry[]) {
  return {
    getSessionId: () => 'plan-session-001',
    getBranch: () => entries,
  };
}

function input() {
  return {
    lessonId: 'lesson-001',
    blockId: 'block-002',
    stem: '设函数 f(x)=e^x-ax，讨论其最小值。',
    standardAnswer: '按参数符号分类，结合驻点与端点判断。',
    teacherRationale: '观察学生能否先辨认参数位置再选择入口。',
    studentNote: '',
    tags: { core: ['参数位置'], related: ['入口选择'] },
  };
}

async function execute(
  root: string,
  entries: SessionEntry[],
  callId: string,
  payload = input(),
) {
  const tool = createPlanTools(root, scope, manager(entries))
    .find((candidate) => candidate.name === 'save_prepared_problem_card')!;
  const result = await tool.execute(callId, payload as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

test('persists one approved custom card and attaches it atomically to the prepared Block', async () => {
  const root = copyFixture();
  const entries = [
    message('a1', 'assistant', '备课已经完成。这道自编题的题干、标准答案和用途如下……要把它保存成题卡吗？'),
    message('u1', 'user', '嗯'),
  ];
  const tools = createPlanTools(root, scope, manager(entries));
  expect(tools.map((tool) => tool.name)).toContain('save_prepared_problem_card');

  const tool = tools.find((candidate) => candidate.name === 'save_prepared_problem_card')!;
  const first = await tool.execute('save-prepared-1', input() as never, undefined, undefined, {} as never);
  const replay = await tool.execute('save-prepared-1', input() as never, undefined, undefined, {} as never);
  expect(replay).toEqual(first);

  const card = readProblemCard(root, 'problem-001');
  expect(card.sources).toEqual([]);
  expect(readSemanticTags(root, { kind: 'problem-card', id: card.id }).core).toEqual(['参数位置']);
  expect(readLesson(root, lessonPath).blocks[1]?.uses).toEqual([
    'cards/sample.card.yaml',
    'cards/m1b/problem-001.card.yaml',
  ]);
});

test('attaches an approved card to an optional prepared Block with an empty Uses list', async () => {
  const root = copyFixture();
  const path = join(root, lessonPath);
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      '- Required: true\n- Status: active\n- Depends on: block-001\n- Uses: cards/sample.card.yaml',
      '- Required: false\n- Status: active\n- Depends on: block-001\n- Uses:',
    ),
  );

  await execute(root, [
    message('a1', 'assistant', '要把这道完全选做的自编题保存成题卡吗？'),
    message('u1', 'user', '题卡可以保存。'),
  ], 'save-empty-uses');

  expect(readLesson(root, lessonPath).blocks[1]).toMatchObject({
    required: false,
    uses: ['cards/m1b/problem-001.card.yaml'],
  });
});

test('keeps course approval separate and leaves no card when approval or Lesson status is invalid', async () => {
  const unapproved = copyFixture();
  await expect(execute(unapproved, [
    message('a1', 'assistant', '课程已经按方案备好。'),
    message('u1', 'user', '就按这个方案上课。'),
  ], 'course-only')).rejects.toThrow('ASSET_SAVE_NOT_CONFIRMED');
  expect(() => readProblemCard(unapproved, 'problem-001')).toThrow();

  const refused = copyFixture();
  await expect(execute(refused, [
    message('a1', 'assistant', '要把完整自编题保存成题卡吗？'),
    message('u1', 'user', '先不要保存为题卡。'),
  ], 'refused')).rejects.toThrow('ASSET_SAVE_NOT_CONFIRMED');
  expect(() => readProblemCard(refused, 'problem-001')).toThrow();

  const active = copyFixture(false);
  await expect(execute(active, [
    message('a1', 'assistant', '要把完整自编题保存成题卡吗？'),
    message('u1', 'user', '可以'),
  ], 'active-lesson')).rejects.toThrow('Lesson must be prepared');
  expect(() => readProblemCard(active, 'problem-001')).toThrow();
});

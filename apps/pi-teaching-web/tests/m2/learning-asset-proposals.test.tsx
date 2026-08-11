import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { Check } from 'typebox/value';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import {
  createLearningAssetProposalTools,
  createPlanProblemCardProposalTool,
} from '../../src/runtime/learning-asset-proposal-tools';
import { createLearningAssetTools } from '../../src/runtime/learning-asset-tools';
import {
  projectLiveSessionEvent,
} from '../../src/projection/conversation';
import {
  modelToolsForFreeLearning,
  modelToolsForNode,
} from '../../src/runtime/session-scope';
import type { ConversationItem, StudyEvent } from '../../src/shared/contracts';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];
const at = '2026-08-12T12:00:00.000Z';

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m2-proposal-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) result[relative(root, path)] = readFileSync(path, 'utf8');
    }
  };
  visit(root);
  return result;
}

function one(events: StudyEvent[]): ConversationItem {
  expect(events).toHaveLength(1);
  const event = events[0];
  if (event?.type !== 'conversation-item') throw new Error('CONVERSATION_ITEM_EXPECTED');
  return event.item;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('proposal tools display structure without touching the learning set', async () => {
  const root = copyFixture();
  const before = snapshot(root);
  const [note, card] = createLearningAssetProposalTools();
  const noteInput = {
    title: 'Ksp 与离子积',
    blocks: [{ kind: 'recall', prompt: '纯固体为什么不写入表达式？', answer: '活度并入常数。' }],
  } as const;
  const cardInput = {
    stem: '判断加入 NaCl 后 AgCl 平衡如何变化。',
    studentNote: '先看共同离子。',
    standardAnswer: 'SECRET_STANDARD_ANSWER',
    teacherRationale: 'SECRET_TEACHER_RATIONALE',
  };

  expect(Check(note!.parameters, noteInput)).toBeTrue();
  expect(Check(card!.parameters, cardInput)).toBeTrue();
  await note!.execute('note-proposal', noteInput, undefined, undefined, {} as never);
  await card!.execute('card-proposal', cardInput, undefined, undefined, {} as never);

  expect(snapshot(root)).toEqual(before);
});

test('uses a narrower create-only Problem Card proposal in Plan', () => {
  const tool = createPlanProblemCardProposalTool();
  const input = {
    lessonId: 'lesson-001',
    blockId: 'block-002',
    stem: '一道自编题。',
    studentNote: '先辨认结构。',
    standardAnswer: '答案。',
    teacherRationale: '课堂用途。',
  };

  expect(Check(tool.parameters, input)).toBeTrue();
  expect(Check(tool.parameters, {
    ...input,
    target: { id: 'problem-001', expectedRevision: 1 },
  })).toBeFalse();
  expect(modelToolsForFreeLearning(true)).toContain('propose_note');
  expect(modelToolsForFreeLearning(true)).toContain('propose_problem_card');
  expect(modelToolsForNode('lesson', true)).toContain('propose_note');
  expect(modelToolsForNode('lesson', true)).toContain('propose_problem_card');
  expect(modelToolsForNode('plan', true)).toContain('propose_problem_card');
  expect(modelToolsForNode('plan', true)).not.toContain('propose_note');
  expect(modelToolsForNode('roadmap', true)).not.toContain('propose_problem_card');
});

test('projects Note recall as collapsible and omits Problem Card secrets entirely', () => {
  const note = one(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_start',
    toolCallId: 'proposal-note',
    toolName: 'propose_note',
    args: {
      title: 'Ksp 边界',
      blocks: [{ kind: 'recall', prompt: '为什么？', answer: 'SECRET_RECALL_ANSWER' }],
    },
  } as AgentSessionEvent, at));
  const card = one(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_start',
    toolCallId: 'proposal-card',
    toolName: 'propose_problem_card',
    args: {
      stem: '公开题干',
      studentNote: '公开笔记',
      standardAnswer: 'SECRET_STANDARD_ANSWER',
      teacherRationale: 'SECRET_TEACHER_RATIONALE',
    },
  } as AgentSessionEvent, at));

  expect(JSON.stringify(note)).toContain('SECRET_RECALL_ANSWER');
  expect(JSON.stringify(card)).not.toMatch(/SECRET_STANDARD_ANSWER|SECRET_TEACHER_RATIONALE/);
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-1"
      items={[note, card]}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );
  expect(markup).toContain('笔记草稿');
  expect(markup).toContain('题卡草稿');
  expect(markup).toContain('为什么？');
  expect(markup).toContain('显示答案');
  expect(markup).not.toContain('SECRET_RECALL_ANSWER');
  expect(markup).not.toMatch(/SECRET_STANDARD_ANSWER|SECRET_TEACHER_RATIONALE/);
  expect(markup).not.toMatch(/保存草稿|修改草稿/);
});

test('projects a successful save as a clickable asset receipt', async () => {
  const root = copyFixture();
  const tools = createLearningAssetTools(root, { resolve: () => [] }, {
    getSessionId: () => 'free-session-001',
    getBranch: () => [],
  });
  const save = tools.find((tool) => tool.name === 'save_note')!;
  const result = await save.execute('save-note', {
    title: '可以打开的笔记',
    blocks: [{ kind: 'markdown', body: '正文。' }],
    sourceAliases: [],
    tags: { core: ['Ksp'], related: [] },
  }, undefined, undefined, {} as never);
  expect(statSync(join(root, 'notes/note-001.note.yaml')).isFile()).toBeTrue();

  const receipt = one(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_end',
    toolCallId: 'save-note',
    toolName: 'save_note',
    result,
    isError: false,
  } as AgentSessionEvent, at));
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-1"
      items={[receipt]}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(receipt).toMatchObject({
    kind: 'learning-asset-saved',
    asset: {
      kind: 'note',
      id: 'note-001',
      revision: 1,
      title: '可以打开的笔记',
      route: '/assets/notes/note-001',
    },
  });
  expect(markup).toContain('href="/assets/notes/note-001"');
  expect(markup).toContain('可以打开的笔记');
});

test('keeps proposal correction and natural confirmation in the teaching Skills', () => {
  const resources = join(import.meta.dir, '../../resources/skills');
  const free = readFileSync(join(resources, 'free-learning/SKILL.md'), 'utf8');
  const lesson = readFileSync(join(resources, 'tutor-lesson/SKILL.md'), 'utf8');
  const prepare = readFileSync(join(resources, 'prepare-approved-lesson/SKILL.md'), 'utf8');

  for (const source of [free, lesson]) {
    expect(source).toContain('propose_note');
    expect(source).toContain('propose_problem_card');
    expect(source).toContain('最新草稿');
    expect(source).toContain('明确确认');
  }
  expect(prepare).toContain('propose_problem_card');
  expect(prepare).toContain('标准答案');
  expect(prepare).toContain('不公开');
});

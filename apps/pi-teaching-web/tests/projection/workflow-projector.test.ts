import { expect, test } from 'bun:test';
import { projectWorkflow } from '../../src/projection/workflow-projector';

test('projects lifecycle and source count without raw child conclusions', () => {
  const view = projectWorkflow({
    id: 'wf-1',
    parentSessionKey: 'tutor:l1',
    goal: '分析下一步提示',
    mode: 'quick',
    status: 'completed',
    maxConcurrency: 2,
    tokenLimit: 12_000,
    timeoutMs: 45_000,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:10Z',
    tasks: [{
      id: 'hint',
      label: '提示审查',
      role: '提示设计员',
      instruction: 'private instruction',
      dependsOn: [],
      sourceHandles: ['cards/secret.card.yaml'],
      readRoots: ['cards'],
      status: 'completed',
      runId: 'run-1',
      tokens: 500,
      durationMs: 1000,
      toolCount: 2,
      currentTool: null,
      result: {
        card_index: [
          {
            cardPath: 'cards/a.yaml',
            title: '隐藏题卡 A',
            goal: null,
            methods: { primary: null, secondary: [] },
            reason: '与当前目标相关。',
            traceRefs: ['lessons/l.md#trace-event-1'],
          },
          {
            cardPath: 'cards/b.yaml',
            title: '隐藏题卡 B',
            goal: null,
            methods: { primary: null, secondary: [] },
            reason: '提供跨题证据。',
            traceRefs: ['lessons/l.md#trace-event-2'],
          },
        ],
        findings: ['答案是 D'],
        evidence_refs: [
          'cards/a.yaml',
          'cards/b.yaml',
          'lessons/l.md#trace-event-1',
        ],
        recommended_action: '直接说 D',
        risks: [],
      },
      error: null,
    }],
  });
  expect(view.tasks[0]).toMatchObject({
    status: 'completed',
    sourceCount: 3,
    cardCount: 2,
    progress: '分析完成',
  });
  const text = JSON.stringify(view);
  expect(text).not.toContain('答案是 D');
  expect(text).not.toContain('直接说 D');
  expect(text).not.toContain('private instruction');
  expect(text).not.toContain('run-1');
  expect(text).not.toContain('隐藏题卡 A');
  expect(text).not.toContain('与当前目标相关');
});

test('projects safe live telemetry and maps tool names to student-facing activity', () => {
  const view = projectWorkflow({
    id: 'wf-live',
    parentSessionKey: 'coach:p1',
    goal: '检索跨课证据',
    mode: 'quick',
    status: 'running',
    maxConcurrency: 1,
    tokenLimit: 50_000,
    timeoutMs: 180_000,
    createdAt: '2026-07-25T00:00:00Z',
    updatedAt: '2026-07-25T00:00:42Z',
    tasks: [{
      id: 'evidence',
      label: '检索题卡证据',
      role: 'Evidence Scout',
      instruction: 'private instruction',
      dependsOn: [],
      sourceHandles: [],
      readRoots: ['cards', 'lessons'],
      status: 'running',
      runId: 'run-private',
      tokens: 3_777,
      durationMs: 42_000,
      toolCount: 4,
      currentTool: 'card_search',
      result: null,
      error: null,
    }],
  });

  expect(view.tasks[0]).toMatchObject({
    durationMs: 42_000,
    tokens: 3_777,
    toolCount: 4,
    currentActivity: '正在检索题卡',
  });
  const text = JSON.stringify(view);
  expect(text).not.toContain('private instruction');
  expect(text).not.toContain('run-private');
});

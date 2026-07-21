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
      result: {
        findings: ['答案是 D'],
        evidence_refs: ['cards/a.yaml', 'lessons/l.md#trace-event-1'],
        recommended_action: '直接说 D',
        risks: [],
      },
      error: null,
    }],
  });
  expect(view.tasks[0]).toMatchObject({
    status: 'completed',
    sourceCount: 2,
    progress: '分析完成',
  });
  const text = JSON.stringify(view);
  expect(text).not.toContain('答案是 D');
  expect(text).not.toContain('直接说 D');
  expect(text).not.toContain('private instruction');
  expect(text).not.toContain('run-1');
});

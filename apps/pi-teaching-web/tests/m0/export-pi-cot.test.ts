import { describe, expect, test } from 'bun:test';
import { renderPiTurn } from '../../scripts/export-pi-cot';

const jsonl = [
  { type: 'session', id: 'session-001', timestamp: '2026-08-04T00:00:00Z', cwd: '/tmp/course' },
  { type: 'model_change', provider: 'deepseek', modelId: 'deepseek-v4-flash' },
  { type: 'thinking_level_change', thinkingLevel: 'low' },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:01Z',
    message: { role: 'user', content: [{ type: 'text', text: '第一回合问题' }] },
  },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:02Z',
    message: {
      role: 'assistant',
      stopReason: 'toolUse',
      usage: { reasoning: 12 },
      content: [
        { type: 'thinking', thinking: '第一段思考' },
        { type: 'toolCall', name: 'read', arguments: { path: 'plans/plan-001/PLAN.md' } },
      ],
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:03Z',
    message: {
      role: 'toolResult',
      toolName: 'read',
      content: [{ type: 'text', text: '很长的工具结果' }],
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:04Z',
    message: {
      role: 'assistant',
      stopReason: 'stop',
      usage: { reasoning: 34 },
      content: [
        { type: 'thinking', thinking: '第二段思考' },
        { type: 'text', text: '第一回合公开回复' },
      ],
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:05Z',
    message: { role: 'user', content: [{ type: 'text', text: '第二回合问题' }] },
  },
  {
    type: 'message',
    timestamp: '2026-08-04T00:00:06Z',
    message: {
      role: 'assistant',
      content: [{ type: 'thinking', thinking: '不应导出的思考' }],
    },
  },
].map((entry) => JSON.stringify(entry)).join('\n');

const subagentJsonl = [
  { type: 'session', id: 'session-with-scout', timestamp: '2026-08-05T10:00:00Z', cwd: '/tmp/course' },
  { type: 'model_change', provider: 'deepseek', modelId: 'deepseek-v4-flash' },
  {
    type: 'message',
    timestamp: '2026-08-05T10:00:01Z',
    message: { role: 'user', content: [{ type: 'text', text: '请准备这一课' }] },
  },
  {
    type: 'message',
    timestamp: '2026-08-05T10:00:05Z',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'list-agents',
        name: 'subagent',
        arguments: { action: 'list' },
      }],
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-05T10:00:06Z',
    message: {
      role: 'toolResult',
      toolCallId: 'list-agents',
      toolName: 'subagent',
      content: [{ type: 'text', text: 'Executable agents' }],
      details: { mode: 'management', results: [] },
      isError: false,
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-05T10:00:10Z',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'scout-1',
        name: 'subagent',
        arguments: { tasks: [{ agent: 'study-material-scout' }, { agent: 'study-material-scout' }] },
      }],
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-05T10:01:22Z',
    message: {
      role: 'toolResult',
      toolCallId: 'scout-1',
      toolName: 'subagent',
      content: [{ type: 'text', text: '2/2 succeeded' }],
      details: {
        results: [
          {
            agent: 'study-material-scout',
            exitCode: 0,
            sessionFile: '/tmp/child-1.jsonl',
            usage: { input: 100, output: 50, reasoning: 20 },
            progressSummary: { durationMs: 72_000, toolCount: 12 },
          },
          {
            agent: 'study-material-scout',
            exitCode: 0,
            sessionFile: '/tmp/child-2.jsonl',
            usage: { input: 200, output: 80 },
            progressSummary: { durationMs: 49_000, toolCount: 11 },
          },
        ],
        totalChildUsage: { input: 300, output: 130, reasoning: 20 },
      },
      isError: false,
    },
  },
  {
    type: 'message',
    timestamp: '2026-08-05T10:01:25Z',
    message: { role: 'assistant', content: [{ type: 'text', text: '备课完成' }] },
  },
].map((entry) => JSON.stringify(entry)).join('\n');

function childJsonl(id: string, calls: string[]): string {
  return [
    { type: 'session', id, timestamp: '2026-08-05T10:00:10Z', cwd: '/tmp/course' },
    {
      type: 'message',
      timestamp: '2026-08-05T10:00:11Z',
      message: { role: 'user', content: [{ type: 'text', text: `${id} brief` }] },
    },
    {
      type: 'message',
      timestamp: '2026-08-05T10:00:12Z',
      message: {
        role: 'assistant',
        usage: { reasoning: 7 },
        content: [
          { type: 'thinking', thinking: `${id} thinking` },
          ...calls.map((name, index) => ({
            type: 'toolCall',
            id: `${id}-${index}`,
            name,
            arguments: {},
          })),
        ],
      },
    },
  ].map((entry) => JSON.stringify(entry)).join('\n');
}

const childSessions: Record<string, string> = {
  '/tmp/child-1.jsonl': childJsonl('child-1', [
    ...Array.from({ length: 5 }, () => 'read'),
    ...Array.from({ length: 2 }, () => 'grep'),
    'ls',
  ]),
  '/tmp/child-2.jsonl': childJsonl('child-2', [
    ...Array.from({ length: 3 }, () => 'read'),
    ...Array.from({ length: 2 }, () => 'grep'),
    'find',
  ]),
};

describe('Pi CoT turn export', () => {
  test('exports one user turn without swallowing the next turn or verbose tool results', () => {
    const output = renderPiTurn(jsonl, { turn: 1, source: '/tmp/session.jsonl' });

    expect(output).toContain('deepseek/deepseek-v4-flash');
    expect(output).toContain('Thinking level: low');
    expect(output).toContain('第一回合问题');
    expect(output).toContain('第一段思考');
    expect(output).toContain('read');
    expect(output).toContain('plans/plan-001/PLAN.md');
    expect(output).toContain('第一回合公开回复');
    expect(output).toContain('Reasoning tokens: 46');
    expect(output).not.toContain('很长的工具结果');
    expect(output).not.toContain('第二回合问题');
    expect(output).not.toContain('不应导出的思考');
  });

  test('can include tool results when requested', () => {
    const output = renderPiTurn(jsonl, {
      turn: 1,
      source: '/tmp/session.jsonl',
      includeToolResults: true,
    });

    expect(output).toContain('很长的工具结果');
  });

  test('optionally distinguishes parent wall time from aggregate child compute', () => {
    const withoutSubagents = renderPiTurn(subagentJsonl, { turn: 1 });
    expect(withoutSubagents).not.toContain('## Subagent load');

    const output = renderPiTurn(subagentJsonl, {
      turn: 1,
      includeSubagents: true,
      readChildSession: (path) => childSessions[path],
    });

    expect(output).toContain('## Subagent load');
    expect(output).not.toContain('## Subagent load 2');
    expect(output).toContain('Parent wall time: 1m 12s');
    expect(output).toContain('Aggregate child compute: 2m 1s');
    expect(output).toContain('Returned children: 2 / 2');
    expect(output).toContain('Tool calls: 23');
    expect(output).toContain('read: 8');
    expect(output).toContain('grep: 4');
    expect(output).toContain('ls: 1');
    expect(output).toContain('find: 1');
    expect(output).toContain('### Child 1 · study-material-scout · completed');
    expect(output).toContain('Duration: 1m 12s');
    expect(output).toContain('Usage: input=100, output=50, reasoning=20');
    expect(output).toContain('child-1 thinking');
    expect(output).toContain('### Child 2 · study-material-scout · completed');
    expect(output).toContain('Duration: 49s');
    expect(output).toContain('Usage: input=200, output=80, reasoning=not recorded');
  });

  test('reports unavailable child evidence without inferring missing metrics', () => {
    const output = renderPiTurn(subagentJsonl, {
      turn: 1,
      includeSubagents: true,
      readChildSession: () => undefined,
    });

    expect(output).toContain('Transcript: unavailable');
    expect(output).toContain('reasoning=not recorded');
  });
});

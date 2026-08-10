import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AssistantMessage,
  Context,
  ModelsSimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { Check } from 'typebox/value';
import { createFreeLearningTools } from '../../src/runtime/free-learning-tools';
import {
  createPeerResponder,
  type PeerCompletion,
  type PeerResponderInput,
} from '../../src/runtime/peer-runner';
import {
  createPeerTool,
  PEER_MESSAGE_DETAILS,
} from '../../src/runtime/peer-tools';
import {
  modelToolsForFreeLearning,
  type FreeLearningSessionScope,
} from '../../src/runtime/session-scope';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];
const at = '2026-08-10T10:00:00.000Z';

function learningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m2-peer-tools-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

function scope(): FreeLearningSessionScope {
  return {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: at,
    selectedAssets: [],
  };
}

function userEntry(text: string): SessionEntry {
  return {
    type: 'message',
    id: 'user-1',
    parentId: null,
    timestamp: at,
    message: {
      role: 'user',
      content: text,
      timestamp: Date.parse(at),
    },
  } as unknown as SessionEntry;
}

function assistantMessage(
  content: AssistantMessage['content'],
  stopReason: AssistantMessage['stopReason'] = 'stop',
): AssistantMessage {
  return {
    role: 'assistant',
    content,
    api: 'openai-codex-responses',
    provider: 'openai-codex',
    model: 'gpt-5.6-terra',
    usage: {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 15,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: Date.parse(at),
  };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('adds ask_peer only to a configured free-learning tool surface', () => {
  const root = learningSet();
  const session = {
    getSessionId: () => 'free-session-001',
    getBranch: () => [userEntry('阿夏你怎么看？')],
  };
  const responder = async () => '我想先找一个反例。';

  expect(modelToolsForFreeLearning(true, false)).not.toContain('ask_peer');
  expect(modelToolsForFreeLearning(true, true)).toContain('ask_peer');
  expect(createFreeLearningTools(root, scope(), session).map((tool) => tool.name))
    .not.toContain('ask_peer');
  expect(createFreeLearningTools(root, scope(), session, responder).map((tool) => tool.name))
    .toContain('ask_peer');
});

test('keeps actor and runtime authority out of the ask_peer schema', () => {
  const root = learningSet();
  const tool = createPeerTool(root, scope(), {
    getSessionId: () => 'free-session-001',
    getBranch: () => [userEntry('阿夏你怎么看？')],
  }, async () => '我想先找一个反例。');
  const input = {
    peerId: 'peer-axia',
    intent: '从同学视角回应这个想法。',
    move: 'challenge',
  };

  expect(Check(tool.parameters, input)).toBeTrue();
  for (const extra of [
    { sessionId: 'free-session-001' },
    { displayName: '伪造名字' },
    { model: 'other-model' },
    { at },
  ]) {
    expect(Check(tool.parameters, { ...input, ...extra })).toBeFalse();
  }
  expect(Check(tool.parameters, { ...input, peerId: 'peer-unknown' })).toBeFalse();
  expect(Check(tool.parameters, { ...input, move: 'encourage' })).toBeFalse();
  expect(Check(tool.parameters, {
    peerId: 'peer-axia',
    intent: '不指定动作也应合法。',
  })).toBeTrue();
});

test('returns one native peer tool result from the student-visible context', async () => {
  const root = learningSet();
  const received: PeerResponderInput[] = [];
  const tool = createPeerTool(root, scope(), {
    getSessionId: () => 'free-session-001',
    getBranch: () => [userEntry('阿夏你怎么看这个判断？')],
  }, async (input) => {
    received.push(input);
    return '我会先问：有没有反例？';
  });
  const signal = new AbortController().signal;
  const result = await tool.execute('peer-call-1', {
    peerId: 'peer-axia',
    intent: '质疑当前判断。',
    move: 'challenge',
  }, signal, undefined, {} as never);

  const peerInput = received.at(0);
  expect(peerInput).toMatchObject({
    peerId: 'peer-axia',
    intent: '质疑当前判断。',
    signal,
  });
  expect(peerInput?.publicContext).toContain('学生：阿夏你怎么看这个判断？');
  expect(result).toEqual({
    content: [{ type: 'text', text: '我会先问：有没有反例？' }],
    details: { ...PEER_MESSAGE_DETAILS, move: 'challenge' },
  });
});

test('does not fabricate a peer message when generation fails', async () => {
  const root = learningSet();
  const tool = createPeerTool(root, scope(), {
    getSessionId: () => 'free-session-001',
    getBranch: () => [userEntry('阿夏你怎么看？')],
  }, async () => {
    throw new Error('PEER_RESPONSE_UNAVAILABLE');
  });

  expect(tool.execute('peer-call-1', {
    peerId: 'peer-axia',
    intent: '回应学生。',
  }, undefined, undefined, {} as never)).rejects.toThrow('PEER_RESPONSE_UNAVAILABLE');
});

test('runs the Scout once and persists only its final text', async () => {
  const receivedContexts: Context[] = [];
  let receivedOptions: ModelsSimpleStreamOptions | undefined;
  const complete: PeerCompletion = async (context, options) => {
    receivedContexts.push(context);
    receivedOptions = options;
    return assistantMessage([
      { type: 'thinking', thinking: 'PRIVATE_THOUGHT' },
      { type: 'text', text: '  先别急着下结论，我们找个反例？  ' },
    ]);
  };
  const responder = createPeerResponder(complete, 'high', 'AXIA_PERSONA');
  const signal = new AbortController().signal;
  const text = await responder({
    peerId: 'peer-axia',
    intent: '提出一个质疑。',
    publicContext: '学生：我觉得总压强变大就一定移动。',
    signal,
  });

  expect(text).toBe('先别急着下结论，我们找个反例？');
  const context = receivedContexts.at(0);
  if (!context) throw new Error('PEER_CONTEXT_NOT_CAPTURED');
  expect(context.systemPrompt).toBe('AXIA_PERSONA');
  expect(context.tools).toBeUndefined();
  expect(context.messages).toHaveLength(1);
  expect(context.messages[0]?.role).toBe('user');
  expect(context.messages[0]?.content).toContain('学生：我觉得总压强变大就一定移动。');
  expect(context.messages[0]?.content).toContain('提出一个质疑。');
  expect(receivedOptions).toMatchObject({ reasoning: 'high', signal });
  expect(JSON.stringify(context)).not.toContain('PRIVATE_THOUGHT');
});

test('rejects empty, errored, and aborted Peer completions', async () => {
  for (const response of [
    assistantMessage([{ type: 'thinking', thinking: 'only thought' }]),
    assistantMessage([{ type: 'text', text: 'provider error' }], 'error'),
    assistantMessage([{ type: 'text', text: 'cancelled' }], 'aborted'),
  ]) {
    const responder = createPeerResponder(async () => response, 'off', 'AXIA_PERSONA');
    expect(responder({
      peerId: 'peer-axia',
      intent: '回应。',
      publicContext: '学生：你好。',
    })).rejects.toThrow('PEER_RESPONSE_UNAVAILABLE');
  }
});

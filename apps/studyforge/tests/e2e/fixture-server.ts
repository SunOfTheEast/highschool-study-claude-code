import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { createLoopbackOriginPolicy } from '../../src/server/origin-policy';
import type { SessionKey } from '../../src/shared/contracts';

const source = join(import.meta.dir, '../fixtures/m0-learning-set');
const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-e2e-'));
cpSync(source, root, { recursive: true });
for (const path of ['plans/plan-001/PLAN.md', 'plans/plan-001/lessons/lesson-001.md']) {
  const absolute = join(root, path);
  writeFileSync(absolute, readFileSync(absolute, 'utf8').replace(/^status: active$/m, 'status: prepared'));
}

const histories = new Map<SessionKey, SessionEntry[]>();
const listeners = new Map<SessionKey, Set<(event: AgentSessionEvent) => void>>();
let sequence = 0;
type MessageEntry = Extract<SessionEntry, { type: 'message' }>;

function publish(key: SessionKey, event: AgentSessionEvent): void {
  for (const listener of listeners.get(key) ?? []) listener(event);
}

function messageEntry(
  role: 'user' | 'assistant',
  text: string,
  parentId: string | null,
): MessageEntry {
  sequence += 1;
  const id = `${role}-${sequence}`;
  const message = role === 'user'
    ? { role, content: text, timestamp: Date.now() }
    : {
      role,
      content: [{ type: 'text', text }],
      api: 'openai-completions',
      provider: 'fixture',
      model: 'fixture',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: Date.now(),
    };
  return {
    type: 'message',
    id,
    parentId,
    timestamp: new Date().toISOString(),
    message,
  } as MessageEntry;
}

const registry = {
  async readHistory(key: SessionKey) {
    return histories.get(key) ?? [];
  },
  async open() {},
  async abort() {},
  async release() {},
  async subscribe(key: SessionKey, listener: (event: AgentSessionEvent) => void) {
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => set.delete(listener);
  },
  async send(key: SessionKey, text: string) {
    const entries = histories.get(key) ?? [];
    const user = messageEntry('user', text, entries.at(-1)?.id ?? null);
    entries.push(user);
    histories.set(key, entries);
    publish(key, { type: 'message_end', message: user.message } as AgentSessionEvent);

    if (key === 'plan:plan-001' && text.trim() === '要讲义') {
      const toolCallId = `handout-${sequence}`;
      sequence += 1;
      const toolCall = {
        type: 'message',
        id: `assistant-tool-${sequence}`,
        parentId: user.id,
        timestamp: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: [{
            type: 'toolCall',
            id: toolCallId,
            name: 'artifact_export',
            arguments: {
              kind: 'lesson-handout',
              lessonId: 'lesson-001',
              blockIds: ['block-002', 'block-001'],
            },
          }],
          api: 'openai-completions',
          provider: 'fixture',
          model: 'fixture',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'toolUse',
          timestamp: Date.now(),
        },
      } as MessageEntry;
      sequence += 1;
      const details = {
        kind: 'lesson-handout',
        planId: 'plan-001',
        lessonId: 'lesson-001',
        blockIds: ['block-002', 'block-001'],
        title: 'Lesson 001：真实停点问诊',
        url: '/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001',
      };
      const toolResult = {
        type: 'message',
        id: `tool-result-${sequence}`,
        parentId: toolCall.id,
        timestamp: new Date().toISOString(),
        message: {
          role: 'toolResult',
          toolCallId,
          toolName: 'artifact_export',
          content: [{ type: 'text', text: JSON.stringify({ ok: true, url: details.url }) }],
          details,
          isError: false,
          timestamp: Date.now(),
        },
      } as MessageEntry;
      entries.push(toolCall, toolResult);
      publish(key, {
        type: 'tool_execution_start',
        toolCallId,
        toolName: 'artifact_export',
        args: {
          kind: 'lesson-handout',
          lessonId: 'lesson-001',
          blockIds: ['block-002', 'block-001'],
        },
      } as AgentSessionEvent);
      publish(key, {
        type: 'tool_execution_end',
        toolCallId,
        toolName: 'artifact_export',
        result: { details },
        isError: false,
      } as AgentSessionEvent);
      const assistant = messageEntry('assistant', '讲义已经整理好，课程仍然可以直接开始。', toolResult.id);
      entries.push(assistant);
      publish(key, { type: 'message_end', message: assistant.message } as AgentSessionEvent);
      publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
      return;
    }

    const toolCallId = `read-${sequence}`;
    sequence += 1;
    const toolCall = {
      type: 'message',
      id: `assistant-tool-${sequence}`,
      parentId: user.id,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [{
          type: 'toolCall',
          id: toolCallId,
          name: 'read',
          arguments: { path: key.startsWith('roadmap:') ? 'ROADMAP.md' : 'plans/plan-001/PLAN.md' },
        }],
        api: 'openai-completions',
        provider: 'fixture',
        model: 'fixture',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'toolUse',
        timestamp: Date.now(),
      },
    } as MessageEntry;
    sequence += 1;
    const toolResult = {
      type: 'message',
      id: `tool-result-${sequence}`,
      parentId: toolCall.id,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId,
        toolName: 'read',
        content: [{ type: 'text', text: 'local markdown' }],
        details: { source: 'local markdown' },
        isError: false,
        timestamp: Date.now(),
      },
    } as MessageEntry;
    entries.push(toolCall, toolResult);

    publish(key, {
      type: 'tool_execution_start',
      toolCallId,
      toolName: 'read',
      args: { path: key.startsWith('roadmap:') ? 'ROADMAP.md' : 'plans/plan-001/PLAN.md' },
    } as AgentSessionEvent);
    publish(key, {
      type: 'tool_execution_end',
      toolCallId,
      toolName: 'read',
      result: { details: { source: 'local markdown' } },
      isError: false,
    } as AgentSessionEvent);

    const reply = '我听见你说恒成立问题比较棘手。具体是哪一种结构最容易让你停下来？';
    const assistant = messageEntry('assistant', reply, toolResult.id);
    entries.push(assistant);
    publish(key, { type: 'message_end', message: assistant.message } as AgentSessionEvent);
    publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
  },
};

const hub = new EventHub();
const clients = new Set<{ send(data: string): void }>();
hub.subscribe((event) => {
  const data = JSON.stringify(event);
  for (const client of clients) client.send(data);
});

const port = Number(process.env.STUDYFORGE_E2E_API_PORT ?? 65000);
const clientPort = Number(process.env.STUDYFORGE_E2E_CLIENT_PORT ?? 65001);
const originPolicy = createLoopbackOriginPolicy(
  port,
  `http://127.0.0.1:${clientPort}`,
);
const handler = createRequestHandler({
  root,
  registry: registry as never,
  hub,
  originPolicy,
});
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: handler,
  websocket: {
    open(socket) {
      clients.add(socket);
    },
    close(socket) {
      clients.delete(socket);
    },
    message() {},
  },
});

const cleanup = () => {
  server.stop(true);
  rmSync(root, { recursive: true, force: true });
};
process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);

console.log(`StudyForge M0 fixture: http://${server.hostname}:${server.port}`);

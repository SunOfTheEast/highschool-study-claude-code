import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { createFreeLearningTools } from '../../src/runtime/free-learning-tools';
import { FREE_LEARNING_ENDED_TYPE } from '../../src/runtime/session-owner';
import type { FreeLearningSessionScope } from '../../src/runtime/session-scope';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type {
  FreeLearningSessionSummary,
  LearningAssetReference,
  SessionKey,
} from '../../src/shared/contracts';
import { readProblemCard } from '../../src/study/learning-assets';
import { readProblemActivity } from '../../src/study/problem-attempts';

type MessageEntry = Extract<SessionEntry, { type: 'message' }>;

const m0Source = join(import.meta.dir, '../fixtures/m0-learning-set');
const m1bSource = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const m0Root = mkdtempSync(join(tmpdir(), 'studyforge-m0-e2e-'));
const m1bRoot = mkdtempSync(join(tmpdir(), 'studyforge-m1b-e2e-'));
cpSync(m0Source, m0Root, { recursive: true });
cpSync(m1bSource, m1bRoot, { recursive: true });
for (const path of ['plans/plan-001/PLAN.md', 'plans/plan-001/lessons/lesson-001.md']) {
  const absolute = join(m0Root, path);
  writeFileSync(absolute, readFileSync(absolute, 'utf8').replace(/^status: active$/m, 'status: prepared'));
}

function assistantMessage(text: string, timestamp: number) {
  return {
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text }],
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
    stopReason: 'stop' as const,
    timestamp,
  };
}

// The M0 fixture remains unchanged in behavior. M1b gets a separate blank root and registry,
// selected by a test-only cookie, so the two browser closures cannot contaminate each other.
const m0Histories = new Map<SessionKey, SessionEntry[]>();
const m0Listeners = new Map<SessionKey, Set<(event: AgentSessionEvent) => void>>();
let m0Sequence = 0;

function publishM0(key: SessionKey, event: AgentSessionEvent): void {
  for (const listener of m0Listeners.get(key) ?? []) listener(event);
}

function m0MessageEntry(
  role: 'user' | 'assistant',
  text: string,
  parentId: string | null,
): MessageEntry {
  m0Sequence += 1;
  const timestamp = Date.now() + m0Sequence;
  return {
    type: 'message',
    id: `${role}-${m0Sequence}`,
    parentId,
    timestamp: new Date(timestamp).toISOString(),
    message: role === 'user'
      ? { role, content: text, timestamp }
      : assistantMessage(text, timestamp),
  } as MessageEntry;
}

const m0Registry = {
  async readHistory(key: SessionKey) {
    return m0Histories.get(key) ?? [];
  },
  async open() {},
  async abort() {},
  async release() {},
  async createFreeLearning() {
    throw new Error('M0_FIXTURE_FREE_LEARNING_DISABLED');
  },
  async listFreeLearning() {
    return [];
  },
  async endFreeLearning() {
    throw new Error('M0_FIXTURE_FREE_LEARNING_DISABLED');
  },
  async subscribe(key: SessionKey, listener: (event: AgentSessionEvent) => void) {
    const set = m0Listeners.get(key) ?? new Set();
    set.add(listener);
    m0Listeners.set(key, set);
    return () => set.delete(listener);
  },
  async send(key: SessionKey, text: string) {
    const entries = m0Histories.get(key) ?? [];
    const user = m0MessageEntry('user', text, entries.at(-1)?.id ?? null);
    entries.push(user);
    m0Histories.set(key, entries);
    publishM0(key, { type: 'message_end', message: user.message } as AgentSessionEvent);

    if (key === 'plan:plan-001' && text.trim() === '要讲义') {
      const toolCallId = `handout-${m0Sequence}`;
      m0Sequence += 1;
      const toolCall = {
        type: 'message',
        id: `assistant-tool-${m0Sequence}`,
        parentId: user.id,
        timestamp: new Date(Date.now() + m0Sequence).toISOString(),
        message: {
          ...assistantMessage('', Date.now() + m0Sequence),
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
          stopReason: 'toolUse',
        },
      } as MessageEntry;
      m0Sequence += 1;
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
        id: `tool-result-${m0Sequence}`,
        parentId: toolCall.id,
        timestamp: new Date(Date.now() + m0Sequence).toISOString(),
        message: {
          role: 'toolResult',
          toolCallId,
          toolName: 'artifact_export',
          content: [{ type: 'text', text: JSON.stringify({ ok: true, url: details.url }) }],
          details,
          isError: false,
          timestamp: Date.now() + m0Sequence,
        },
      } as MessageEntry;
      entries.push(toolCall, toolResult);
      publishM0(key, {
        type: 'tool_execution_start',
        toolCallId,
        toolName: 'artifact_export',
        args: {
          kind: 'lesson-handout',
          lessonId: 'lesson-001',
          blockIds: ['block-002', 'block-001'],
        },
      } as AgentSessionEvent);
      publishM0(key, {
        type: 'tool_execution_end',
        toolCallId,
        toolName: 'artifact_export',
        result: { details },
        isError: false,
      } as AgentSessionEvent);
      const assistant = m0MessageEntry('assistant', '讲义已经整理好，课程仍然可以直接开始。', toolResult.id);
      entries.push(assistant);
      publishM0(key, { type: 'message_end', message: assistant.message } as AgentSessionEvent);
      publishM0(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
      return;
    }

    const toolCallId = `read-${m0Sequence}`;
    m0Sequence += 1;
    const path = key.startsWith('roadmap:') ? 'ROADMAP.md' : 'plans/plan-001/PLAN.md';
    const toolCall = {
      type: 'message',
      id: `assistant-tool-${m0Sequence}`,
      parentId: user.id,
      timestamp: new Date(Date.now() + m0Sequence).toISOString(),
      message: {
        ...assistantMessage('', Date.now() + m0Sequence),
        content: [{ type: 'toolCall', id: toolCallId, name: 'read', arguments: { path } }],
        stopReason: 'toolUse',
      },
    } as MessageEntry;
    m0Sequence += 1;
    const toolResult = {
      type: 'message',
      id: `tool-result-${m0Sequence}`,
      parentId: toolCall.id,
      timestamp: new Date(Date.now() + m0Sequence).toISOString(),
      message: {
        role: 'toolResult',
        toolCallId,
        toolName: 'read',
        content: [{ type: 'text', text: 'local markdown' }],
        details: { source: 'local markdown' },
        isError: false,
        timestamp: Date.now() + m0Sequence,
      },
    } as MessageEntry;
    entries.push(toolCall, toolResult);
    publishM0(key, {
      type: 'tool_execution_start', toolCallId, toolName: 'read', args: { path },
    } as AgentSessionEvent);
    publishM0(key, {
      type: 'tool_execution_end',
      toolCallId,
      toolName: 'read',
      result: { details: { source: 'local markdown' } },
      isError: false,
    } as AgentSessionEvent);
    const assistant = m0MessageEntry(
      'assistant',
      '我听见你说恒成立问题比较棘手。具体是哪一种结构最容易让你停下来？',
      toolResult.id,
    );
    entries.push(assistant);
    publishM0(key, { type: 'message_end', message: assistant.message } as AgentSessionEvent);
    publishM0(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
  },
};

type StoredFreeSession = FreeLearningSessionSummary & {
  selectedAssets: LearningAssetReference[];
  entries: SessionEntry[];
};

class M1bFixtureRegistry {
  private records = new Map<string, StoredFreeSession>();
  private listeners = new Map<SessionKey, Set<(event: AgentSessionEvent) => void>>();
  private sequence = 0;
  private clock = Date.parse('2026-08-08T10:00:00.000Z');
  private readonly storePath: string;

  constructor(private readonly root: string) {
    this.storePath = join(root, '.studyforge-e2e-free-sessions.json');
    this.reload();
  }

  private nextTimestamp(): number {
    this.clock += 1_000;
    return this.clock;
  }

  private persist(): void {
    writeFileSync(this.storePath, `${JSON.stringify([...this.records.values()], null, 2)}\n`);
  }

  private reload(): void {
    this.records.clear();
    if (existsSync(this.storePath)) {
      const records = JSON.parse(readFileSync(this.storePath, 'utf8')) as StoredFreeSession[];
      for (const record of records) this.records.set(record.id, record);
    }
    this.sequence = Math.max(0, ...[...this.records.keys()].map((id) => (
      Number(/^free-session-([0-9]+)$/.exec(id)?.[1] ?? 0)
    )));
    this.clock = Math.max(
      Date.parse('2026-08-08T10:00:00.000Z'),
      ...[...this.records.values()].map((record) => Date.parse(record.updatedAt)),
    );
  }

  reset(): void {
    const expectedPrefix = join(tmpdir(), 'studyforge-m1b-e2e-');
    if (!this.root.startsWith(expectedPrefix)) throw new Error('M1B_FIXTURE_ROOT_INVALID');
    rmSync(this.root, { recursive: true, force: true });
    cpSync(m1bSource, this.root, { recursive: true });
    this.records.clear();
    this.listeners.clear();
    this.sequence = 0;
    this.clock = Date.parse('2026-08-08T10:00:00.000Z');
    this.persist();
  }

  restart(): void {
    this.listeners.clear();
    this.reload();
  }

  private summary(record: StoredFreeSession): FreeLearningSessionSummary {
    return {
      id: record.id,
      sessionKey: record.sessionKey,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      status: record.status,
    };
  }

  private record(key: SessionKey): StoredFreeSession {
    if (!key.startsWith('free:')) throw new Error(`FREE_LEARNING_SESSION_KEY_INVALID: ${key}`);
    const record = this.records.get(key.slice('free:'.length));
    if (!record) throw new Error(`FREE_LEARNING_SESSION_NOT_FOUND: ${key}`);
    return record;
  }

  private publish(key: SessionKey, event: AgentSessionEvent): void {
    for (const listener of this.listeners.get(key) ?? []) listener(event);
  }

  private appendText(
    record: StoredFreeSession,
    role: 'user' | 'assistant',
    text: string,
  ): MessageEntry {
    const timestamp = this.nextTimestamp();
    this.sequence += 1;
    const entry = {
      type: 'message',
      id: `${role}-${this.sequence}`,
      parentId: record.entries.at(-1)?.id ?? null,
      timestamp: new Date(timestamp).toISOString(),
      message: role === 'user'
        ? { role, content: text, timestamp }
        : assistantMessage(text, timestamp),
    } as MessageEntry;
    record.entries.push(entry);
    record.updatedAt = entry.timestamp;
    this.persist();
    this.publish(record.sessionKey, {
      type: 'message_end', message: entry.message,
    } as AgentSessionEvent);
    return entry;
  }

  private scope(record: StoredFreeSession): FreeLearningSessionScope {
    return {
      sessionKind: 'free-learning',
      title: record.title,
      createdAt: record.createdAt,
      selectedAssets: record.selectedAssets,
    };
  }

  private async runTool(
    record: StoredFreeSession,
    name: 'save_note' | 'save_problem_card' | 'free_learning_memory_commit',
    input: Record<string, unknown>,
  ): Promise<void> {
    const tools = createFreeLearningTools(this.root, this.scope(record), {
      getSessionId: () => record.id,
      getBranch: () => record.entries,
    });
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`M1B_FIXTURE_TOOL_MISSING: ${name}`);
    this.sequence += 1;
    const toolCallId = `${name}-${this.sequence}`;
    const callTimestamp = this.nextTimestamp();
    const call = {
      type: 'message',
      id: `assistant-tool-${this.sequence}`,
      parentId: record.entries.at(-1)?.id ?? null,
      timestamp: new Date(callTimestamp).toISOString(),
      message: {
        ...assistantMessage('', callTimestamp),
        content: [{ type: 'toolCall', id: toolCallId, name, arguments: input }],
        stopReason: 'toolUse',
      },
    } as MessageEntry;
    record.entries.push(call);
    this.publish(record.sessionKey, {
      type: 'tool_execution_start', toolCallId, toolName: name, args: input,
    } as AgentSessionEvent);
    const result = await tool.execute(
      toolCallId,
      input as never,
      undefined,
      undefined,
      {} as never,
    );
    this.sequence += 1;
    const resultTimestamp = this.nextTimestamp();
    const resultEntry = {
      type: 'message',
      id: `tool-result-${this.sequence}`,
      parentId: call.id,
      timestamp: new Date(resultTimestamp).toISOString(),
      message: {
        role: 'toolResult',
        toolCallId,
        toolName: name,
        content: result.content,
        details: result.details,
        isError: false,
        timestamp: resultTimestamp,
      },
    } as MessageEntry;
    record.entries.push(resultEntry);
    record.updatedAt = resultEntry.timestamp;
    this.persist();
    this.publish(record.sessionKey, {
      type: 'tool_execution_end', toolCallId, toolName: name, result, isError: false,
    } as AgentSessionEvent);
  }

  async createFreeLearning(
    selectedAssets: readonly LearningAssetReference[],
  ): Promise<FreeLearningSessionSummary> {
    this.sequence += 1;
    const id = `free-session-${String(this.records.size + 1).padStart(3, '0')}`;
    const createdAt = new Date(this.nextTimestamp()).toISOString();
    const record: StoredFreeSession = {
      id,
      sessionKey: `free:${id}`,
      title: '自由学习',
      createdAt,
      updatedAt: createdAt,
      status: 'active',
      selectedAssets: selectedAssets.map((asset) => ({ ...asset })),
      entries: [],
    };
    this.records.set(id, record);
    this.persist();
    return this.summary(record);
  }

  async listFreeLearning(): Promise<FreeLearningSessionSummary[]> {
    return [...this.records.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => this.summary(record));
  }

  async readHistory(key: SessionKey): Promise<readonly SessionEntry[]> {
    return this.record(key).entries;
  }

  async open(key: SessionKey): Promise<void> {
    this.record(key);
  }

  async abort(): Promise<void> {}
  async release(): Promise<void> {}

  async subscribe(key: SessionKey, listener: (event: AgentSessionEvent) => void) {
    this.record(key);
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener);
    this.listeners.set(key, set);
    return () => set.delete(listener);
  }

  async endFreeLearning(key: SessionKey): Promise<FreeLearningSessionSummary> {
    const record = this.record(key);
    if (record.status === 'ended') return this.summary(record);
    const endedAt = new Date(this.nextTimestamp()).toISOString();
    this.sequence += 1;
    record.entries.push({
      type: 'custom',
      id: `ended-${this.sequence}`,
      parentId: record.entries.at(-1)?.id ?? null,
      timestamp: endedAt,
      customType: FREE_LEARNING_ENDED_TYPE,
      data: { endedAt },
    });
    record.status = 'ended';
    record.updatedAt = endedAt;
    this.persist();
    return this.summary(record);
  }

  async send(key: SessionKey, text: string): Promise<void> {
    const record = this.record(key);
    if (record.status === 'ended') throw new Error(`FREE_LEARNING_SESSION_ENDED: ${key}`);
    this.appendText(record, 'user', text);

    const selectedCard = record.selectedAssets.find((asset) => asset.kind === 'problem-card');
    if (selectedCard) {
      const card = readProblemCard(this.root, selectedCard.id);
      const activity = readProblemActivity(this.root, selectedCard.id);
      const attempt = activity.latestAttempt?.response;
      const attempted = attempt?.kind === 'answer' ? attempt.text : '不会';
      const reveal = activity.answerRevealedForLatestAttempt ? '答案已经看过' : '答案还没有查看';
      const memory = existsSync(join(this.root, 'memory/objects/obj-001.md'))
        ? '教师记忆里还保留着你此前能区分离子积与 Ksp。'
        : '';
      this.appendText(
        record,
        'assistant',
        `我已经拿到“${card.title}”和这次作答。你最近一次写的是“${attempted}”，${reveal}。${memory}这次先查清楚为什么旧说法又回来了。`,
      );
      this.publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
      return;
    }

    if (/温度不变时\s*Ksp\s*不变/.test(text)) {
      await this.runTool(record, 'free_learning_memory_commit', {
        objects: [{
          target: { kind: 'new', key: 'ksp-boundary', title: '溶度积与离子积边界' },
          learningHistoryChange: '学生在被要求区分两个量后，独立说明恒温下 Ksp 不变，加入同离子改变的是离子积和浓度。',
          currentJudgment: '能区分离子积随操作变化与恒温下 Ksp 不变。',
          evolutionOverview: '从把平衡移动误说成常数改变，发展到能主动区分即时状态与平衡常数。',
          boundaries: ['尚未检验能否迁移到气相平衡常数。'],
          routing: { kind: 'defer', reason: '等待后续阶段决定对象分桶。' },
          frontierSummary: '已能区分离子积变化与恒温下 Ksp 不变，迁移边界待检验。',
        }],
      });
      this.appendText(
        record,
        'assistant',
        '这次你已经自己把边界说清了。我拟保存一份《Ksp 与离子积的边界》Note（含一个回忆块），再保存一道“恒温下加入 NaCl 后 Ksp 是否改变”的题卡；题卡标准答案是“Ksp 不变，变化的是离子积和浓度”。要按这些内容保存吗？',
      );
      this.publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
      return;
    }

    if (/保存成笔记和题卡/.test(text)) {
      await this.runTool(record, 'save_note', {
        title: 'Ksp 与离子积的边界',
        blocks: [
          {
            kind: 'markdown',
            body: '恒温下，Ksp 是平衡常数，不随加入 NaCl 而改变；变化的是离子积和各离子浓度。',
          },
          {
            kind: 'recall',
            prompt: '恒温下加入同离子后，Ksp 和离子积分别怎样变化？',
            answer: 'Ksp 不变；离子积和浓度会随操作与再平衡过程变化。',
          },
        ],
        sourceAliases: [],
      });
      await this.runTool(record, 'save_problem_card', {
        stem: '恒温下，向 AgCl(s) ⇌ Ag⁺(aq) + Cl⁻(aq) 的平衡体系加入 NaCl，Ksp 是否改变？说明理由。',
        standardAnswer: '恒温下 Ksp 不变，变化的是离子积和各离子浓度。',
        teacherRationale: '先区分平衡常数和即时状态。',
        studentNote: '',
        sourceAliases: [],
      });
      this.appendText(record, 'assistant', 'Note 和题卡都已经保存。');
      this.publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
      return;
    }

    this.appendText(
      record,
      'assistant',
      '你把“当前离子积”和“恒温下的平衡常数”混在了一起。先不用记结论：温度不变时，加入 NaCl 后 Ksp 和离子积分别会怎样？',
    );
    this.publish(key, { type: 'agent_end', messages: [], willRetry: false } as AgentSessionEvent);
  }
}

const m1bRegistry = new M1bFixtureRegistry(m1bRoot);
const m0Hub = new EventHub();
const m1bHub = new EventHub();
const clients = new Set<{ send(data: string): void }>();
for (const hub of [m0Hub, m1bHub]) {
  hub.subscribe((event) => {
    const data = JSON.stringify(event);
    for (const client of clients) client.send(data);
  });
}

const m0Handler = createRequestHandler({ root: m0Root, registry: m0Registry as never, hub: m0Hub });
const m1bHandler = createRequestHandler({ root: m1bRoot, registry: m1bRegistry as never, hub: m1bHub });
const port = Number(process.env.STUDYFORGE_E2E_API_PORT ?? 65000);
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request, bunServer) {
    const url = new URL(request.url);
    const m1b = /(?:^|;\s*)studyforge-fixture=m1b(?:;|$)/.test(
      request.headers.get('cookie') ?? '',
    );
    if (m1b && url.pathname === '/api/__e2e/m1b/reset' && request.method === 'POST') {
      m1bRegistry.reset();
      return Response.json({ ok: true });
    }
    if (m1b && url.pathname === '/api/__e2e/m1b/restart' && request.method === 'POST') {
      m1bRegistry.restart();
      return Response.json({ ok: true });
    }
    return (m1b ? m1bHandler : m0Handler)(request, bunServer);
  },
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
  rmSync(m0Root, { recursive: true, force: true });
  rmSync(m1bRoot, { recursive: true, force: true });
};
process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);

console.log(`StudyForge M1 fixtures: http://${server.hostname}:${server.port}`);

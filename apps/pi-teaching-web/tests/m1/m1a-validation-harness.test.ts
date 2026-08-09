import { afterEach, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ServerWebSocket } from 'bun';
import {
  assertDedicatedRunRoot,
  captureLearningSetSnapshot,
  prepareValidationRun,
} from '../../scripts/m1a-validation/layout';
import { sendObservedTurn } from '../../scripts/m1a-validation/turn-client';

const temporaryRoots: string[] = [];
const canonicalTmp = realpathSync('/tmp');

function temporaryDirectory(prefix: string): string {
  const path = mkdtempSync(join(canonicalTmp, prefix));
  temporaryRoots.push(path);
  return path;
}

function writeScout(path: string, thinking = 'medium'): void {
  writeFileSync(path, [
    '---',
    'name: study-material-scout',
    'description: test scout',
    'tools: read, grep',
    `thinking: ${thinking}`,
    'systemPromptMode: replace',
    '---',
    '',
    '# Scout body',
    '',
    'Do not change this body.',
    '',
  ].join('\n'));
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const target = temporaryRoots.pop()!;
    if (!target.startsWith(`${canonicalTmp}/`)) throw new Error(`unsafe cleanup target: ${target}`);
    rmSync(target, { recursive: true, force: true });
  }
});

test('prepares isolated M0 and M1a roots without exposing credentials', () => {
  const runRoot = temporaryDirectory('studyforge-m1a-validation-');
  const sourceRoot = temporaryDirectory('m1a-harness-sources-');
  const seedLearningSet = join(sourceRoot, 'learning-set');
  const agentConfigSource = join(sourceRoot, 'agent');
  const m0ScoutSource = join(sourceRoot, 'm0-scout.md');
  const m1aScoutSource = join(sourceRoot, 'm1a-scout.md');

  mkdirSync(join(seedLearningSet, 'memory'), { recursive: true });
  mkdirSync(agentConfigSource, { recursive: true });
  writeFileSync(join(seedLearningSet, 'ROADMAP.md'), '# Roadmap\n');
  writeFileSync(join(seedLearningSet, 'memory/INDEX.md'), '# Teacher Memory Index\n');
  writeFileSync(join(agentConfigSource, 'auth.json'), '{"secret":"do-not-log"}\n');
  chmodSync(join(agentConfigSource, 'auth.json'), 0o600);
  writeFileSync(join(agentConfigSource, 'models-store.json'), '{"models":[]}\n');
  writeScout(m0ScoutSource);
  writeScout(m1aScoutSource, 'low');

  expect(() => assertDedicatedRunRoot(join(canonicalTmp, 'not-owned'))).toThrow();
  expect(() => assertDedicatedRunRoot('/Users/yangrundong')).toThrow();

  const layout = prepareValidationRun({
    runRoot,
    seedLearningSet,
    agentConfigSource,
    m0ScoutSource,
    m1aScoutSource,
  });

  expect(existsSync(join(layout.m0.learningSet, 'memory'))).toBe(false);
  expect(readFileSync(join(layout.m1a.learningSet, 'memory/INDEX.md'), 'utf8'))
    .toContain('# Teacher Memory Index');
  expect(statSync(join(layout.m0.agentDir, 'auth.json')).mode & 0o777).toBe(0o600);
  expect(readFileSync(join(layout.m0.agentDir, 'settings.json'), 'utf8')).toContain('gpt-5.6-sol');

  const scout = readFileSync(
    join(layout.m1a.agentDir, 'agents/study-material-scout.md'),
    'utf8',
  );
  expect(scout).toContain('model: openai-codex/gpt-5.6-terra');
  expect(scout).toContain('thinking: high');
  expect(scout).toContain('Do not change this body.');
  expect(readFileSync(layout.manifestPath, 'utf8')).not.toContain('do-not-log');

  const first = captureLearningSetSnapshot(layout, 'm1a', 'after-lesson-001');
  expect(first.label).toBe('after-lesson-001');
  expect(first.treeHash).toMatch(/^[a-f0-9]{64}$/);
  expect(() => captureLearningSetSnapshot(layout, 'm1a', 'after-lesson-001')).toThrow();
});

test('observes the first visible event and waits for matching Session idle', async () => {
  const evidenceRoot = temporaryDirectory('m1a-turn-evidence-');
  const eventLogPath = join(evidenceRoot, 'events.jsonl');
  const clients = new Set<ServerWebSocket<unknown>>();
  const history = [{
    id: 'assistant-1',
    kind: 'assistant' as const,
    text: '先说一道最近卡住的题。',
    at: '2026-08-07T00:00:00.000Z',
  }];

  const server = Bun.serve({
    port: 0,
    fetch(request, bunServer) {
      const url = new URL(request.url);
      if (url.pathname === '/events') {
        return bunServer.upgrade(request) ? undefined : new Response('upgrade failed', { status: 426 });
      }
      if (request.method === 'POST' && url.pathname.endsWith('/messages')) {
        for (const client of clients) {
          client.send(JSON.stringify({
            type: 'session-run',
            sessionKey: 'plan:someone-else',
            status: 'idle',
          }));
        }
        setTimeout(() => {
          for (const client of clients) {
            client.send(JSON.stringify({
              type: 'assistant-delta',
              sessionKey: 'roadmap:roadmap',
              messageId: 'assistant-1',
              delta: '先说一道最近卡住的题。',
            }));
            client.send(JSON.stringify({
              type: 'session-run',
              sessionKey: 'roadmap:roadmap',
              status: 'idle',
            }));
          }
        }, 5);
        return Response.json({ accepted: true }, { status: 202 });
      }
      if (request.method === 'GET' && url.pathname.endsWith('/history')) {
        return Response.json(history);
      }
      return new Response('not found', { status: 404 });
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

  try {
    const result = await sendObservedTurn({
      baseUrl: `http://127.0.0.1:${server.port}`,
      sessionKey: 'roadmap:roadmap',
      message: '简单的还行，复杂一点我就乱了。',
      eventLogPath,
    });

    expect(result.firstVisibleAt).not.toBeNull();
    expect(result.settledAt).toBeGreaterThanOrEqual(result.startedAt);
    expect(result.history).toContainEqual(history[0]);
    const logged = readFileSync(eventLogPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { event: { type?: string; sessionKey?: string } });
    expect(logged.some((row) => row.event.type === 'assistant-delta')).toBe(true);
    expect(logged.some((row) => row.event.sessionKey === 'plan:someone-else')).toBe(true);
  } finally {
    server.stop(true);
  }
});

test('rejects non-loopback endpoints before opening a socket', async () => {
  await expect(sendObservedTurn({
    baseUrl: 'https://example.com',
    sessionKey: 'roadmap:roadmap',
    message: 'hello',
    eventLogPath: join(canonicalTmp, 'must-not-exist.jsonl'),
  })).rejects.toThrow('loopback');
});

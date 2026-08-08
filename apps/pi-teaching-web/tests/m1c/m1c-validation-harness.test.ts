import { afterEach, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ServerWebSocket } from 'bun';
import {
  captureM1cSnapshot,
  prepareM1cValidationRun,
  summarizeM1cEvidence,
} from '../../scripts/m1c-validation/layout';
import { sendRecordedTurn } from '../../scripts/m1c-validation/turn-client';

const roots: string[] = [];
const canonicalTmp = realpathSync('/tmp');

function temporaryDirectory(prefix: string): string {
  const path = mkdtempSync(join(canonicalTmp, prefix));
  roots.push(path);
  return path;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('prepares three isolated scenario roots with frozen model and commit identity', () => {
  const output = temporaryDirectory('studyforge-m1c-validation-');
  const sources = temporaryDirectory('m1c-validation-sources-');
  const blank = join(sources, 'blank');
  const course = join(sources, 'course');
  const agent = join(sources, 'agent');
  const scout = join(sources, 'study-material-scout.md');
  mkdirSync(blank);
  mkdirSync(course);
  mkdirSync(agent);
  writeFileSync(join(blank, 'LEARNING_GUIDE.md'), '# Blank\n');
  writeFileSync(join(course, 'ROADMAP.md'), '# Course\n');
  writeFileSync(join(agent, 'auth.json'), '{"secret":"never-log-this"}\n');
  chmodSync(join(agent, 'auth.json'), 0o600);
  writeFileSync(scout, [
    '---',
    'name: study-material-scout',
    'description: test scout',
    'tools: read, grep',
    'model: old/model',
    'thinking: low',
    '---',
    '',
    '# Keep this body',
    '',
  ].join('\n'));

  const layout = prepareM1cValidationRun({
    output,
    blankSeed: blank,
    courseSeed: course,
    agentConfigSource: agent,
    scoutSource: scout,
    gitCommit: '0123456789abcdef',
    gitDirty: false,
    provider: 'openai-codex',
    mainModel: 'gpt-5.6-sol',
    mainThinking: 'high',
    scoutModel: 'gpt-5.6-terra',
    scoutThinking: 'high',
    scenario: 'all',
  });

  expect(readFileSync(join(layout.scenarios.material.learningSet, 'LEARNING_GUIDE.md'), 'utf8'))
    .toContain('Blank');
  expect(readFileSync(join(layout.scenarios.blank.learningSet, 'LEARNING_GUIDE.md'), 'utf8'))
    .toContain('Blank');
  expect(readFileSync(join(layout.scenarios.course.learningSet, 'ROADMAP.md'), 'utf8'))
    .toContain('Course');
  expect(readFileSync(join(layout.scenarios.material.agentDir, 'settings.json'), 'utf8'))
    .toContain('gpt-5.6-sol');
  const pinnedScout = readFileSync(
    join(layout.scenarios.course.agentDir, 'agents/study-material-scout.md'),
    'utf8',
  );
  expect(pinnedScout).toContain('model: openai-codex/gpt-5.6-terra');
  expect(pinnedScout).toContain('thinking: high');
  expect(pinnedScout).toContain('# Keep this body');
  const manifest = readFileSync(layout.manifestPath, 'utf8');
  expect(manifest).toContain('0123456789abcdef');
  expect(manifest).not.toContain('never-log-this');

  writeFileSync(join(layout.scenarios.material.learningSet, 'student-output.md'), 'changed\n');
  const snapshot = captureM1cSnapshot(layout, 'material', 'after-note');
  expect(snapshot.treeHash).toMatch(/^[a-f0-9]{64}$/);
  expect(existsSync(join(snapshot.path, 'student-output.md'))).toBe(true);
  expect(existsSync(join(layout.scenarios.blank.learningSet, 'student-output.md'))).toBe(false);
});

test('records one observed turn and summarizes native usage and tool calls', async () => {
  const evidence = temporaryDirectory('m1c-turn-evidence-');
  const clients = new Set<ServerWebSocket<unknown>>();
  const history = [{ id: 'assistant-1', kind: 'assistant', text: '先看原文里的这个词。' }];
  const server = Bun.serve({
    port: 0,
    fetch(request, bunServer) {
      const url = new URL(request.url);
      if (url.pathname === '/events') {
        return bunServer.upgrade(request) ? undefined : new Response('upgrade failed', { status: 426 });
      }
      if (request.method === 'POST' && url.pathname.endsWith('/messages')) {
        setTimeout(() => {
          for (const client of clients) {
            client.send(JSON.stringify({
              type: 'assistant-delta',
              sessionKey: 'free:session-001',
              messageId: 'assistant-1',
              delta: '先看原文里的这个词。',
            }));
            client.send(JSON.stringify({
              type: 'session-run', sessionKey: 'free:session-001', status: 'idle',
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
      open(socket) { clients.add(socket); },
      close(socket) { clients.delete(socket); },
      message() {},
    },
  });

  try {
    const turnPath = join(evidence, 'turn-001.json');
    const result = await sendRecordedTurn({
      baseUrl: `http://127.0.0.1:${server.port}`,
      sessionKey: 'free:session-001',
      message: '为什么这个固体不写进去？',
      eventLogPath: join(evidence, 'events.jsonl'),
      turnPath,
    });
    expect(result.firstVisibleAt).not.toBeNull();
    expect(readFileSync(turnPath, 'utf8')).toContain('为什么这个固体不写进去');

    const agentDir = join(evidence, 'agent');
    const learningSet = join(evidence, 'learning-set');
    mkdirSync(agentDir);
    mkdirSync(learningSet);
    writeFileSync(join(agentDir, 'session.jsonl'), [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          usage: { input: 10, output: 5, cacheRead: 3, totalTokens: 18 },
          content: [{ type: 'toolCall', name: 'save_note', id: 'tool-1', arguments: {} }],
        },
      }),
      '',
    ].join('\n'));
    writeFileSync(join(learningSet, 'LEARNING_GUIDE.md'), '# Guide\n');
    const summary = summarizeM1cEvidence(agentDir, learningSet);
    expect(summary.usage.totalTokens).toBe(18);
    expect(summary.toolCalls).toEqual([{ name: 'save_note', count: 1 }]);
    expect(summary.canonicalFiles).toEqual(['LEARNING_GUIDE.md']);
  } finally {
    server.stop(true);
  }
});

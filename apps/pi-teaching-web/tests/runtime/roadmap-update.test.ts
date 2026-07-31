import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Check } from 'typebox/value';
import { NodeAccessPolicy } from '../../src/runtime/node-access';
import { compileNodeContext } from '../../src/runtime/node-context';
import { createRoadmapUpdateTool } from '../../src/runtime/roadmap-update';
import { ROADMAP_COACH_SCOPE } from '../../src/runtime/session-scope';
import { readLearningSet } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'roadmap-update-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

test('tells first-cycle callers to omit the cross-cycle checkpoint', () => {
  const tool = createRoadmapUpdateTool(fixture());
  const checkpoint = (tool.parameters as {
    properties: { checkpoint: { description?: string } };
  }).properties.checkpoint;

  expect(tool.description).toContain('omit checkpoint entirely');
  expect(checkpoint.description).toContain('completed Plan');
  expect(checkpoint.description).toContain('omit checkpoint entirely');
});

test('updates Roadmap milestones and candidate tree in one tool call', async () => {
  const root = fixture();
  const tool = createRoadmapUpdateTool(root);
  const response = await tool.execute('call-1', {
    goal: '建立可迁移的导数结构判断。',
    capabilityStandard: '能在陌生综合题中解释选路依据。',
    test: '独立完成一题跨章节迁移任务。',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '训练跨章节选路。',
        after: 'plan-candidate-001',
        dependsOn: ['plan-candidate-001'],
        considerWhen: '定义域 Plan 完成后。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '先比较路线，不直接训练整题速度。',
      },
    }],
  } as never, undefined, undefined, {} as never);
  const value = JSON.parse(
    (response.content[0] as { text: string }).text,
  ) as { ok: boolean; candidateHandles: string[] };
  expect(value).toEqual({
    ok: true,
    candidateHandles: ['plan-candidate-001', 'plan-candidate-002'],
  });
  expect(readLearningSet(root).planTree.at(-1)).toMatchObject({
    handle: 'plan-candidate-002',
    status: 'candidate',
    publicPurpose: '训练跨章节选路。',
  });
  const source = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
  expect(source).toContain('建立可迁移的导数结构判断。');
  expect(source).not.toContain('## Plan Graph');
});

test('adds the current Roadmap Session to candidates without model input', async () => {
  const root = fixture();
  const accessPolicy = new NodeAccessPolicy(
    root,
    compileNodeContext(root, ROADMAP_COACH_SCOPE, {
      sessionId: 'session-current-roadmap',
    }),
    { sessionId: 'session-current-roadmap' },
  );
  const tool = createRoadmapUpdateTool(root, { accessPolicy });
  const candidate = {
    publicPurpose: '训练跨章节选路。',
    after: 'plan-candidate-001',
    dependsOn: ['plan-candidate-001'],
    considerWhen: '定义域 Plan 完成后。',
    sources: ['trace:trace-fixture-002'],
    privateNote: '先比较路线。',
  };

  expect(Check(tool.parameters, {
    candidateChanges: [{
      action: 'add',
      candidate: {
        ...candidate,
        sources: ['session:model-supplied'],
      },
    }],
  })).toBeFalse();

  await tool.execute('runtime-session', {
    candidateChanges: [{ action: 'add', candidate }],
  } as never, undefined, undefined, {} as never);

  expect(readFileSync(join(root, 'ROADMAP.md'), 'utf8'))
    .toContain('session:session-current-roadmap');
});

test('rejects a Plan candidate source outside the Roadmap boundary', async () => {
  const root = fixture();
  const path = join(root, 'ROADMAP.md');
  const before = readFileSync(path, 'utf8');
  const tool = createRoadmapUpdateTool(root, {
    accessPolicy: {
      allows: (source) => source.startsWith('claim:'),
    },
  });

  await expect(tool.execute('invalid-source', {
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '不应创建。',
        after: 'plan-candidate-001',
        dependsOn: ['plan-candidate-001'],
        considerWhen: '下个周期。',
        sources: ['session:child-plan-session'],
        privateNote: '错误地绕过了封存 Handoff。',
      },
    }],
  } as never, undefined, undefined, {} as never))
    .rejects.toThrow(
      'NODE_CANDIDATE_SESSION_SOURCE_RUNTIME_OWNED: session:child-plan-session',
    );
  expect(readFileSync(path, 'utf8')).toBe(before);
});

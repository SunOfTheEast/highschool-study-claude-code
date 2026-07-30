import { afterEach, expect, test } from 'bun:test';
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
import { createPlanPrepareTool } from '../../src/runtime/plan-prepare';
import { createRoadmapUpdateTool } from '../../src/runtime/roadmap-update';
import { readLearningSet } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'plan-prepare-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

async function addCandidate(root: string): Promise<void> {
  const update = createRoadmapUpdateTool(root);
  await update.execute('call-add', {
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '训练路线比较。',
        after: 'plan-candidate-001',
        dependsOn: ['plan-candidate-001'],
        considerWhen: '当前 Plan 完成后。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '不把候选方法写进公开目的。',
      },
    }],
  } as never, undefined, undefined, {} as never);
}

test('materializes a Roadmap-owned Plan candidate with runtime identity', async () => {
  const root = fixture();
  await addCandidate(root);
  const tool = createPlanPrepareTool(root);
  const response = await tool.execute('call-prepare', {
    candidateHandle: 'plan-candidate-002',
    blueprint: {
      title: '路线比较',
      publicPurpose: '训练路线比较。',
      goal: '形成稳定的选路意识。',
      capabilityStandard: '三分钟内比较两条路线的代价。',
      test: '在陌生外壳中完成一次独立选路。',
      planningBasis: '当前方法数量足够，主要困难是比较。',
      activation: {
        parentSources: ['trace:trace-fixture-002'],
        selectedMemory: [],
        contentBoundary: ['不在课前公开候选方法名。'],
        adaptation: {
          workingJudgment: '主要瓶颈是路线成本比较。',
          sources: ['trace:trace-fixture-002'],
          designConsequence: '先保持题型，只改变路线成本差。',
          reviseIf: '学生已经能稳定快速选择。',
        },
      },
    },
  } as never, undefined, undefined, {} as never);
  const value = JSON.parse(
    (response.content[0] as { text: string }).text,
  );
  expect(value).toEqual({
    ok: true,
    ownerPath: 'ROADMAP.md',
    factId: 'plan-001',
    candidateHandle: 'plan-candidate-002',
    childPath: 'plans/plan-001.md',
    status: 'prepared',
  });
  expect(readLearningSet(root).planTree.at(-1)).toMatchObject({
    nodeId: 'plan-001',
    path: 'plans/plan-001.md',
    status: 'prepared',
  });
});

test('rejects Plan materialization while Roadmap milestones are placeholders', async () => {
  const root = fixture();
  await addCandidate(root);
  const roadmapPath = join(root, 'ROADMAP.md');
  writeFileSync(
    roadmapPath,
    readFileSync(roadmapPath, 'utf8').replace(
      /## Goal\n\n[\s\S]*?(?=\n## Observable Capability Standard)/,
      '## Goal\n\n（尚未确定）\n',
    ),
  );
  const tool = createPlanPrepareTool(root);
  await expect(tool.execute('call-invalid', {
    candidateHandle: 'plan-candidate-002',
    blueprint: {
      title: '不会物化',
      publicPurpose: '占位 Roadmap 不应创建 Plan。',
      goal: '测试。',
      capabilityStandard: '测试。',
      test: '测试。',
      planningBasis: '测试。',
      activation: {
        parentSources: ['trace:trace-fixture-002'],
        selectedMemory: [],
        contentBoundary: ['不公开私有内容。'],
        adaptation: {
          workingJudgment: '尚未成立。',
          sources: ['trace:trace-fixture-002'],
          designConsequence: '不物化。',
          reviseIf: 'Roadmap 完整。',
        },
      },
    },
  } as never, undefined, undefined, {} as never))
    .rejects.toThrow('ROADMAP_MILESTONES_REQUIRED');
  expect(existsSync(join(root, 'plans/plan-001.md'))).toBe(false);
  expect(readLearningSet(root).planTree.at(-1)?.status).toBe('candidate');
});

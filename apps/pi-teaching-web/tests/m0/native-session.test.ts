import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEventBus,
  type AgentSessionEvent,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  createRoleResourceLoader,
  loadStaticNodeResources,
} from '../../src/runtime/resource-loader';
import {
  sessionFactoryInput,
  type StudySession,
  type StudySessionFactory,
} from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-session-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fakeSession(id: string, file = `/sessions/${id}.jsonl`): StudySession {
  const listeners = new Set<(event: AgentSessionEvent) => void>();
  return {
    sessionId: id,
    sessionFile: file,
    messages: [],
    entries: [] as SessionEntry[],
    isStreaming: false,
    prompt: async () => {},
    abort: async () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => listeners.clear(),
  };
}

test('assembles static teaching resources and node-scoped model tools', () => {
  const root = copyFixture();
  const resources = loadStaticNodeResources(root, {
    nodeKind: 'plan',
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  const assembled = resources.agentsFiles.map((file) => file.content).join('\n');

  expect(resources.tools).toEqual([
    'read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent',
  ]);
  expect(resources.agentsFiles).toContainEqual(expect.objectContaining({
    path: join(root, 'LEARNING_GUIDE.md'),
  }));
  expect(assembled).toContain('导数结构学习集');
  expect(assembled).toContain('Current node file: plans/plan-001.md');
  expect(assembled).toContain('plan-node.md');
  expect(assembled).not.toContain('第一节课正在进行');
  expect(assembled).not.toContain('10:03 学生');
  expect(assembled).not.toContain('cards/sample.card.yaml');
});

test('loads one selected persona after the role for every student-facing node', () => {
  const root = copyFixture();
  const scopes = [
    {
      nodeKind: 'roadmap',
      nodeId: 'roadmap',
      nodePath: 'ROADMAP.md',
      parentId: null,
      parentPath: null,
    },
    {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001.md',
    },
  ] as const;

  for (const scope of scopes) {
    const resources = loadStaticNodeResources(root, scope, 'gojo');
    const paths = resources.agentsFiles.map((resource) => resource.path);
    const personaPath = '/virtual/studyforge-m0-persona-gojo.md';
    const roleIndex = paths.findIndex((path) => (
      path.includes(`${scope.nodeKind}-node.md`)
    ));
    const personaIndex = paths.indexOf(personaPath);
    const ownerIndex = paths.indexOf('/virtual/studyforge-m0-current-node.md');

    expect(resources.agentsFiles.filter(
      (resource) => resource.path === personaPath,
    )).toHaveLength(1);
    expect(personaIndex).toBeGreaterThan(roleIndex);
    expect(ownerIndex).toBeGreaterThan(personaIndex);
  }
});

test('keeps neutral assembly without a persona and rejects unknown persona ids', () => {
  const root = copyFixture();
  const scope = {
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  } as const;

  expect(loadStaticNodeResources(root, scope).agentsFiles.some(
    (resource) => resource.path.includes('persona-'),
  )).toBe(false);
  expect(() => loadStaticNodeResources(root, scope, '../gojo'))
    .toThrow('STUDY_PERSONA_INVALID: ../gojo');
  expect(() => loadStaticNodeResources(root, scope, 'missing'))
    .toThrow('STUDY_PERSONA_NOT_FOUND: missing');
});

test('injects one canonical document contract into every node session', () => {
  const root = copyFixture();
  const scopes = [
    {
      nodeKind: 'roadmap',
      nodeId: 'roadmap',
      nodePath: 'ROADMAP.md',
      parentId: null,
      parentPath: null,
    },
    {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001.md',
    },
  ] as const;

  for (const scope of scopes) {
    const resources = loadStaticNodeResources(root, scope);
    const contracts = resources.agentsFiles.filter(
      (resource) => resource.path === '/virtual/studyforge-m0-document-contract.md',
    );

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.content).toContain('## Stage Goal');
    expect(contracts[0]?.content).toContain('## Lesson Tree');
    expect(contracts[0]?.content).toContain('## Block block-001：活动名称');
    expect(contracts[0]?.content).toContain('session_id: null');
    expect(contracts[0]?.content).toContain('- [plan-001 | 阶段标题](plans/plan-001.md)');
    expect(contracts[0]?.content).toContain('write 完整子文件');
    expect(resources.tools).toEqual(scope.nodeKind === 'plan'
      ? ['read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent']
      : ['read', 'grep', 'find', 'ls', 'edit', 'write']);
  }
});

test('loads the explicit subagent extension only for Plan nodes', async () => {
  const root = copyFixture();
  const planLoader = await createRoleResourceLoader(root, {
    nodeKind: 'plan',
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  }, createEventBus());
  const lessonLoader = await createRoleResourceLoader(root, {
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001.md',
  }, createEventBus());
  const extensionToolNames = (loader: typeof planLoader) => (
    loader.getExtensions().extensions.flatMap((extension) => (
      Array.from(extension.tools.keys())
    ))
  );

  expect(extensionToolNames(planLoader)).toContain('subagent');
  expect(extensionToolNames(lessonLoader)).not.toContain('subagent');
});

test('packages a read-only material Scout', () => {
  const scout = readFileSync(
    join(import.meta.dir, '../../resources/subagents/study-material-scout.md'),
    'utf8',
  );
  const toolsLine = scout.match(/^tools:.*$/m)?.[0] ?? '';

  expect(scout).toContain('name: study-material-scout');
  expect(toolsLine).toBe('tools: read, grep, find, ls');
  for (const forbidden of ['write', 'edit', 'bash', 'subagent']) {
    expect(toolsLine).not.toContain(forbidden);
  }
});

test('packages the complete Coach lesson-template reference set', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/coach-study/references/lesson-templates',
  );
  const expected = [
    'INDEX.md',
    'assessment.md',
    'concept-construction.md',
    'deliberate-practice.md',
    'diagnostic.md',
    'remediation.md',
    'review-spaced-retrieval.md',
    'review-stage-consolidation.md',
  ];

  expect(readdirSync(directory).sort()).toEqual(expected);
  for (const name of expected) {
    expect(readFileSync(join(directory, name), 'utf8').trim().length).toBeGreaterThan(0);
  }
});

test('packages the complete shared Plan-cycle reference set', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/plan-next-cycle/references/plan-cycles',
  );
  const expected = [
    'INDEX.md',
    'capability-construction.md',
    'diagnostic.md',
    'remediation.md',
    'strategy-strengthening.md',
    'systematic-review.md',
  ];

  expect(readdirSync(directory).sort()).toEqual(expected);
  for (const name of expected) {
    expect(readFileSync(join(directory, name), 'utf8').trim().length).toBeGreaterThan(0);
  }
});

test('loads only the M0 skills selected for the current node', async () => {
  const root = copyFixture();
  const staleSkill = join(root, '.pi/skills/roadmap-study');
  mkdirSync(staleSkill, { recursive: true });
  writeFileSync(join(staleSkill, 'SKILL.md'), [
    '---',
    'name: roadmap-study',
    'description: stale project skill',
    '---',
    '',
    '# Stale Roadmap Skill',
  ].join('\n'));
  const scope = {
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  } as const;
  const expected = loadStaticNodeResources(root, scope).skillPaths;

  const loader = await createRoleResourceLoader(root, scope, createEventBus());

  expect(loader.getSkills().skills.map((skill) => skill.filePath).sort())
    .toEqual([...expected].sort());
});

test('keeps factory input node-scoped without cross-session transcripts', () => {
  const input = sessionFactoryInput({
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001.md',
  }, null);

  expect(input).toEqual({
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001.md',
    sessionFile: null,
  });
  expect('messages' in input).toBe(false);
  expect('context' in input).toBe(false);
});

test('reuses one session per node and never shares sessions across nodes', async () => {
  const root = copyFixture();
  const inputs: Parameters<StudySessionFactory>[0][] = [];
  const factory: StudySessionFactory = async (input) => {
    inputs.push(input);
    return fakeSession(`session-${input.nodeKind}-${input.nodeId}`);
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  const firstPlan = await registry.open('plan:plan-001');
  const samePlan = await registry.open('plan:plan-001');
  const lesson = await registry.open('lesson:lesson-001');

  expect(samePlan).toBe(firstPlan);
  expect(lesson).not.toBe(firstPlan);
  expect(inputs.map((input) => input.nodePath)).toEqual([
    'plans/plan-001.md',
    'lessons/lesson-001.md',
  ]);
  expect(readFileSync(join(root, 'plans/plan-001.md'), 'utf8'))
    .toContain('session_id: session-plan-plan-001');
  expect(readFileSync(join(root, 'lessons/lesson-001.md'), 'utf8'))
    .toContain('session_id: session-lesson-lesson-001');
});

test('restores the persisted owner session without copying another branch', async () => {
  const root = copyFixture();
  const first = new WorkspaceRegistry(
    root,
    async (input) => fakeSession(`saved-${input.nodeId}`, `/sessions/saved-${input.nodeId}.jsonl`),
    async () => null,
  );
  await first.open('plan:plan-001');
  first.dispose();

  const restoredInputs: Parameters<StudySessionFactory>[0][] = [];
  const second = new WorkspaceRegistry(
    root,
    async (input) => {
      restoredInputs.push(input);
      return fakeSession('saved-plan-001', input.sessionFile ?? undefined);
    },
    async (_root, sessionId, scope) => (
      sessionId === 'saved-plan-001' && scope.nodeId === 'plan-001'
        ? '/sessions/saved-plan-001.jsonl'
        : null
    ),
  );
  await second.open('plan:plan-001');

  expect(restoredInputs).toHaveLength(1);
  expect(restoredInputs[0]?.sessionFile).toBe('/sessions/saved-plan-001.jsonl');
  expect(restoredInputs[0]).not.toHaveProperty('entries');
  expect(restoredInputs[0]).not.toHaveProperty('messages');
});

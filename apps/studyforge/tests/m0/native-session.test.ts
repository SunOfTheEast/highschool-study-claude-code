import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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
  customToolsForNode,
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
    nodePath: 'plans/plan-001/PLAN.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  const assembled = resources.agentsFiles.map((file) => file.content).join('\n');

  expect(resources.tools).toEqual([
    'read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent', 'artifact_export',
  ]);
  expect(resources.agentsFiles).toContainEqual(expect.objectContaining({
    path: join(root, 'LEARNING_GUIDE.md'),
  }));
  expect(assembled).toContain('导数结构学习集');
  expect(assembled).toContain('Current node file: plans/plan-001/PLAN.md');
  expect(assembled).toContain('plan-node.md');
  expect(assembled).not.toContain('第一节课正在进行');
  expect(assembled).not.toContain('10:03 学生');
  expect(assembled).not.toContain('cards/sample.card.yaml');

  expect(loadStaticNodeResources(root, {
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  }).tools).toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
  expect(loadStaticNodeResources(root, {
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  }).tools).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'classroom_log_append',
    'classroom_update',
  ]);
});

test('assembles the node-specific teaching Skill tree', () => {
  const root = copyFixture();
  const scopes = {
    roadmap: {
      nodeKind: 'roadmap',
      nodeId: 'roadmap',
      nodePath: 'ROADMAP.md',
      parentId: null,
      parentPath: null,
    },
    plan: {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    lesson: {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'plans/plan-001/lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001/PLAN.md',
    },
  } as const;
  const skillNames = (scope: typeof scopes[keyof typeof scopes]) => (
    loadStaticNodeResources(root, scope).skillPaths.map((path) => basename(dirname(path)))
  );

  expect(skillNames(scopes.roadmap)).toEqual([
    'roadmap-dialogue',
    'prepare-approved-plan',
  ]);
  expect(skillNames(scopes.plan)).toEqual([
    'plan-dialogue',
    'prepare-approved-lesson',
  ]);
  expect(skillNames(scopes.lesson)).toEqual(['tutor-lesson']);
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
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'plans/plan-001/lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001/PLAN.md',
    },
  ] as const;

  for (const scope of scopes) {
    const resources = loadStaticNodeResources(root, scope, 'confident-mentor');
    const paths = resources.agentsFiles.map((resource) => resource.path);
    const personaPath = '/virtual/studyforge-m0-persona-confident-mentor.md';
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
  expect(() => loadStaticNodeResources(root, scope, '../confident-mentor'))
    .toThrow('STUDY_PERSONA_INVALID: ../confident-mentor');
  expect(() => loadStaticNodeResources(root, scope, 'missing'))
    .toThrow('STUDY_PERSONA_NOT_FOUND: missing');
});

test('ships an original persona without borrowed character vocabulary', () => {
  const content = readFileSync(
    join(import.meta.dir, '../../resources/personas/confident-mentor.md'),
    'utf8',
  );
  for (const borrowed of ['五条悟', '无量空处', '六眼', '反转术式', '术式']) {
    expect(content).not.toContain(borrowed);
  }
  expect(content).toContain('轻松、自信、有判断力');
  expect(content).toContain('只改变表达，不改变教学职责');
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
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'plans/plan-001/lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001/PLAN.md',
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
    expect(contracts[0]?.content).toContain('- [plan-001 | 阶段标题](plans/plan-001/PLAN.md)');
    expect(contracts[0]?.content).toContain('write 完整子文件');
    expect(resources.tools).toEqual(scope.nodeKind === 'plan'
      ? ['read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent', 'artifact_export']
      : scope.nodeKind === 'lesson'
        ? ['read', 'grep', 'find', 'ls', 'classroom_log_append', 'classroom_update']
        : ['read', 'grep', 'find', 'ls', 'edit', 'write']);
  }
});

test('registers only node-bound custom tools for Plan and Lesson scopes', () => {
  const root = copyFixture();
  const lessonScope = {
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  } as const;
  const roadmapScope = {
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  } as const;
  const planScope = {
    nodeKind: 'plan',
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001/PLAN.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  } as const;

  expect(customToolsForNode(root, lessonScope).map((tool) => tool.name)).toEqual([
    'classroom_log_append',
    'classroom_update',
  ]);
  expect(customToolsForNode(root, planScope).map((tool) => tool.name)).toEqual([
    'artifact_export',
  ]);
  expect(customToolsForNode(root, roadmapScope)).toEqual([]);
});

test('keeps the Lesson write boundary tool-driven and minimal in resources', () => {
  const root = copyFixture();
  const resources = loadStaticNodeResources(root, {
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  });
  const agent = resources.agentsFiles
    .find((resource) => resource.path.endsWith('lesson-node.md'))?.content ?? '';
  const skill = readFileSync(resources.skillPaths[0]!, 'utf8');
  const combined = `${agent}\n${skill}`;

  expect(agent).toContain('classroom_log_append');
  expect(agent).toContain('classroom_update');
  expect(skill).toContain('影响后续判断的事实');
  expect(skill).toContain('其余教学轮次');
  expect(combined).not.toContain('窄 edit');
  expect(combined).not.toContain('状态 edit');
  expect(combined).toContain('prepared → active → closed');
  for (const schemaDetail of ['insert', 'revise', 'move', 'skip_pending']) {
    expect(agent).not.toContain(schemaDetail);
  }
});

test('loads the explicit subagent extension only for Plan nodes', async () => {
  const root = copyFixture();
  const planLoader = await createRoleResourceLoader(root, {
    nodeKind: 'plan',
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001/PLAN.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  }, createEventBus());
  const lessonLoader = await createRoleResourceLoader(root, {
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  }, createEventBus());
  const extensionToolNames = (loader: typeof planLoader) => (
    loader.getExtensions().extensions.flatMap((extension) => (
      Array.from(extension.tools.keys())
    ))
  );

  expect(extensionToolNames(planLoader)).toContain('subagent');
  expect(extensionToolNames(lessonLoader)).not.toContain('subagent');
  expect(planLoader.getExtensions().extensions.filter(
    (extension) => extension.handlers.has('tool_call'),
  )).toHaveLength(1);
  expect(lessonLoader.getExtensions().extensions.filter(
    (extension) => extension.handlers.has('tool_call'),
  )).toHaveLength(0);
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

test('packages only the two StudyForge product subagents', () => {
  const directory = join(import.meta.dir, '../../resources/subagents');
  expect(readdirSync(directory).filter((name) => name.endsWith('.md')).sort()).toEqual([
    'lesson-risk-reviewer.md',
    'study-material-scout.md',
  ]);
});

test('packages one bounded Lesson risk Reviewer and routes it only for material risk', () => {
  const reviewerPath = join(
    import.meta.dir,
    '../../resources/subagents/lesson-risk-reviewer.md',
  );
  expect(existsSync(reviewerPath)).toBe(true);
  if (!existsSync(reviewerPath)) return;

  const reviewer = readFileSync(reviewerPath, 'utf8');
  const toolsLine = reviewer.match(/^tools:.*$/m)?.[0] ?? '';
  expect(reviewer).toContain('name: lesson-risk-reviewer');
  expect(reviewer).toContain('model: openai-codex/gpt-5.6-sol');
  expect(reviewer).toContain('thinking: high');
  expect(reviewer).toContain('defaultContext: fresh');
  expect(reviewer).toContain('systemPromptMode: replace');
  expect(reviewer).toContain('inheritProjectContext: false');
  expect(reviewer).toContain('inheritSkills: false');
  expect(toolsLine).toBe('tools: read');
  expect(reviewer).toMatch(/acceptance:\n\s+level: none\n\s+reason: .+/);

  const prepareRoot = join(
    import.meta.dir,
    '../../resources/skills/prepare-approved-lesson',
  );
  const skill = readFileSync(join(prepareRoot, 'SKILL.md'), 'utf8');
  const risk = readFileSync(
    join(prepareRoot, 'references/risk-review.md'),
    'utf8',
  );
  const material = readFileSync(
    join(prepareRoot, 'references/material-preparation.md'),
    'utf8',
  );
  expect(skill).toContain('references/risk-review.md');
  expect(skill).toContain('lesson-risk-reviewer');
  expect(risk).toMatch(/"acceptance":\s*\{\s*"level":\s*"none",\s*"reason":\s*"[^"]+"\s*\}/);
  expect(risk).not.toContain('"acceptance": "checked"');
  expect(material).toContain('study-material-scout');
  expect(material).not.toContain('subagent(action: "list")');
});

test('offers a printable handout only after the prepared Lesson delivery boundary', () => {
  const prepareRoot = join(
    import.meta.dir,
    '../../resources/skills/prepare-approved-lesson',
  );
  const referencePath = join(prepareRoot, 'references/printable-handout.md');
  expect(existsSync(referencePath)).toBe(true);
  if (!existsSync(referencePath)) return;

  const skill = readFileSync(join(prepareRoot, 'SKILL.md'), 'utf8');
  const reference = readFileSync(referencePath, 'utf8');
  expect(skill.indexOf('references/printable-handout.md'))
    .toBeGreaterThan(skill.indexOf('10.'));
  expect(reference).toContain('Lesson 已经可以开始');
  expect(reference).toContain('明确同意');
  expect(reference).toContain('artifact_export');
  expect(reference).toContain('不调用');
  expect(reference).toContain('不回滚 Lesson');
  expect(reference).toContain('Student View');
  expect(reference).toContain('Teacher Control');
});

test('packages the complete approved-Lesson template reference set', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/prepare-approved-lesson/references/lesson-templates',
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
    '../../resources/skills/references/plan-cycles',
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

test('packages only the accepted Lesson technique references', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/tutor-lesson/references/teaching-techniques',
  );
  const expected = [
    'INDEX.md',
    'concept-boundary-repair.md',
    'frustration-and-pause.md',
    'independent-transfer-check.md',
    'method-comparison.md',
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
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  }, null);

  expect(input).toEqual({
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
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
  const lesson = await registry.open('lesson:plan-001:lesson-001');

  expect(samePlan).toBe(firstPlan);
  expect(lesson).not.toBe(firstPlan);
  expect(inputs.map((input) => input.nodePath)).toEqual([
    'plans/plan-001/PLAN.md',
    'plans/plan-001/lessons/lesson-001.md',
  ]);
  expect(readFileSync(join(root, 'plans/plan-001/PLAN.md'), 'utf8'))
    .toContain('session_id: session-plan-plan-001');
  expect(readFileSync(join(root, 'plans/plan-001/lessons/lesson-001.md'), 'utf8'))
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

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
  SessionManager,
  type AgentSessionEvent,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  createRoleResourceLoader,
  loadStaticNodeResources,
} from '../../src/runtime/resource-loader';
import {
  customToolsForNode,
  createStudySessionManager,
  recoverOpenedSessionState,
  recoverSessionFactoryState,
  sessionFactoryInput,
  type StudySession,
  type StudySessionFactory,
} from '../../src/runtime/session-factory';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  appendSessionOwner,
  findFreeLearningPiSession,
  listPiSessionFacts,
} from '../../src/runtime/session-owner';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import { transitionNode } from '../../src/runtime/node-lifecycle';

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
    'save_prepared_problem_card',
    'memory_route_resolve',
    'finish_plan',
  ]);
  expect(resources.agentsFiles).toContainEqual(expect.objectContaining({
    path: join(root, 'LEARNING_GUIDE.md'),
  }));
  expect(assembled).toContain('导数结构学习集');
  expect(assembled).toContain('Current node file: plans/plan-001/PLAN.md');
  expect(assembled).toContain('plan-node.md');
  expect(assembled).toContain('# Teacher Memory Index');
  expect(assembled).toContain('五个语义边界');
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
    'save_note',
    'save_problem_card',
    'lesson_memory_commit',
    'finish_lesson',
  ]);
});

test('persists desktop sessions only in the explicit StudyForge session directory', () => {
  const root = copyFixture();
  const sessionsDir = join(root, 'private-agent', 'sessions');
  const manager = createStudySessionManager(root, null, sessionsDir);

  expect(manager.getSessionDir()).toBe(sessionsDir);
  expect(manager.getSessionFile()?.startsWith(sessionsDir)).toBe(true);
});

test('restores a desktop session from the configured StudyForge session directory', async () => {
  const root = copyFixture();
  const sessionsDir = join(root, 'private-agent', 'sessions');
  const previousSessionsDir = process.env.PI_CODING_AGENT_SESSION_DIR;
  process.env.PI_CODING_AGENT_SESSION_DIR = sessionsDir;

  try {
    const manager = createStudySessionManager(root, null, sessionsDir);
    manager.appendSessionInfo('自由学习');
    appendSessionOwner(manager, {
      sessionKind: 'free-learning',
      title: '自由学习',
      createdAt: '2026-08-10T00:00:00.000Z',
      selectedAssets: [],
    });
    manager.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '已建立会话。' }],
      api: 'openai-responses',
      provider: 'openai',
      model: 'test-model',
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
    });

    const restored = await findFreeLearningPiSession(root, manager.getSessionId());

    expect(restored?.sessionFile).toBe(manager.getSessionFile());
  } finally {
    if (previousSessionsDir === undefined) {
      delete process.env.PI_CODING_AGENT_SESSION_DIR;
    } else {
      process.env.PI_CODING_AGENT_SESSION_DIR = previousSessionsDir;
    }
  }
});

test('counts student turns rather than teacher replies as learning-session entry times', async () => {
  const root = copyFixture();
  const sessionsDir = join(root, 'private-agent', 'sessions');
  const previousSessionsDir = process.env.PI_CODING_AGENT_SESSION_DIR;
  process.env.PI_CODING_AGENT_SESSION_DIR = sessionsDir;

  try {
    const manager = createStudySessionManager(root, null, sessionsDir);
    appendSessionOwner(manager, {
      sessionKind: 'free-learning',
      title: '自由学习',
      createdAt: '2026-08-10T00:00:00.000Z',
      selectedAssets: [],
    });
    manager.appendMessage({
      role: 'user',
      content: '你好',
      timestamp: Date.parse('2026-08-10T00:01:00.000Z'),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    manager.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '你好！今天想聊点什么？' }],
      api: 'openai-responses',
      provider: 'openai',
      model: 'test-model',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: Date.parse('2026-08-10T00:01:01.000Z'),
    });

    const fact = (await listPiSessionFacts(root)).find((item) => item.id === manager.getSessionId());
    const userEntry = manager.getBranch().find((entry) => (
      entry.type === 'message' && entry.message.role === 'user'
    ));

    expect(userEntry).toBeDefined();
    expect(fact?.entryTimes).toEqual([userEntry!.timestamp]);
  } finally {
    if (previousSessionsDir === undefined) {
      delete process.env.PI_CODING_AGENT_SESSION_DIR;
    } else {
      process.env.PI_CODING_AGENT_SESSION_DIR = previousSessionsDir;
    }
  }
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

test('loads one default teacher presence after the role and before persona', () => {
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
  const presencePath = '/virtual/studyforge-teacher-presence.md';

  for (const scope of scopes) {
    const neutral = loadStaticNodeResources(root, scope);
    const neutralPaths = neutral.agentsFiles.map((resource) => resource.path);
    const roleIndex = neutralPaths.findIndex((path) => path.includes(`${scope.nodeKind}-node.md`));
    const presenceIndex = neutralPaths.indexOf(presencePath);
    const ownerIndex = neutralPaths.indexOf('/virtual/studyforge-m0-current-node.md');

    expect(neutralPaths.filter((path) => path === presencePath)).toHaveLength(1);
    expect(presenceIndex).toBeGreaterThan(roleIndex);
    expect(ownerIndex).toBeGreaterThan(presenceIndex);

    const personalizedPaths = loadStaticNodeResources(root, scope, 'gojo')
      .agentsFiles.map((resource) => resource.path);
    expect(personalizedPaths.indexOf('/virtual/studyforge-m0-persona-gojo.md'))
      .toBeGreaterThan(personalizedPaths.indexOf(presencePath));
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
    expect(resources.agentsFiles.filter(
      (resource) => resource.path === '/virtual/studyforge-m1-memory-contract.md',
    )).toHaveLength(1);
    expect(resources.agentsFiles.filter(
      (resource) => resource.path === join(root, 'memory/INDEX.md'),
    )).toHaveLength(1);
    expect(contracts[0]?.content).toContain('## Stage Goal');
    expect(contracts[0]?.content).toContain('## Lesson Tree');
    expect(contracts[0]?.content).toContain('## Block block-001：活动名称');
    expect(contracts[0]?.content).toContain('session_id: null');
    expect(contracts[0]?.content).toContain('- [plan-001 | 阶段标题](plans/plan-001/PLAN.md)');
    expect(contracts[0]?.content).toContain('write 完整子文件');
    expect(resources.tools).toEqual(scope.nodeKind === 'plan'
      ? [
        'read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent', 'artifact_export',
        'save_prepared_problem_card',
        'memory_route_resolve',
        'finish_plan',
      ]
      : scope.nodeKind === 'lesson'
        ? [
          'read', 'grep', 'find', 'ls',
          'classroom_log_append', 'classroom_update', 'save_note', 'save_problem_card',
          'lesson_memory_commit',
          'finish_lesson',
        ]
        : ['read', 'grep', 'find', 'ls', 'edit', 'write']);
  }
});

test('does not invent a memory index for an older learning set', () => {
  const root = copyFixture();
  rmSync(join(root, 'memory/INDEX.md'));
  const resources = loadStaticNodeResources(root, {
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  });

  expect(resources.agentsFiles.some(
    (resource) => resource.path === join(root, 'memory/INDEX.md'),
  )).toBe(false);
  expect(resources.agentsFiles.some(
    (resource) => resource.path === '/virtual/studyforge-m1-memory-contract.md',
  )).toBe(false);
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

  const manager = { getSessionId: () => 'lesson-session-001', getBranch: () => [] };
  expect(customToolsForNode(root, lessonScope, manager).map((tool) => tool.name)).toEqual([
    'classroom_log_append',
    'classroom_update',
    'save_note',
    'save_problem_card',
    'lesson_memory_commit',
    'finish_lesson',
  ]);
  expect(customToolsForNode(root, planScope, manager).map((tool) => tool.name)).toEqual([
    'artifact_export',
    'save_prepared_problem_card',
    'memory_route_resolve',
    'finish_plan',
  ]);
  expect(customToolsForNode(root, roadmapScope)).toEqual([]);
});

test('recovers an interrupted memory transaction at the session-factory boundary', () => {
  const root = copyFixture();
  const indexPath = 'memory/INDEX.md';
  const indexBefore = readFileSync(join(root, indexPath), 'utf8');
  const objectPath = 'memory/objects/obj-001.md';
  mkdirSync(dirname(join(root, objectPath)), { recursive: true });

  expect(() => commitDocumentCandidates(root, [
    {
      path: indexPath,
      before: indexBefore,
      after: indexBefore.replace('尚无已固化课堂记忆', '中断中的候选'),
    },
    {
      path: objectPath,
      before: null,
      after: '# obj-001：中断候选\n',
    },
  ], {
    afterReplace: (_path, index) => {
      if (index === 0) throw new Error('SIMULATED_SESSION_FACTORY_CRASH');
    },
    leavePreparedOnError: true,
  })).toThrow('SIMULATED_SESSION_FACTORY_CRASH');
  expect(readFileSync(join(root, indexPath), 'utf8')).toContain('中断中的候选');

  expect(recoverSessionFactoryState(root)).toHaveLength(1);
  expect(readFileSync(join(root, indexPath), 'utf8')).toBe(indexBefore);
  expect(existsSync(join(root, objectPath))).toBeFalse();
});

test('settles a persisted memory call that stopped before its transaction began', () => {
  const root = copyFixture();
  const manager = SessionManager.create(root, join(root, '.pi-sessions'));
  manager.appendMessage({
    role: 'assistant',
    content: [{
      type: 'toolCall',
      id: 'interrupted-memory-call',
      name: 'lesson_memory_commit',
      arguments: { objects: [], preferences: [] },
    }],
    api: 'openai-responses',
    provider: 'openai',
    model: 'test-model',
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
  });
  const reopened = SessionManager.open(manager.getSessionFile()!, undefined, root);

  recoverOpenedSessionState(root, reopened);

  const result = reopened.getBranch().find((entry) => (
    entry.type === 'message' && entry.message.role === 'toolResult'
  ));
  expect(result).toMatchObject({
    message: {
      role: 'toolResult',
      toolCallId: 'interrupted-memory-call',
      toolName: 'lesson_memory_commit',
      isError: true,
      content: [{ type: 'text', text: 'INTERRUPTED_BEFORE_COMMIT' }],
    },
  });
});

test('keeps classroom and memory writes on bound teaching tools', () => {
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
  expect(agent).toContain('lesson_memory_commit');
  expect(agent).toContain('Lesson Session 不使用通用 `edit/write`');
  expect(skill).toContain('影响后续判断的事实');
  expect(skill).toContain('其余教学轮次');
  expect(combined).not.toContain('窄 edit');
  expect(combined).not.toContain('状态 edit');
  expect(combined).toContain('prepared → active → closed');
  for (const schemaDetail of ['insert', 'revise', 'move', 'skip_pending']) {
    expect(agent).not.toContain(schemaDetail);
  }
});

test('loads both Plan guards and the Lesson memory guard only in their scopes', async () => {
  const root = copyFixture();
  const previousCwd = process.cwd();
  process.chdir(root);
  const [planLoader, lessonLoader] = await Promise.all([
    createRoleResourceLoader(root, {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    }, createEventBus()),
    createRoleResourceLoader(root, {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'plans/plan-001/lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001/PLAN.md',
    }, createEventBus()),
  ]).finally(() => process.chdir(previousCwd));
  const extensionToolNames = (loader: typeof planLoader) => (
    loader.getExtensions().extensions.flatMap((extension) => (
      Array.from(extension.tools.keys())
    ))
  );

  expect(extensionToolNames(planLoader)).toContain('subagent');
  expect(extensionToolNames(lessonLoader)).not.toContain('subagent');
  expect(planLoader.getExtensions().extensions.filter(
    (extension) => extension.handlers.has('tool_call'),
  )).toHaveLength(2);
  expect(lessonLoader.getExtensions().extensions.filter(
    (extension) => extension.handlers.has('tool_call'),
  )).toHaveLength(1);
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

test('packages only the three bounded StudyForge product scouts', () => {
  const directory = join(import.meta.dir, '../../resources/subagents');
  expect(readdirSync(directory).filter((name) => name.endsWith('.md')).sort()).toEqual([
    'lesson-risk-reviewer.md',
    'paper-research-scout.md',
    'study-material-scout.md',
  ]);

  const paper = readFileSync(join(directory, 'paper-research-scout.md'), 'utf8');
  expect(paper).toContain('name: paper-research-scout');
  expect(paper).toContain('defaultContext: fresh');
  expect(paper.match(/^tools:.*$/m)?.[0]).toBe('tools:');
  expect(paper).toContain('inheritProjectContext: false');
  expect(paper).toContain('inheritSkills: false');
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
  const frontmatter = reviewer.split('---')[1] ?? '';
  expect(reviewer).toContain('name: lesson-risk-reviewer');
  expect(frontmatter).not.toMatch(/^model:/m);
  expect(frontmatter).not.toMatch(/^thinking:/m);
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
    if (!('nodeKind' in input)) throw new Error('NODE_SCOPE_EXPECTED');
    return fakeSession(`session-${input.nodeKind}-${input.nodeId}`);
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  const firstPlan = await registry.open('plan:plan-001');
  const samePlan = await registry.open('plan:plan-001');
  const lesson = await registry.open('lesson:plan-001:lesson-001');

  expect(samePlan).toBe(firstPlan);
  expect(lesson).not.toBe(firstPlan);
  expect(inputs.map((input) => 'nodePath' in input ? input.nodePath : null)).toEqual([
    'plans/plan-001/PLAN.md',
    'plans/plan-001/lessons/lesson-001.md',
  ]);
  expect(readFileSync(join(root, 'plans/plan-001/PLAN.md'), 'utf8'))
    .toContain('session_id: session-plan-plan-001');
  expect(readFileSync(join(root, 'plans/plan-001/lessons/lesson-001.md'), 'utf8'))
    .toContain('session_id: session-lesson-lesson-001');
});

test('recovers an active node whose empty session never reached disk', async () => {
  const root = copyFixture();
  const planPath = join(root, 'plans/plan-001/PLAN.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('session_id: null', 'session_id: dangling-session'),
  );
  const prompts: string[] = [];
  const registry = new WorkspaceRegistry(root, async () => ({
    ...fakeSession('replacement-session'),
    prompt: async (text) => { prompts.push(text); },
  }), async () => null);

  expect(await registry.readHistory('plan:plan-001')).toEqual([]);
  await registry.send('plan:plan-001', '继续学习。');

  expect(prompts).toEqual(['继续学习。']);
  expect(readFileSync(planPath, 'utf8')).toContain('session_id: replacement-session');
});

test('rejects a new turn after a cached node becomes terminal', async () => {
  const root = copyFixture();
  let prompts = 0;
  const registry = new WorkspaceRegistry(root, async () => ({
    ...fakeSession('session-plan-plan-001'),
    prompt: async () => { prompts += 1; },
  }), async () => null);

  await registry.open('plan:plan-001');
  transitionNode(root, 'plans/plan-001/PLAN.md', 'active', 'completed');

  await expect(registry.send('plan:plan-001', '不应继续。'))
    .rejects.toThrow('SESSION_NODE_NOT_ACTIVE: plan:plan-001:completed');
  expect(prompts).toBe(0);
  registry.dispose();
});

test('waits for the queued turn to settle before abort resolves', async () => {
  const root = copyFixture();
  let markStarted!: () => void;
  let finishPrompt!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const pending = new Promise<void>((resolve) => { finishPrompt = resolve; });
  const session = {
    ...fakeSession('session-plan-plan-001'),
    prompt: async () => {
      markStarted();
      await pending;
    },
  };
  const registry = new WorkspaceRegistry(root, async () => session, async () => null);
  const turn = registry.send('plan:plan-001', '继续讨论。');
  await started;
  let settled = false;
  const aborted = registry.abort('plan:plan-001').then(() => { settled = true; });

  await Promise.resolve();
  expect(settled).toBeFalse();
  finishPrompt();
  await turn;
  await aborted;
  expect(settled).toBeTrue();
  registry.dispose();
});

test('restores the persisted owner session without copying another branch', async () => {
  const root = copyFixture();
  const first = new WorkspaceRegistry(
    root,
    async (input) => {
      if (!('nodeId' in input)) throw new Error('NODE_SCOPE_EXPECTED');
      return fakeSession(`saved-${input.nodeId}`, `/sessions/saved-${input.nodeId}.jsonl`);
    },
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

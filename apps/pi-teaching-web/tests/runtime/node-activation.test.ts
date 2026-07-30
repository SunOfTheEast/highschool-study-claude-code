import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NodeActivationService,
} from '../../src/runtime/node-activation';
import {
  materializeChild,
  updateParentDocument,
} from '../../src/runtime/tree-mutations';
import type {
  StudySession,
  StudySessionFactory,
} from '../../src/runtime/session-factory';
import { roleForNode } from '../../src/runtime/session-scope';
import { renderPreparedLesson } from '../../src/study/lesson-blueprint';
import { renderPreparedPlan } from '../../src/study/plan-blueprint';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'study-node-activation-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

function idleSession(
  sessionId: string,
  sessionFile = `/tmp/${sessionId}.jsonl`,
): StudySession {
  return {
    sessionId,
    sessionFile,
    messages: [],
    entries: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    deepModeEnabled: () => false,
    setDeepMode: () => {},
    workflows: () => [],
    memoryReview: () => null,
    saveMemoryReview: () => {},
    notifyMemoryReviewApplied: async () => {},
    confirmWorkflow: async () => {
      throw new Error('WORKFLOW_NOT_FOUND');
    },
    cancelWorkflow: () => {},
    subscribeWorkflows: () => () => {},
    triggerLessonStart: async () => {},
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  };
}

function setPlanPrepared(root: string): void {
  const path = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8')
      .replace('status: active', 'status: prepared')
      .replace(
        'Activated at: 2026-07-21T08:00:00.000Z',
        'Activated at: pending',
      ),
  );
}

test('atomically activates a prepared Plan with its v2 owner scope', async () => {
  const root = fixture();
  setPlanPrepared(root);
  const opened: unknown[] = [];
  const factory: StudySessionFactory = async (input) => {
    opened.push(input);
    return idleSession('coach-plan-session');
  };
  const sessions = new Map<string, StudySession>();
  const service = new NodeActivationService({
    root,
    factory,
    lookup: async () => null,
    sessions,
    now: () => new Date('2026-07-31T01:02:03.000Z'),
  });

  const receipt = await service.activatePlan('domain-integrity');

  expect(receipt).toEqual({
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    sessionKey: 'coach:domain-integrity',
    sessionId: 'coach-plan-session',
    shouldKickoff: true,
  });
  expect(opened).toEqual([{
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
    sessionFile: null,
  }]);
  expect(readFileSync(
    join(root, 'plans/domain-integrity.md'),
    'utf8',
  )).toContain('Activated at: 2026-07-31T01:02:03.000Z');
  expect(readPlanWorkspace(root, 'domain-integrity').plan.status).toBe('active');
  expect(sessions.get('coach:domain-integrity')?.sessionId)
    .toBe('coach-plan-session');
  expect(() => materializeChild(root, {
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
    childKind: 'plan',
    candidateHandle: 'plan-candidate-001',
    title: '不应覆盖 active Plan',
    render: () => {
      throw new Error('render must not run');
    },
    validate: () => {},
  })).toThrow(
    'NODE_REPREPARE_REQUIRES_PREPARED: domain-integrity',
  );
});

test('coalesces concurrent Lesson activation into one Session', async () => {
  const root = fixture();
  let creations = 0;
  let release!: () => void;
  let entered!: () => void;
  const factoryEntered = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const factory: StudySessionFactory = async (scope) => {
    creations += 1;
    expect(roleForNode(scope.nodeKind)).toBe('tutor');
    entered();
    await pending;
    return idleSession('tutor-lesson-session');
  };
  const service = new NodeActivationService({
    root,
    factory,
    lookup: async () => null,
    sessions: new Map(),
    now: () => new Date('2026-07-31T02:00:00.000Z'),
  });

  const first = service.activateLesson('lesson-003');
  const second = service.activateLesson('lesson-003');
  await factoryEntered;
  expect(creations).toBe(1);
  release();

  const receipts = await Promise.all([first, second]);
  expect(receipts.map((receipt) => receipt.shouldKickoff))
    .toEqual([true, false]);
  expect(readPlanWorkspace(root, 'domain-integrity').lessons[2])
    .toMatchObject({
      status: 'active',
      tutorSessionId: 'tutor-lesson-session',
    });
});

test('keeps a prepared node unchanged when Session creation fails', async () => {
  const root = fixture();
  const path = join(root, 'lessons/lesson-003.md');
  const before = readFileSync(path, 'utf8');
  const service = new NodeActivationService({
    root,
    factory: async () => {
      throw new Error('factory failed');
    },
    lookup: async () => null,
    sessions: new Map(),
  });

  await expect(service.activateLesson('lesson-003'))
    .rejects.toThrow('factory failed');
  expect(readFileSync(path, 'utf8')).toBe(before);
});

test('disposes the new Session and keeps the node prepared when commit fails', async () => {
  const root = fixture();
  const path = join(root, 'lessons/lesson-003.md');
  const before = readFileSync(path, 'utf8');
  let disposed = false;
  const session = idleSession('uncommitted-session');
  session.dispose = () => {
    disposed = true;
  };
  const sessions = new Map<string, StudySession>();
  const service = new NodeActivationService({
    root,
    factory: async () => session,
    lookup: async () => null,
    sessions,
    commitNode: () => {
      throw new Error('node commit failed');
    },
  });

  await expect(service.activateLesson('lesson-003'))
    .rejects.toThrow('node commit failed');
  expect(disposed).toBe(true);
  expect(sessions.has('tutor:lesson-003')).toBe(false);
  expect(readFileSync(path, 'utf8')).toBe(before);
});

test('rejects a second active or paused Lesson in the same Plan', async () => {
  const root = fixture();
  const occupied = join(root, 'lessons/lesson-002.md');
  writeFileSync(
    occupied,
    readFileSync(occupied, 'utf8').replace('status: closed', 'status: paused'),
  );
  const service = new NodeActivationService({
    root,
    factory: async (scope) => idleSession(
      `${roleForNode(scope.nodeKind)}-${scope.nodeId}`,
    ),
    lookup: async () => null,
    sessions: new Map(),
  });

  await expect(service.activateLesson('lesson-003'))
    .rejects.toThrow('PLAN_LESSON_SLOT_OCCUPIED: lesson-002');
});

test('never treats a parent-owned Candidate handle as an activatable node', async () => {
  const root = fixture();
  updateParentDocument(root, {
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
    childKind: 'plan',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '候选学习周期。',
        after: 'plan-candidate-001',
        dependsOn: [],
        considerWhen: '现有周期结束后。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '尚未物化。',
      },
    }],
    sections: {},
    frontmatter: {},
  });
  const service = new NodeActivationService({
    root,
    factory: async () => idleSession('must-not-open'),
    lookup: async () => null,
    sessions: new Map(),
  });

  await expect(service.activatePlan('plan-candidate-002'))
    .rejects.toThrow(
      'NODE_CANDIDATE_NOT_ACTIVATABLE: plan-candidate-002',
    );
});

test('allows Lessons in different active Plans to run in parallel', async () => {
  const root = fixture();
  const activation = {
    parentSources: ['trace:trace-fixture-002'],
    selectedMemory: [],
    contentBoundary: ['不提前公布决定性步骤。'],
    adaptation: {
      workingJudgment: '需要建立一条并行学习路线。',
      sources: ['trace:trace-fixture-002'],
      designConsequence: '先用短课确认起点。',
      reviseIf: '学生已经稳定掌握。',
    },
  };
  const planTree = updateParentDocument(root, {
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
    childKind: 'plan',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '并行检查另一项能力。',
        after: 'plan-candidate-001',
        dependsOn: [],
        considerWhen: '学生希望并行推进。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '与定义域周期相互独立。',
      },
    }],
    sections: {},
    frontmatter: {},
  });
  const planHandle = planTree.entries.at(-1)!.handle;
  const plan = materializeChild(root, {
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
    childKind: 'plan',
    candidateHandle: planHandle,
    title: '并行学习周期',
    render: ({ childId, childPath }) => renderPreparedPlan({
      planId: childId,
      planPath: childPath,
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    }, {
      title: '并行学习周期',
      publicPurpose: '并行检查另一项能力。',
      goal: '完成另一项能力的短诊断。',
      capabilityStandard: '能独立说明判断依据。',
      test: '完成一项短迁移任务。',
      planningBasis: '当前路线与定义域训练互不依赖。',
      activation,
    }),
    validate: () => {},
  });
  const sessions = new Map<string, StudySession>();
  const service = new NodeActivationService({
    root,
    factory: async (scope) => idleSession(
      `${roleForNode(scope.nodeKind)}-${scope.nodeId}`,
    ),
    lookup: async () => null,
    sessions,
    now: () => new Date('2026-07-31T03:00:00.000Z'),
  });
  await service.activatePlan(plan.childId);
  const lessonTree = updateParentDocument(root, {
    parentId: plan.childId,
    parentPath: plan.childPath,
    childKind: 'lesson',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '完成并行周期的起点诊断。',
        after: null,
        dependsOn: [],
        considerWhen: '周期启动后。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '只做一项短任务。',
      },
    }],
    sections: {},
    frontmatter: {},
  });
  const lessonHandle = lessonTree.entries[0]!.handle;
  const lesson = materializeChild(root, {
    parentId: plan.childId,
    parentPath: plan.childPath,
    childKind: 'lesson',
    candidateHandle: lessonHandle,
    title: '并行短课',
    render: ({ childId, childPath }) => renderPreparedLesson({
      planId: plan.childId,
      planPath: plan.childPath,
      planTitle: '并行学习周期',
      lessonId: childId,
      lessonPath: childPath,
    }, {
      title: '并行短课',
      publicPurpose: '完成并行周期的起点诊断。',
      capabilityTarget: '能说明当前判断依据。',
      primaryTemplate: 'diagnostic',
      templateReason: '需要先确认起点。',
      adjustments: [],
      activation,
      cards: [],
      sources: [],
      blocks: [{
        localAlias: 'orientation',
        kind: 'dialogue',
        required: true,
        dependsOn: [],
        uses: [],
        studentView: '请说明你会从哪里开始判断。',
        teacherControl: '只追问判断依据，不提供标准路线。',
      }],
    }),
    validate: () => {},
  });
  const occupied = join(root, 'lessons/lesson-002.md');
  writeFileSync(
    occupied,
    readFileSync(occupied, 'utf8').replace('status: closed', 'status: paused'),
  );

  await expect(service.activateLesson(lesson.childId)).resolves.toMatchObject({
    nodeId: lesson.childId,
    shouldKickoff: true,
  });
  expect(readPlanWorkspace(root, plan.childId).lessons[0]?.status)
    .toBe('active');
});

test('serializes competing Lesson starts inside one Plan slot', async () => {
  const root = fixture();
  const lessonTree = updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '同周期的另一个可启动课堂。',
        after: 'lesson-candidate-003',
        dependsOn: [],
        considerWhen: '学生选择另一条课堂路线。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '用于验证同 Plan 激活互斥。',
      },
    }],
    sections: {},
    frontmatter: {},
  });
  const handle = lessonTree.entries.at(-1)!.handle;
  const sibling = materializeChild(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateHandle: handle,
    title: '同周期候选短课',
    render: ({ childId, childPath }) => renderPreparedLesson({
      planId: 'domain-integrity',
      planPath: 'plans/domain-integrity.md',
      planTitle: '定义域完整性的系统加固',
      lessonId: childId,
      lessonPath: childPath,
    }, {
      title: '同周期候选短课',
      publicPurpose: '验证同周期课堂互斥。',
      capabilityTarget: '能说明一个判断依据。',
      primaryTemplate: 'diagnostic',
      templateReason: '用于并发激活检查。',
      adjustments: [],
      activation: {
        parentSources: ['trace:trace-fixture-002'],
        selectedMemory: [],
        contentBoundary: ['不提前公布答案。'],
        adaptation: {
          workingJudgment: '需要一项短诊断。',
          sources: ['trace:trace-fixture-002'],
          designConsequence: '只安排一个对话节点。',
          reviseIf: '学生已经掌握。',
        },
      },
      cards: [],
      sources: [],
      blocks: [{
        localAlias: 'orientation',
        kind: 'dialogue',
        required: true,
        dependsOn: [],
        uses: [],
        studentView: '请说明你的判断起点。',
        teacherControl: '只追问依据。',
      }],
    }),
    validate: () => {},
  });
  let release!: () => void;
  let entered!: () => void;
  const factoryEntered = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const factoryPending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let creations = 0;
  const service = new NodeActivationService({
    root,
    factory: async (scope) => {
      creations += 1;
      entered();
      await factoryPending;
      return idleSession(`tutor-${scope.nodeId}`);
    },
    lookup: async () => null,
    sessions: new Map(),
  });

  const first = service.activateLesson('lesson-003');
  const competing = service.activateLesson(sibling.childId);
  await factoryEntered;
  release();
  const settled = await Promise.allSettled([first, competing]);

  expect(creations).toBe(1);
  expect(settled.filter((result) => result.status === 'fulfilled'))
    .toHaveLength(1);
  expect(settled.filter((result) => result.status === 'rejected')
    .map((result) => String((result as PromiseRejectedResult).reason)))
    .toEqual([
      expect.stringContaining('PLAN_LESSON_SLOT_OCCUPIED: lesson-003'),
    ]);
  expect(readPlanWorkspace(root, 'domain-integrity').lessons
    .filter((lesson) => lesson.status === 'active'))
    .toHaveLength(1);
});

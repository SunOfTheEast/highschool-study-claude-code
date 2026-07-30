import { join } from 'node:path';
import {
  SessionManager,
  type SessionEntry,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  appendTrace,
  parseHandoff,
} from 'highschool-study-markdown/study-domain';
import { ROADMAP_COACH_SESSION_KEY } from '../../src/shared/contracts';
import type {
  AbilityProjection,
  ChatMessage,
  ConversationItem,
  SessionKey,
} from '../../src/shared/contracts';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import {
  readPlanWorkspace,
  readRoadmapWorkspace,
} from '../../src/study/read-workspace';
import {
  closeLesson,
  setBlockStatus,
  setFrontmatterField,
} from '../../src/study/write-workspace';
import { readLearningSet } from '../../src/study/read-workspace';
import { renderLearningReview } from '../../src/study/learning-review';
import { resolvePersona } from '../../src/study/persona';
import { PreparedLessonValidationError } from '../../src/study/validate-prepared-lesson';
import { createRoadmapUpdateTool } from '../../src/runtime/roadmap-update';
import { createPlanPrepareTool } from '../../src/runtime/plan-prepare';
import { createPlanUpdateTool } from '../../src/runtime/plan-update';
import { createLessonPrepareTool } from '../../src/runtime/lesson-prepare';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { createStudyTools } from '../../src/runtime/study-tools';
import { NodeActivationService } from '../../src/runtime/node-activation';
import type {
  StudySession,
  StudySessionFactory,
} from '../../src/runtime/session-factory';
import { createMemoryReviewProposeTool } from '../../src/memory-review/tool';
import {
  MemoryReviewStore,
  submittedMemoryReview,
} from '../../src/memory-review/store';
import { applyMemoryReview } from '../../src/memory-review/apply-service';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { projectConversationEntries } from '../../src/projection/conversation-projector';
import type { WorkflowSnapshot, WorkflowTaskState } from '../../src/workflows/contracts';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const sourceRoot = domainIntegrityFixtureRoot;
const root = mkdtempSync(`${tmpdir()}/studyforge-e2e-`);
cpSync(sourceRoot, root, { recursive: true });
const lesson003Path = join(root, 'lessons/lesson-003.md');
const lesson003Baseline = readFileSync(lesson003Path, 'utf8');
const planPath = join(root, 'plans/domain-integrity.md');
const planBaseline = readFileSync(planPath, 'utf8');
const roadmapPath = join(root, 'ROADMAP.md');
const roadmapBaseline = readFileSync(roadmapPath, 'utf8');
const hub = new EventHub();
const coachKey: SessionKey = 'coach:domain-integrity';
const roadmapKey: SessionKey = ROADMAP_COACH_SESSION_KEY;

function replaceFixtureSection(
  source: string,
  heading: string,
  value: string,
): string {
  const pattern = new RegExp(
    `(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`,
    'm',
  );
  return source.replace(
    pattern,
    (_match, sectionHeading: string) => (
      `${sectionHeading}\n${value.trim()}\n\n`
    ),
  );
}

function updateFixturePlan(
  planRelativePath: string,
  input: {
    currentPosition: string;
    learningReview: Parameters<typeof renderLearningReview>[0];
  },
): void {
  const absolute = join(root, planRelativePath);
  let source = readFileSync(absolute, 'utf8');
  source = replaceFixtureSection(
    source,
    'Current Position',
    input.currentPosition,
  );
  source = replaceFixtureSection(
    source,
    'Plan Summary',
    renderLearningReview(input.learningReview),
  );
  source = source.replace(/^status:.*$/m, 'status: completed');
  writeFileSync(absolute, source);
}

function task(
  id: string,
  label: string,
  role: string,
  dependsOn: string[],
  status: WorkflowTaskState['status'],
): WorkflowTaskState {
  return {
    id,
    label,
    role,
    instruction: `private ${id} instruction`,
    dependsOn,
    sourceHandles: [`cards/${id}.card.yaml`],
    readRoots: ['cards', 'lessons'],
    status,
    runId: status === 'completed' ? `run-${id}` : null,
    tokens: status === 'completed' ? 200 : 0,
    durationMs: status === 'completed' ? 100 : 0,
    toolCount: status === 'completed' ? 2 : 0,
    currentTool: null,
    result: status === 'completed'
      ? {
        findings: [`private ${id} finding`],
        evidence_refs: [`cards/${id}.card.yaml`],
        recommended_action: `private ${id} action`,
        risks: [],
      }
      : null,
    error: null,
  };
}

const workflows = new Map<SessionKey, WorkflowSnapshot[]>([[coachKey, [
  {
    id: 'wf-proposed',
    parentSessionKey: coachKey,
    goal: '备课多视角检查',
    mode: 'deep',
    status: 'proposed',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    tasks: [
      task('evidence', '整理真实证据', '证据分析员', [], 'queued'),
      task('design', '设计课堂活动', '课堂设计员', ['evidence'], 'queued'),
      task('spoiler', '检查学生视图', '防剧透审查员', ['design'], 'queued'),
    ],
  },
  {
    id: 'wf-cancellable',
    parentSessionKey: coachKey,
    goal: '可取消会诊',
    mode: 'deep',
    status: 'running',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-22T00:01:00Z',
    updatedAt: '2026-07-22T00:01:10Z',
    tasks: [
      task('completed-evidence', '已完成证据', '证据分析员', [], 'completed'),
      task('pending-design', '尚未完成设计', '课堂设计员', ['completed-evidence'], 'running'),
    ],
  },
]]]);
const deepMode = new Map<SessionKey, boolean>();
const personaSelections = new Map<SessionKey, string>();
const proposedMemoryReview = {
  id: 'fixture-memory-review',
  planId: 'domain-integrity',
  status: 'proposed',
  items: [{
    id: 'preference-add',
    operation: 'add',
    owner: 'student',
    currentId: null,
    currentText: null,
    proposedText: '先独立尝试，再请求方向性提示。',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '在本周期多节训练中反复出现。',
    counterEvidence: '新概念首次接触时可能需要示范。',
    scope: '复习与专项训练。',
  }, {
    id: 'teaching-revise',
    operation: 'revise',
    owner: 'teaching',
    currentId: 'T1',
    currentText: '立即指出错误位置。',
    proposedText: '先请学生说明判断依据，再决定是否指出错误位置。',
    sources: ['lessons/lesson-002.md#lesson-summary'],
    rationale: '学生先表达依据时，后续修正更稳定。',
    counterEvidence: '时间紧张的验收课不一定适用。',
    scope: '常规互动讲解。',
  }, {
    id: 'preference-delete',
    operation: 'delete',
    owner: 'student',
    currentId: 'S1',
    currentText: '每一步都需要确认。',
    proposedText: null,
    sources: ['plans/domain-integrity.md#plan-summary'],
    rationale: '后续独立作答已不支持这条旧记录。',
    counterEvidence: '复杂新题仍可能主动请求核对。',
    scope: '本学习周期。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;
const appliedMemoryReview = {
  ...proposedMemoryReview,
  status: 'applied',
  decisions: [{
    itemId: 'preference-add',
    action: 'accept',
    text: null,
  }, {
    itemId: 'teaching-revise',
    action: 'rewrite',
    text: '先让我完整说出判断依据，再决定是否提示。',
  }, {
    itemId: 'preference-delete',
    action: 'reject',
    text: null,
  }],
  receipt: {
    reviewId: 'fixture-memory-review',
    appliedItems: ['preference-add', 'teaching-revise'],
    unchangedItems: ['preference-delete'],
    profilePaths: {
      student: 'memory/student-profile.md',
      teaching: 'memory/teaching-profile.md',
    },
  },
} satisfies MemoryReviewSnapshot;

const rawPreparationEntries = [{
  id: 'fixture-prepare-call',
  parentId: null,
  timestamp: '2026-07-29T09:00:00Z',
  type: 'message',
  message: {
    role: 'assistant',
    content: [{
      type: 'text',
      text: '内部选卡：绝密参数边界综合题使用冻结变量法。',
    }, {
      type: 'toolCall',
      id: 'fixture-prepare-tool',
      name: 'lesson_prepare',
      arguments: { title: '绝密参数边界综合题' },
    }],
  },
}, {
  id: 'fixture-prepare-result',
  parentId: null,
  timestamp: '2026-07-29T09:00:01Z',
  type: 'message',
  message: {
    role: 'toolResult',
    toolName: 'lesson_prepare',
    isError: false,
    content: [{ type: 'text', text: '{"ok":true}' }],
    details: {
      kind: 'lesson-prepare',
      value: {
        ok: true,
        factId: 'lesson-003',
        lessonPath: 'lessons/lesson-003.md',
        publicTitle: '下一节课堂',
        publicPurpose: '完成一次独立能力检验',
        blockCount: 5,
        blockKinds: ['dialogue', 'problem', 'reflection'],
        sourceNumbers: ['mst_p0017_ex05', 'mst_p0030_ex16', 'mst_p0032_ex22'],
      },
    },
  },
}, {
  id: 'fixture-prepare-final',
  parentId: null,
  timestamp: '2026-07-29T09:00:02Z',
  type: 'message',
  message: {
    role: 'assistant',
    content: [{
      type: 'text',
      text: '课已备好：绝密参数边界综合题使用冻结变量法。',
    }],
  },
}] as SessionEntry[];

function safePreparationHistory(): ConversationItem[] {
  return projectConversationEntries(coachKey, rawPreparationEntries, 'safe');
}

let currentMemoryReview: MemoryReviewSnapshot = proposedMemoryReview;
const fixtureHistory = new Map<SessionKey, ConversationItem[]>();
fixtureHistory.set(roadmapKey, [{
  kind: 'message',
  message: {
    id: 'fixture-roadmap-message',
    role: 'coach',
    text: '这里用于回看整个学习集，并在你确认后开启新的学习周期。',
    complete: true,
  },
}]);
fixtureHistory.set(coachKey, [{
  kind: 'message',
  message: {
    id: 'fixture-memory-intro',
    role: 'coach',
    text: '这个学习周期已经结束。我从课堂记录中整理了三条长期记忆候选，请你逐项确认。',
    complete: true,
  },
}, {
  kind: 'memory-review',
  review: currentMemoryReview,
}]);
const coachHistoryBaseline = structuredClone(fixtureHistory.get(coachKey)!);
const workflowListeners = new Map<SessionKey, Set<(snapshot: WorkflowSnapshot) => void>>();
const sessionListeners = new Map<SessionKey, Set<(event: unknown) => void>>();
const abilityProjection: AbilityProjection = {
  nodes: [{
    method: '链式求导',
    state: 'unstable',
    score: 0.7,
    evidenceCount: 2,
    sources: ['traces/fixture-trace.json'],
  }],
};
let rejectNextLessonStart = false;

type HierarchicalFlowState = {
  planId: string | null;
  firstLessonId: string | null;
  secondLessonId: string | null;
  firstClaim: string | null;
  firstTrace: string | null;
  replacementTrace: string | null;
  memoryReviewId: string | null;
  sourceOnlyClosed: boolean;
  parallelPlansObserved: boolean;
  checkpointId: string | null;
};

function emptyHierarchicalFlowState(): HierarchicalFlowState {
  return {
    planId: null,
    firstLessonId: null,
    secondLessonId: null,
    firstClaim: null,
    firstTrace: null,
    replacementTrace: null,
    memoryReviewId: null,
    sourceOnlyClosed: false,
    parallelPlansObserved: false,
    checkpointId: null,
  };
}

let hierarchicalFlow = emptyHierarchicalFlowState();
let selectedPlanId = 'domain-integrity';
let hierarchicalSessionCounter = 0;
let hierarchicalClock = 0;
let registeredPlanId: string | null = null;
const hierarchicalSessions = new Map<string, StudySession>();
let hierarchicalManager = SessionManager.inMemory(root);
let hierarchicalMemory = new MemoryReviewStore(hierarchicalManager);

function hierarchicalSession(sessionId: string): StudySession {
  return {
    sessionId,
    sessionFile: `/tmp/${sessionId}.jsonl`,
    messages: [],
    entries: [],
    isStreaming: false,
    personaId: () => null,
    setPersona: async () => {},
    deepModeEnabled: () => false,
    setDeepMode: () => {},
    workflows: () => [],
    memoryReview: () => hierarchicalMemory.latest(),
    saveMemoryReview: (snapshot) => hierarchicalMemory.save(snapshot),
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

const hierarchicalSessionFactory: StudySessionFactory = async (input) => (
  hierarchicalSession(
    `hierarchical-${input.nodeKind}-${input.nodeId}-${
      ++hierarchicalSessionCounter
    }`,
  )
);

const hierarchicalActivation = new NodeActivationService({
  root,
  factory: hierarchicalSessionFactory,
  lookup: async () => null,
  sessions: hierarchicalSessions,
  now: () => new Date(
    Date.UTC(2026, 6, 31, 10, 0, hierarchicalClock++),
  ),
});

async function toolValue(
  tool: ToolDefinition,
  id: string,
  input: object,
): Promise<Record<string, unknown>> {
  const result = await tool.execute(
    id,
    input as never,
    undefined,
    undefined,
    {} as never,
  );
  const first = result.content[0];
  if (first?.type !== 'text') throw new Error('TOOL_TEXT_RESULT_REQUIRED');
  return JSON.parse(first.text) as Record<string, unknown>;
}

function hierarchicalPlanId(): string {
  if (!hierarchicalFlow.planId) throw new Error('HIERARCHICAL_PLAN_REQUIRED');
  return hierarchicalFlow.planId;
}

function hierarchicalLessonId(which: 'first' | 'second'): string {
  const id = which === 'first'
    ? hierarchicalFlow.firstLessonId
    : hierarchicalFlow.secondLessonId;
  if (!id) throw new Error(`HIERARCHICAL_${which.toUpperCase()}_LESSON_REQUIRED`);
  return id;
}

function hierarchicalPlanPath(): string {
  return `plans/${hierarchicalPlanId()}.md`;
}

function hierarchicalLessonPath(which: 'first' | 'second'): string {
  return `lessons/${hierarchicalLessonId(which)}.md`;
}

function resetHierarchicalFlow(): void {
  for (const session of hierarchicalSessions.values()) session.dispose();
  hierarchicalSessions.clear();
  rmSync(root, { recursive: true, force: true });
  cpSync(sourceRoot, root, { recursive: true });
  hierarchicalFlow = emptyHierarchicalFlowState();
  selectedPlanId = 'domain-integrity';
  hierarchicalSessionCounter = 0;
  hierarchicalClock = 0;
  registeredPlanId = null;
  hierarchicalManager = SessionManager.inMemory(root);
  hierarchicalMemory = new MemoryReviewStore(hierarchicalManager);
  fixtureHistory.clear();
  fixtureHistory.set(roadmapKey, [{
    kind: 'message',
    message: {
      id: 'fixture-roadmap-message',
      role: 'coach',
      text: '这里用于回看整个学习集，并在你确认后开启新的学习周期。',
      complete: true,
    },
  }]);
  fixtureHistory.set(coachKey, structuredClone(coachHistoryBaseline));
  currentMemoryReview = proposedMemoryReview;
  rejectNextLessonStart = false;
  personaSelections.clear();
  deepMode.clear();
}

async function addHierarchicalPlanCandidate(): Promise<HierarchicalFlowState> {
  await toolValue(
    createRoadmapUpdateTool(root),
    'hierarchical-add-plan',
    {
      candidateChanges: [{
        action: 'add',
        candidate: {
          publicPurpose: '训练跨结构判断。',
          after: 'plan-candidate-001',
          dependsOn: [],
          considerWhen: '学生希望把已有方法迁移到陌生结构。',
          sources: ['trace:trace-fixture-002'],
          privateNote: 'PRIVATE_BRANCH_ONLY：保留陌生题型和方法候选。',
        },
      }],
    },
  );
  return structuredClone(hierarchicalFlow);
}

async function prepareHierarchicalPlan(): Promise<HierarchicalFlowState> {
  const value = await toolValue(
    createPlanPrepareTool(root),
    'hierarchical-prepare-plan',
    {
      candidateHandle: 'plan-candidate-002',
      blueprint: {
        title: '跨结构判断周期',
        publicPurpose: '训练跨结构判断。',
        goal: '把已有定义域意识迁移到陌生结构。',
        capabilityStandard: '连续两次在陌生结构中先写出并使用合法域。',
        test: '完成一次无提示跨结构判断并说明边界。',
        planningBasis: '已有一次独立正证据，但尚未形成跨结构连续性。',
        activation: {
          parentSources: ['trace:trace-fixture-002'],
          selectedMemory: [],
          contentBoundary: ['不公开 SECRET_METHOD_ROUTE。'],
          adaptation: {
            workingJudgment: '当前关键是跨结构迁移而不是重复同类计算。',
            sources: ['trace:trace-fixture-002'],
            designConsequence: '先只改变结构外壳，再根据第一课表现决定下一步。',
            reviseIf: '学生在第一课无法主动写出合法域。',
          },
        },
      },
    },
  );
  hierarchicalFlow.planId = String(value.factId);
  return structuredClone(hierarchicalFlow);
}

async function addHierarchicalLessonCandidates(): Promise<HierarchicalFlowState> {
  await toolValue(
    createPlanUpdateTool(root, hierarchicalPlanPath()),
    'hierarchical-add-lessons',
    {
      decision: 'active',
      currentPosition: '准备第一节跨结构判断课。',
      planSummary: '尚未产生本周期课堂结果。',
      candidateChanges: [{
        action: 'add',
        candidate: {
          publicPurpose: '完成第一轮跨结构判断。',
          after: null,
          dependsOn: [],
          considerWhen: '学生确认开始本周期。',
          sources: ['trace:trace-fixture-002'],
          privateNote: 'SECRET_METHOD_ROUTE：使用一张未见参数题。',
        },
      }, {
        action: 'add',
        candidate: {
          publicPurpose: '根据第一课表现继续迁移。',
          after: 'lesson-candidate-001',
          dependsOn: ['lesson-candidate-001'],
          considerWhen: '第一课已经关闭。',
          sources: ['trace:trace-fixture-002'],
          privateNote: 'PRIVATE_BRANCH_ONLY：第二课内容只在物化后冻结。',
        },
      }],
    },
  );
  return structuredClone(hierarchicalFlow);
}

function firstLessonBlueprint() {
  return {
    title: 'HIERARCHICAL_FIRST_TRUE_TITLE',
    publicPurpose: '完成第一轮跨结构判断。',
    capabilityTarget: '独立写出并使用全部合法域。',
    primaryTemplate: 'assessment',
    templateReason: '需要一份未见结构的首次作答记录。',
    adjustments: [],
    activation: {
      parentSources: ['trace:trace-fixture-002'],
      selectedMemory: [],
      contentBoundary: ['首次作答前不公开方法候选。'],
      adaptation: {
        workingJudgment: '定义域主动性已经出现，跨结构连续性尚未确认。',
        sources: ['trace:trace-fixture-002'],
        designConsequence: '只改变题型外壳并保留无提示首次尝试。',
        reviseIf: '学生需要方向性提示才能写出合法域。',
      },
    },
    cards: [{
      alias: 'Q-HIER-1',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      role: '跨结构核验',
    }],
    sources: [],
    blocks: [{
      localAlias: 'attempt',
      kind: 'problem',
      required: true,
      dependsOn: [],
      uses: ['Q-HIER-1'],
      studentView: '请独立完成这次跨结构判断。',
      teacherControl: 'SECRET_METHOD_ROUTE；只观察首次作答。',
    }, {
      localAlias: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: ['attempt'],
      uses: [],
      studentView: '说明哪个合法域条件真正改变了推导。',
      teacherControl: '只总结学生已经表达的内容。',
    }],
  };
}

function secondLessonBlueprint() {
  return {
    title: 'HIERARCHICAL_SECOND_TRUE_TITLE',
    publicPurpose: '根据第一课表现继续迁移。',
    capabilityTarget: '复核第一课更正后的边界。',
    primaryTemplate: 'review',
    templateReason: '本课只做短复盘并允许无结论关闭。',
    adjustments: [],
    activation: {
      parentSources: [
        hierarchicalFlow.replacementTrace
          ?? hierarchicalFlow.firstTrace
          ?? 'trace:trace-fixture-002',
      ],
      selectedMemory: [],
      contentBoundary: ['不复制第一课完整对话。'],
      adaptation: {
        workingJudgment: '需要确认更正后的记录如何影响下一步。',
        sources: [
          hierarchicalFlow.replacementTrace
            ?? hierarchicalFlow.firstTrace
            ?? 'trace:trace-fixture-002',
        ],
        designConsequence: '进行一次短复盘，不强迫形成新能力结论。',
        reviseIf: '学生选择继续做新的独立评估。',
      },
    },
    cards: [],
    sources: [],
    blocks: [{
      localAlias: 'review',
      kind: 'dialogue',
      required: true,
      dependsOn: [],
      uses: [],
      studentView: '比较第一课原记录与更正后的边界。',
      teacherControl: 'PRIVATE_BRANCH_ONLY：不引入新的方法判断。',
    }, {
      localAlias: 'reflection',
      kind: 'reflection',
      required: false,
      dependsOn: ['review'],
      uses: [],
      studentView: '如果今天到这里就够了，可以直接结束。',
      teacherControl: '不把反思变成关课门槛。',
    }],
  };
}

async function prepareFirstHierarchicalLesson(): Promise<HierarchicalFlowState> {
  const value = await toolValue(
    createLessonPrepareTool(
      root,
      hierarchicalPlanId(),
      hierarchicalPlanPath(),
    ),
    'hierarchical-prepare-first',
    {
      candidateHandle: 'lesson-candidate-001',
      blueprint: firstLessonBlueprint(),
    },
  );
  hierarchicalFlow.firstLessonId = String(value.factId);
  return structuredClone(hierarchicalFlow);
}

async function prepareSecondHierarchicalLesson(): Promise<HierarchicalFlowState> {
  const value = await toolValue(
    createLessonPrepareTool(
      root,
      hierarchicalPlanId(),
      hierarchicalPlanPath(),
    ),
    'hierarchical-prepare-second',
    {
      candidateHandle: 'lesson-candidate-002',
      blueprint: secondLessonBlueprint(),
    },
  );
  hierarchicalFlow.secondLessonId = String(value.factId);
  return structuredClone(hierarchicalFlow);
}

async function completeFirstHierarchicalLesson(): Promise<HierarchicalFlowState> {
  const lessonId = hierarchicalLessonId('first');
  const lessonPath = hierarchicalLessonPath('first');
  const classroom = createClassroomUpdateTool(root, lessonPath);
  await toolValue(classroom, 'first-activate', {
    action: 'activate',
    blockId: 'block-001',
  });
  const traceTool = createStudyTools(
    root,
    () => new Date('2026-07-31T10:20:00.000Z'),
    {
      nodeKind: 'lesson',
      nodeId: lessonId,
      nodePath: lessonPath,
      parentId: hierarchicalPlanId(),
      parentPath: hierarchicalPlanPath(),
    },
  ).find((tool) => tool.name === 'trace_append');
  if (!traceTool) throw new Error('TRACE_APPEND_TOOL_REQUIRED');
  const trace = await toolValue(traceTool, 'first-trace', {
    blockId: 'block-001',
    assessment: 'correct',
    support: 'none',
    note: '学生首次独立写出并使用全部合法域。',
    methodStatus: 'unmapped',
    methodRoute: '学生先检查合法域，再完成边界判断。',
  });
  hierarchicalFlow.firstTrace = String(trace.sourceRef);
  await toolValue(classroom, 'first-complete', {
    action: 'complete',
    blockId: 'block-001',
  });
  await toolValue(classroom, 'reflection-activate', {
    action: 'activate',
    blockId: 'block-002',
  });
  await toolValue(classroom, 'reflection-complete', {
    action: 'complete',
    blockId: 'block-002',
  });
  const lesson = readPlanWorkspace(root, hierarchicalPlanId()).lessons.find(
    (item) => item.id === lessonId,
  );
  if (!lesson?.tutorSessionId) throw new Error('FIRST_LESSON_SESSION_REQUIRED');
  await toolValue(
    createLessonCloseTool(root, lessonPath, {
      sessionId: lesson.tutorSessionId,
      sessionEntries: () => [],
      now: () => new Date('2026-07-31T10:25:00.000Z'),
    }),
    'close-first',
    {
      summary: '第一课完成一次独立跨结构判断。',
      handoff: {
        learnerClaims: [{
          statement: '学生在第一课独立写出并使用了全部合法域。',
          scope: '本课的一次未见结构。',
          sources: [hierarchicalFlow.firstTrace],
          boundary: '仍需核查记录更正与下一课迁移。',
          nextUse: '下一课先检查这条记录是否仍然有效。',
        }],
        teachingClaims: [],
        openQuestions: [],
      },
    },
  );
  hierarchicalFlow.firstClaim =
    `claim:${lessonId}/handoff#learner-c1`;
  fixtureHistory.set(`tutor:${lessonId}`, [{
    kind: 'message',
    message: {
      id: 'hierarchical-first-close',
      role: 'tutor',
      text: '第一课已经结束，可以回到学习顾问复盘。',
      complete: true,
    },
  }]);
  hub.publish({
    type: 'snapshot',
    workspace: readPlanWorkspace(root, hierarchicalPlanId()),
  });
  return structuredClone(hierarchicalFlow);
}

async function supersedeFirstHierarchicalTrace(): Promise<HierarchicalFlowState> {
  const active = hierarchicalFlow.firstTrace?.replace(/^trace:/, '');
  if (!active) throw new Error('FIRST_TRACE_REQUIRED');
  const replacement = appendTrace(root, {
    lessonPath: hierarchicalLessonPath('first'),
    blockId: 'block-001',
    cardAlias: 'Q-HIER-1',
    cardStepId: null,
    materialPath: null,
    assessment: 'partially_correct',
    support: 'none',
    note: '复核后发现边界说明仍缺一个条件；原独立完成结论被更正。',
    supersedes: active,
  }, () => new Date('2026-07-31T10:30:00.000Z'));
  hierarchicalFlow.replacementTrace = replacement.sourceRef;
  await prepareSecondHierarchicalLesson();
  return structuredClone(hierarchicalFlow);
}

async function closeSecondHierarchicalLesson(): Promise<HierarchicalFlowState> {
  const lessonId = hierarchicalLessonId('second');
  const lessonPath = hierarchicalLessonPath('second');
  const classroom = createClassroomUpdateTool(root, lessonPath);
  await toolValue(classroom, 'second-activate', {
    action: 'activate',
    blockId: 'block-001',
  });
  await toolValue(classroom, 'second-complete', {
    action: 'complete',
    blockId: 'block-001',
  });
  const lesson = readPlanWorkspace(root, hierarchicalPlanId()).lessons.find(
    (item) => item.id === lessonId,
  );
  if (!lesson?.tutorSessionId) throw new Error('SECOND_LESSON_SESSION_REQUIRED');
  const value = await toolValue(
    createLessonCloseTool(root, lessonPath, {
      sessionId: lesson.tutorSessionId,
      sessionEntries: () => [],
      now: () => new Date('2026-07-31T10:40:00.000Z'),
    }),
    'close-second',
    {
      summary: '本课完成记录复核，但没有形成新的能力结论。',
    },
  );
  hierarchicalFlow.sourceOnlyClosed = (
    value.handoff as { mode?: string } | undefined
  )?.mode === 'source-only';
  fixtureHistory.set(`tutor:${lessonId}`, [{
    kind: 'message',
    message: {
      id: 'hierarchical-second-close',
      role: 'tutor',
      text: '第二课按你的选择结束，没有强行生成新的能力结论。',
      complete: true,
    },
  }]);
  return structuredClone(hierarchicalFlow);
}

async function completeHierarchicalPlanAndProposeMemory(): Promise<HierarchicalFlowState> {
  if (
    !hierarchicalFlow.firstClaim
    || !hierarchicalFlow.replacementTrace
  ) {
    throw new Error('HIERARCHICAL_COMPLETION_SOURCES_REQUIRED');
  }
  const review = renderLearningReview({
    conclusion: '本周期完成了跨结构判断，并保留了更正后的真实边界。',
    boundary: '两节短课；第一课的原始结论后来被更正。',
    nextStep: '下一周期再检查更陌生的结构。',
    keyEvidence: [{
      claim: '更正后的课堂记录仍保留了合法域判断的有效部分。',
      source: hierarchicalFlow.replacementTrace,
    }],
    supportingEvidence: [{
      claim: '第一课曾封存一条更强的阶段认识。',
      source: hierarchicalFlow.firstClaim,
      limitation: '底层记录后来被更正，只用于说明证据演进。',
    }],
    openQuestions: [{
      question: '更陌生结构中能否再次独立完成？',
      nextCheck: '下一 Plan 使用新的结构外壳。',
    }],
  });
  await toolValue(
    createPlanUpdateTool(
      root,
      hierarchicalPlanPath(),
      { now: () => new Date('2026-07-31T10:45:00.000Z') },
    ),
    'complete-hierarchical-plan',
    {
      decision: 'complete',
      currentPosition: '本周期已经完成。',
      planSummary: review,
      candidateChanges: [],
      handoff: {
        learnerClaims: [{
          statement: '学生保留了跨结构判断能力，但结论必须采用更正后的边界。',
          scope: '本周期两节课。',
          sources: [hierarchicalFlow.replacementTrace],
          boundary: '尚未覆盖更陌生的嵌套结构。',
          nextUse: '下一 Plan 使用不同结构继续核验。',
        }],
        teachingClaims: [],
        openQuestions: [],
      },
    },
  );
  const planClaim =
    `claim:${hierarchicalPlanId()}/handoff#learner-c1`;
  const proposed = await toolValue(
    createMemoryReviewProposeTool(
      root,
      hierarchicalPlanId(),
      hierarchicalPlanPath(),
      hierarchicalMemory,
      () => 'hierarchical-memory-review',
    ),
    'propose-hierarchical-memory',
    {
      items: [{
        id: 'hierarchical-preference',
        operation: 'add',
        owner: 'student',
        currentId: null,
        currentText: null,
        proposedText: '先保留原始判断，再根据后续核验收窄结论。',
        sources: [planClaim],
        rationale: '本周期真实发生了证据更正并被学生接受。',
        counterEvidence: '只有一个周期，适用范围仍需保持狭窄。',
        scope: '需要多轮核验的专题训练。',
      }],
    },
  );
  hierarchicalFlow.memoryReviewId = String(proposed.reviewId);
  hub.publish({
    type: 'snapshot',
    workspace: readPlanWorkspace(root, hierarchicalPlanId()),
  });
  return structuredClone(hierarchicalFlow);
}

async function writeHierarchicalRoadmapCheckpoint(): Promise<HierarchicalFlowState> {
  const value = await toolValue(
    createRoadmapUpdateTool(root, {
      now: () => new Date('2026-07-31T10:50:00.000Z'),
    }),
    'hierarchical-roadmap-checkpoint',
    {
      candidateChanges: [],
      checkpoint: {
        learnerClaims: [{
          statement: '跨结构判断周期已经结束，并采用更正后的边界。',
          scope: '当前 Roadmap。',
          sources: [
            `claim:${hierarchicalPlanId()}/handoff#learner-c1`,
          ],
          boundary: '尚未覆盖更陌生结构。',
          nextUse: '下一 Plan 继续核验。',
        }],
        teachingClaims: [],
        openQuestions: [],
      },
    },
  );
  hierarchicalFlow.checkpointId = String(
    (value.checkpoint as { id?: string }).id,
  );
  hub.publish({
    type: 'learning-set',
    value: readLearningSet(root),
  });
  return structuredClone(hierarchicalFlow);
}

async function checkHierarchicalParentAuthority(): Promise<{
  roadmap: string;
  plan: string;
}> {
  const candidate = {
    publicPurpose: '不应改写。',
    after: null,
    dependsOn: [],
    considerWhen: '不应发生。',
    sources: ['trace:trace-fixture-002'],
    privateNote: '不应写入。',
  };
  let roadmap = '';
  let plan = '';
  try {
    await toolValue(createRoadmapUpdateTool(root), 'illegal-roadmap-revise', {
      candidateChanges: [{
        action: 'revise',
        handle: 'plan-candidate-002',
        candidate,
      }],
    });
  } catch (error) {
    roadmap = error instanceof Error ? error.message : String(error);
  }
  try {
    await toolValue(
      createPlanUpdateTool(root, hierarchicalPlanPath()),
      'illegal-plan-revise',
      {
        decision: 'active',
        currentPosition: '不应写入。',
        planSummary: '不应写入。',
        candidateChanges: [{
          action: 'revise',
          handle: 'lesson-candidate-001',
          candidate,
        }],
      },
    );
  } catch (error) {
    plan = error instanceof Error ? error.message : String(error);
  }
  return { roadmap, plan };
}

async function registerFixturePlan(): Promise<{ planId: string }> {
  if (registeredPlanId !== null) {
    const existing = readLearningSet(root).plans.find(
      (plan) => plan.id === registeredPlanId,
    );
    if (existing) return { planId: registeredPlanId };
    registeredPlanId = null;
  }

  const update = await toolValue(
    createRoadmapUpdateTool(root),
    'fixture-register-plan-candidate',
    {
      candidateChanges: [{
        action: 'add',
        candidate: {
          publicPurpose: '识别陌生外壳中的同构结构。',
          after: 'plan-candidate-001',
          dependsOn: [],
          considerWhen: '学生准备进入另一个独立学习周期。',
          sources: ['trace:trace-fixture-002'],
          privateNote: 'E2E fixture：只验证学生主动切换 Plan。',
        },
      }],
    },
  );
  const handles = update.candidateHandles;
  if (!Array.isArray(handles) || typeof handles.at(-1) !== 'string') {
    throw new Error('FIXTURE_PLAN_CANDIDATE_REQUIRED');
  }
  const prepared = await toolValue(
    createPlanPrepareTool(root),
    'fixture-register-plan',
    {
      candidateHandle: handles.at(-1),
      blueprint: {
        title: '同构变形',
        publicPurpose: '识别陌生外壳中的同构结构。',
        goal: '识别同构结构。',
        capabilityStandard: '在陌生外壳中独立说明同构结构。',
        test: '完成一张未见题的首次尝试。',
        planningBasis: '当前测试需要第二个完整、可切换的 Plan。',
        activation: {
          parentSources: ['trace:trace-fixture-002'],
          selectedMemory: [],
          contentBoundary: ['不在公开 Plan 中写入私有备课路线。'],
          adaptation: {
            workingJudgment: '需要验证多个 Plan 由学生主动切换。',
            sources: ['trace:trace-fixture-002'],
            designConsequence: '保留独立 Plan Session，不自动跳转。',
            reviseIf: '学生没有选择进入这个 Plan。',
          },
        },
      },
    },
  );
  registeredPlanId = String(prepared.factId);
  await hierarchicalActivation.activatePlan(registeredPlanId);
  fixtureHistory.set(`coach:${registeredPlanId}`, [{
    kind: 'message',
    message: {
      id: 'fixture-isomorphic-plan-message',
      role: 'coach',
      text: '这个学习周期用于验证学生主动切换 Plan。',
      complete: true,
    },
  }]);
  return { planId: registeredPlanId };
}

async function completeFixturePlan(): Promise<{ planId: string }> {
  const { planId } = await registerFixturePlan();
  const plan = readLearningSet(root).plans.find((item) => item.id === planId);
  if (!plan) throw new Error(`PLAN_NOT_FOUND: ${planId}`);
  if (plan.status !== 'completed') {
    const updated = await toolValue(
      createPlanUpdateTool(root, plan.path),
      'fixture-add-isomorphic-lesson',
      {
        decision: 'active',
        currentPosition: '准备一节最小评估课。',
        planSummary: '尚未形成课堂结论。',
        candidateChanges: [{
          action: 'add',
          candidate: {
            publicPurpose: '完成一次同构结构判断。',
            after: null,
            dependsOn: [],
            considerWhen: '学生进入这个测试 Plan。',
            sources: ['trace:trace-fixture-002'],
            privateNote: 'E2E fixture：形成一条本 Plan 自有来源。',
          },
        }],
      },
    );
    const handles = updated.candidateHandles;
    if (!Array.isArray(handles) || typeof handles.at(-1) !== 'string') {
      throw new Error('FIXTURE_PLAN_LESSON_CANDIDATE_REQUIRED');
    }
    const prepared = await toolValue(
      createLessonPrepareTool(root, planId, plan.path),
      'fixture-prepare-isomorphic-lesson',
      {
        candidateHandle: handles.at(-1),
        blueprint: {
          title: '同构结构最小评估',
          publicPurpose: '完成一次同构结构判断。',
          capabilityTarget: '独立指出陌生外壳中的同构关系。',
          primaryTemplate: 'assessment',
          templateReason: '为 Plan 完成态建立一条真实、可回溯的来源。',
          adjustments: [],
          activation: {
            parentSources: ['trace:trace-fixture-002'],
            selectedMemory: [],
            contentBoundary: ['不公开内部路由说明。'],
            adaptation: {
              workingJudgment: '只需要一条本 Plan 自有的最小评估记录。',
              sources: ['trace:trace-fixture-002'],
              designConsequence: '完成一个独立问题 Block 后结束。',
              reviseIf: '学生选择不进入本 Plan。',
            },
          },
          cards: [{
            alias: 'Q-ISOMORPHIC',
            cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
            role: '最小评估来源',
          }],
          sources: [],
          blocks: [{
            localAlias: 'assessment',
            kind: 'problem',
            required: true,
            dependsOn: [],
            uses: ['Q-ISOMORPHIC'],
            studentView: '独立说明这道题中的同构结构。',
            teacherControl: '只记录首次判断。',
          }],
        },
      },
    );
    const lessonId = String(prepared.factId);
    const lessonPath = String(prepared.lessonPath);
    await hierarchicalActivation.activateLesson(lessonId);
    const classroom = createClassroomUpdateTool(root, lessonPath);
    await toolValue(classroom, 'fixture-isomorphic-block-active', {
      action: 'activate',
      blockId: 'block-001',
    });
    const trace = appendTrace(root, {
      lessonPath,
      blockId: 'block-001',
      cardAlias: 'Q-ISOMORPHIC',
      cardStepId: null,
      materialPath: null,
      assessment: 'correct',
      support: 'none',
      note: '学生无提示独立完成测试评估。',
      supersedes: null,
    }, () => new Date('2026-07-29T08:05:00.000Z'));
    await toolValue(classroom, 'fixture-isomorphic-block-complete', {
      action: 'complete',
      blockId: 'block-001',
    });
    const lesson = readPlanWorkspace(root, planId).lessons.find(
      (item) => item.id === lessonId,
    );
    if (!lesson?.tutorSessionId) {
      throw new Error('FIXTURE_PLAN_LESSON_SESSION_REQUIRED');
    }
    await toolValue(
      createLessonCloseTool(root, lessonPath, {
        sessionId: lesson.tutorSessionId,
        sessionEntries: () => [],
        now: () => new Date('2026-07-29T08:10:00.000Z'),
      }),
      'fixture-close-isomorphic-lesson',
      {
        summary: '学生完成一次同构结构判断。',
        handoff: {
          learnerClaims: [{
            statement: '学生无提示完成一次同构结构判断。',
            scope: '本测试 Lesson。',
            sources: [trace.sourceRef],
            boundary: '只用于路由 E2E，不代表稳定能力。',
            nextUse: '完成当前测试 Plan。',
          }],
          teachingClaims: [],
          openQuestions: [],
        },
      },
    );
    await toolValue(
      createPlanUpdateTool(
        root,
        plan.path,
        { now: () => new Date('2026-07-29T08:00:00.000Z') },
      ),
      'fixture-complete-plan',
      {
        decision: 'complete',
        currentPosition: '本测试周期已完成。',
        planSummary: renderLearningReview({
          conclusion: '已完成测试 Plan。',
          boundary: '只用于 E2E 路由验收，不代表真实能力结论。',
          nextStep: '由学生选择其他 Plan。',
          keyEvidence: [{
            claim: '完成一条本 Plan 自有的最小评估记录。',
            source: trace.sourceRef,
          }],
          supportingEvidence: [],
          openQuestions: [],
        }),
        candidateChanges: [],
        handoff: {
          learnerClaims: [{
            statement: '当前测试 Plan 已完成。',
            scope: '本测试 Plan。',
            sources: [`claim:${lessonId}/handoff#learner-c1`],
            boundary: '只验证 Plan 切换与来源链。',
            nextUse: '由学生选择其他 Plan。',
          }],
          teachingClaims: [],
          openQuestions: [],
        },
      },
    );
  }
  hub.publish({
    type: 'learning-set',
    value: readLearningSet(root),
  });
  return { planId };
}

function list(key: SessionKey): WorkflowSnapshot[] {
  return structuredClone(workflows.get(key) ?? []);
}

function fixtureConversation(key: SessionKey): ConversationItem[] {
  if (
    hierarchicalFlow.planId
    && key === `coach:${hierarchicalFlow.planId}`
  ) {
    const review = hierarchicalMemory.latest();
    return [
      {
        kind: 'message',
        message: {
          id: 'hierarchical-plan-message',
          role: 'coach',
          text: review
            ? '本周期已完成，请逐条确认这次形成的长期记忆候选。'
            : '这个 Plan 只读取自己的 Lesson Handoff 和当前周期记录。',
          complete: true,
        },
      },
      ...(review ? [{ kind: 'memory-review' as const, review }] : []),
    ];
  }
  return structuredClone(fixtureHistory.get(key) ?? []);
}

function notify(key: SessionKey, snapshot: WorkflowSnapshot): void {
  for (const listener of workflowListeners.get(key) ?? []) listener(structuredClone(snapshot));
}

const registry = {
  roadmapSnapshot: () => readRoadmapWorkspace(root),
  snapshot: (planId = selectedPlanId) => readPlanWorkspace(root, planId),
  history: (key: SessionKey) => fixtureConversation(key),
  readHistory: async (key: SessionKey) => fixtureConversation(key),
  replayHistory: async (lessonId: string) => (
    structuredClone(fixtureHistory.get(`tutor:${lessonId}` as SessionKey) ?? [])
  ),
  memoryReview: async (key: SessionKey) => {
    if (
      hierarchicalFlow.planId
      && key === `coach:${hierarchicalFlow.planId}`
    ) {
      return structuredClone(hierarchicalMemory.latest());
    }
    return key === coachKey ? structuredClone(currentMemoryReview) : null;
  },
  submitMemoryReview: async (
    key: SessionKey,
    reviewId: string,
    decisions: MemoryReviewDecision[],
  ) => {
    if (
      hierarchicalFlow.planId
      && key === `coach:${hierarchicalFlow.planId}`
    ) {
      const submitted = submittedMemoryReview(
        hierarchicalMemory.latest(),
        reviewId,
        decisions,
      );
      hierarchicalMemory.save(submitted);
      applyMemoryReview(
        root,
        hierarchicalFlow.planId,
        `plans/${hierarchicalFlow.planId}.md`,
        hierarchicalMemory,
        reviewId,
      );
      for (const listener of sessionListeners.get(key) ?? []) {
        listener({ type: 'agent_end', messages: [], willRetry: false });
      }
      return structuredClone(hierarchicalMemory.latest()!);
    }
    if (key !== coachKey || reviewId !== currentMemoryReview.id) {
      throw new Error('MEMORY_REVIEW_NOT_FOUND');
    }
    currentMemoryReview = {
      ...currentMemoryReview,
      status: 'submitted',
      decisions: structuredClone(decisions),
    };
    fixtureHistory.set(coachKey, (fixtureHistory.get(coachKey) ?? []).map((item) => (
      item.kind === 'memory-review' && item.review.id === reviewId
        ? { kind: 'memory-review', review: currentMemoryReview }
        : item
    )));
    for (const listener of sessionListeners.get(key) ?? []) {
      listener({ type: 'agent_end', messages: [], willRetry: false });
    }
    return structuredClone(currentMemoryReview);
  },
  subscribe: (key: SessionKey, listener: (event: unknown) => void) => {
    const current = sessionListeners.get(key) ?? new Set();
    current.add(listener);
    sessionListeners.set(key, current);
    return () => current.delete(listener);
  },
  subscribeWorkflows: (
    key: SessionKey,
    listener: (snapshot: WorkflowSnapshot) => void,
  ) => {
    const current = workflowListeners.get(key) ?? new Set();
    current.add(listener);
    workflowListeners.set(key, current);
    return () => current.delete(listener);
  },
  personaId: (key: SessionKey) => personaSelections.get(key) ?? resolvePersona(root).id,
  setPersona: async (key: SessionKey, id: string) => {
    resolvePersona(root, id);
    personaSelections.set(key, id);
  },
  openSession: async (key: SessionKey) => ({
    sessionId: key === roadmapKey ? 'fixture-roadmap-coach' : `fixture-${key}`,
  }),
  get: (key: SessionKey) => hierarchicalSessions.get(key),
  setDeepMode: async (key: SessionKey, enabled: boolean) => { deepMode.set(key, enabled); },
  deepMode: async (key: SessionKey) => deepMode.get(key) ?? false,
  workflows: async (key: SessionKey) => list(key),
  confirmWorkflow: async (key: SessionKey, id: string) => {
    const snapshot = workflows.get(key)?.find((item) => item.id === id);
    if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
    snapshot.status = 'running';
    notify(key, snapshot);
    await Promise.resolve();
    for (const item of snapshot.tasks) {
      item.status = 'completed';
      item.runId = `run-${item.id}`;
      item.tokens = 200;
      item.durationMs = 100;
      item.result = {
        findings: [`private ${item.id} finding`],
        evidence_refs: [`cards/${item.id}.card.yaml`],
        recommended_action: `private ${item.id} action`,
        risks: [],
      };
    }
    snapshot.status = 'completed';
    notify(key, snapshot);
    return structuredClone(snapshot);
  },
  cancelWorkflow: async (key: SessionKey, id: string) => {
    const snapshot = workflows.get(key)?.find((item) => item.id === id);
    if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
    snapshot.status = 'cancelled';
    for (const item of snapshot.tasks) {
      if (item.status === 'queued' || item.status === 'running') item.status = 'cancelled';
    }
    notify(key, snapshot);
  },
  startPlan: async (planId: string) => {
    const receipt = await hierarchicalActivation.activatePlan(planId);
    selectedPlanId = planId;
    const activePlans = readLearningSet(root).plans.filter(
      (plan) => plan.status === 'active',
    );
    if (activePlans.length > 1) {
      hierarchicalFlow.parallelPlansObserved = true;
    }
    return receipt;
  },
  startLesson: async (lessonId: string) => {
    if (
      lessonId === hierarchicalFlow.firstLessonId
      || lessonId === hierarchicalFlow.secondLessonId
    ) {
      const receipt = await hierarchicalActivation.activateLesson(lessonId);
      selectedPlanId = hierarchicalPlanId();
      return { shouldKickoff: receipt.shouldKickoff };
    }
    if (rejectNextLessonStart) {
      rejectNextLessonStart = false;
      throw new PreparedLessonValidationError([{
        code: 'LESSON_ALIAS_MISSING',
        message: 'Block assessment-01 的 Uses 缺少 alias：Q-MISSING',
      }]);
    }
    const lesson = readPlanWorkspace(root, 'domain-integrity').lessons
      .find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    setFrontmatterField(root, lesson.path, 'status', 'active');
    const orientation = lesson.blocks.find((block) => block.id === 'orientation');
    const firstProblem = lesson.blocks.find((block) => block.kind === 'problem');
    if (orientation) setBlockStatus(root, lesson.path, orientation.id, 'completed');
    if (firstProblem) setBlockStatus(root, lesson.path, firstProblem.id, 'active');
    return { shouldKickoff: true };
  },
  triggerLessonStart: async () => {},
  pauseLesson: async (lessonId: string) => {
    const lesson = readPlanWorkspace(root, 'domain-integrity').lessons
      .find((item) => item.id === lessonId);
    if (!lesson) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    setFrontmatterField(root, lesson.path, 'status', 'paused');
  },
  abandonForReprepare: async () => {},
  send: async (key: SessionKey) => {
    if (!key.startsWith('tutor:')) return;
    for (const listener of sessionListeners.get(key) ?? []) {
      listener({
        type: 'tool_execution_end',
        toolName: 'trace_append',
        isError: false,
      });
    }
  },
};
const clients = new Set<{ send(data: string): void }>();
hub.subscribe((event) => {
  const data = JSON.stringify(event);
  for (const client of clients) client.send(data);
});
const appFetch = createRequestHandler({
  root,
  authoring: false,
  registry: registry as never,
  hub,
  readAbilityProjection: () => abilityProjection,
});

function resetFixtureTraces(): void {
  rmSync(join(root, 'traces'), { recursive: true, force: true });
  cpSync(join(sourceRoot, 'traces'), join(root, 'traces'), { recursive: true });
}

async function createPanelFlowFixture(): Promise<void> {
  writeFileSync(planPath, planBaseline);
  writeFileSync(lesson003Path, lesson003Baseline);
  rmSync(join(root, 'lessons/lesson-004.md'), { force: true });
  resetFixtureTraces();

  const updated = await toolValue(
    createPlanUpdateTool(root, 'plans/domain-integrity.md'),
    'fixture-panel-add-lesson',
    {
      decision: 'active',
      currentPosition: [
        '阶段 `1a` 已通过。',
        'Lesson 004 正在进行连续性核验。',
      ].join('\n'),
      planSummary: '当前只验证学生视图、课堂状态与来源回看。',
      candidateChanges: [{
        action: 'add',
        candidate: {
          publicPurpose: '继续完成定义域与边界的独立核验。',
          after: 'lesson-candidate-003',
          dependsOn: [],
          considerWhen: '需要验证当前课堂面板。',
          sources: ['trace:trace-fixture-002'],
          privateNote: 'E2E fixture：未来课堂内容不得提前投影。',
        },
      }],
    },
  );
  const handles = updated.candidateHandles;
  if (!Array.isArray(handles) || typeof handles.at(-1) !== 'string') {
    throw new Error('FIXTURE_LESSON_CANDIDATE_REQUIRED');
  }
  const prepared = await toolValue(
    createLessonPrepareTool(
      root,
      'domain-integrity',
      'plans/domain-integrity.md',
    ),
    'fixture-panel-prepare-lesson',
    {
      candidateHandle: handles.at(-1),
      blueprint: {
        title: 'Lesson 004：正在进行的连续性核验',
        publicPurpose: '继续完成定义域与边界的独立核验。',
        capabilityTarget: '独立写出并使用全部合法域。',
        primaryTemplate: 'assessment',
        templateReason: '验证当前课堂、资料回看和会话恢复。',
        adjustments: [],
        activation: {
          parentSources: ['trace:trace-fixture-002'],
          selectedMemory: [],
          contentBoundary: ['只公开当前 Block，不投影未来课堂内容。'],
          adaptation: {
            workingJudgment: '需要一节稳定、可恢复的当前课堂。',
            sources: ['trace:trace-fixture-002'],
            designConsequence: '只激活一张题卡并保留来源链。',
            reviseIf: '学生选择返回学习顾问。',
          },
        },
        cards: [{
          alias: 'Q-DOMAIN-EX22',
          cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
          role: '当前独立核验',
        }],
        sources: [],
        blocks: [{
          localAlias: 'assessment',
          kind: 'problem',
          required: true,
          dependsOn: [],
          uses: ['Q-DOMAIN-EX22'],
          studentView: '请独立完成当前核验题。',
          teacherControl: '只呈现当前题卡，不公开后续内容。',
        }, {
          localAlias: 'reflection',
          kind: 'reflection',
          required: false,
          dependsOn: ['assessment'],
          uses: [],
          studentView: '需要时再回看这次判断。',
          teacherControl: '只总结学生已经产生的内容。',
        }],
      },
    },
  );
  const lessonId = String(prepared.factId);
  const lessonPath = String(prepared.lessonPath);
  if (lessonId !== 'lesson-004' || lessonPath !== 'lessons/lesson-004.md') {
    throw new Error(`FIXTURE_LESSON_ID_UNEXPECTED: ${lessonId}`);
  }
  setFrontmatterField(root, lessonPath, 'status', 'active');
  setFrontmatterField(
    root,
    lessonPath,
    'tutor_session',
    'session-panel-lesson-004',
  );
  writeFileSync(
    join(root, lessonPath),
    readFileSync(join(root, lessonPath), 'utf8').replace(
      '- Activated at: pending',
      '- Activated at: 2026-07-28T08:00:00.000Z',
    ),
  );
  setBlockStatus(root, lessonPath, 'block-001', 'active');

  const first = appendTrace(root, {
    lessonPath,
    blockId: 'block-001',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: 'step_2',
    materialPath: null,
    assessment: 'incomplete',
    support: 'tutor',
    note: 'unique-superseded-term：旧判断，等待学生补充。',
    supersedes: null,
    methods: { primary: '同构变形与换元法', secondary: ['参变量分离'] },
  }, () => new Date('2026-07-28T08:00:00Z'));
  appendTrace(root, {
    lessonPath,
    blockId: 'block-001',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: 'step_2',
    materialPath: null,
    assessment: 'partially_correct',
    support: 'none',
    note: 'unique-active-term：已独立写出定义域，参数边界仍需核验。',
    supersedes: first.traceId,
    methods: { primary: '同构变形与换元法', secondary: ['参变量分离'] },
  }, () => new Date('2026-07-28T08:01:00Z'));

  mkdirSync(join(root, 'materials'), { recursive: true });
  writeFileSync(
    join(root, 'materials/panel-flow-note.md'),
    '# 公开研习材料\n\npanel-material-term：只包含学生可见的复习说明。',
  );
  mkdirSync(join(root, '.claude/personas'), { recursive: true });
  writeFileSync(join(root, '.claude/personas/custom-guide.md'), `# Custom Guide

- ID: \`custom-guide\`
- Display name: 青黛学伴
- Student preview: 温和而利落，先听清你的路线再回应。
- Glyph: 黛
- Accent: #48636f

- INTERNAL: this line is prompt-only
`);
}

function resetPanelFlowFixture(): void {
  writeFileSync(planPath, planBaseline);
  writeFileSync(lesson003Path, lesson003Baseline);
  rmSync(join(root, 'lessons/lesson-004.md'), { force: true });
  resetFixtureTraces();
  rmSync(join(root, 'materials/panel-flow-note.md'), { force: true });
  rmSync(join(root, '.claude/personas/custom-guide.md'), { force: true });
  fixtureHistory.delete('tutor:lesson-004');
  personaSelections.clear();
}

function createStudentSafeFlowFixture(): void {
  writeFileSync(roadmapPath, roadmapBaseline);
  writeFileSync(planPath, planBaseline);
  writeFileSync(
    lesson003Path,
    lesson003Baseline.replace(
      '# Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验',
      '# 绝密参数边界综合题',
    ),
  );
  currentMemoryReview = proposedMemoryReview;
  fixtureHistory.set(coachKey, safePreparationHistory());
  fixtureHistory.delete('tutor:lesson-003');
  rejectNextLessonStart = false;
}

function completeStudentSafeFlowFixture(): {
  keySource: string;
  supportingSource: string;
} {
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-001', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-002', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-003', 'skipped');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-004', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-005', 'completed');
  const key = appendTrace(root, {
    lessonPath: 'lessons/lesson-003.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: 'step_2',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '独立完成定义域与参数边界判断。',
    supersedes: null,
  }, () => new Date('2026-07-29T09:10:00Z'));
  const supporting = appendTrace(root, {
    lessonPath: 'lessons/lesson-003.md',
    blockId: 'block-004',
    cardAlias: 'Q-DOMAIN-EX16',
    cardStepId: 'step_1',
    materialPath: null,
    assessment: 'correct',
    support: 'tutor',
    note: '在一次方向性提示后完成跨结构迁移。',
    supersedes: null,
  }, () => new Date('2026-07-29T09:11:00Z'));
  closeLesson(root, 'lessons/lesson-003.md', {
    summary: '完成两道参数边界题；第一题独立完成，第二题使用一次方向性提示。',
  });
  updateFixturePlan('plans/domain-integrity.md', {
    currentPosition: '本周期核验已经完成。',
    learningReview: {
      conclusion: '已经能独立把定义域用于参数边界判断。',
      boundary: '两道本周期导数题；尚未覆盖长期保持和更陌生的嵌套结构。',
      nextStep: '下一周期再检查陌生嵌套结构。',
      keyEvidence: [{
        claim: '第一道评估题无提示完成定义域与参数边界判断。',
        source: key.sourceRef,
      }],
      supportingEvidence: [{
        claim: '第二道不同结构题最终完成了迁移。',
        source: supporting.sourceRef,
        limitation: '使用过一次方向性提示，只作为参考。',
      }],
      openQuestions: [{
        question: '换成更陌生的嵌套结构后还能否保持独立？',
        nextCheck: '下一 Plan 安排一题未见嵌套约束题。',
      }],
    },
  });
  currentMemoryReview = appliedMemoryReview;
  fixtureHistory.set(coachKey, [
    ...safePreparationHistory(),
    { kind: 'memory-review', review: currentMemoryReview },
  ]);
  fixtureHistory.set('tutor:lesson-003', [{
    kind: 'message',
    message: {
      id: 'fixture-student-safe-close',
      role: 'tutor',
      text: '这节课已经收好，回到学习顾问可以查看带来源的阶段回顾。',
      complete: true,
    },
  }]);
  hub.publish({
    type: 'snapshot',
    workspace: readPlanWorkspace(root, 'domain-integrity'),
  });
  return {
    keySource: key.sourceRef,
    supportingSource: supporting.sourceRef,
  };
}

function resetStudentSafeFlowFixture(): void {
  writeFileSync(roadmapPath, roadmapBaseline);
  writeFileSync(planPath, planBaseline);
  writeFileSync(lesson003Path, lesson003Baseline);
  currentMemoryReview = proposedMemoryReview;
  fixtureHistory.set(coachKey, structuredClone(coachHistoryBaseline));
  fixtureHistory.delete('tutor:lesson-003');
  rejectNextLessonStart = false;
}

Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.STUDYFORGE_E2E_API_PORT ?? 65000),
  async fetch(request, server) {
    const url = new URL(request.url);
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/reset'
    ) {
      resetHierarchicalFlow();
      return Response.json(hierarchicalFlow);
    }
    if (
      request.method === 'GET'
      && url.pathname === '/__test/hierarchical-flow/state'
    ) {
      return Response.json(hierarchicalFlow);
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/add-plan-candidate'
    ) {
      return Response.json(await addHierarchicalPlanCandidate());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/prepare-plan'
    ) {
      return Response.json(await prepareHierarchicalPlan());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/add-lesson-candidates'
    ) {
      return Response.json(await addHierarchicalLessonCandidates());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/prepare-first-lesson'
    ) {
      return Response.json(await prepareFirstHierarchicalLesson());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/prepare-second-lesson'
    ) {
      return Response.json(await prepareSecondHierarchicalLesson());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/check-parent-authority'
    ) {
      return Response.json(await checkHierarchicalParentAuthority());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/complete-first-lesson'
    ) {
      return Response.json(await completeFirstHierarchicalLesson());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/supersede-first-trace'
    ) {
      return Response.json(await supersedeFirstHierarchicalTrace());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/close-second-source-only'
    ) {
      return Response.json(await closeSecondHierarchicalLesson());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/complete-plan-and-propose-memory'
    ) {
      return Response.json(await completeHierarchicalPlanAndProposeMemory());
    }
    if (
      request.method === 'POST'
      && url.pathname === '/__test/hierarchical-flow/write-roadmap-checkpoint'
    ) {
      return Response.json(await writeHierarchicalRoadmapCheckpoint());
    }
    if (request.method === 'POST' && url.pathname === '/__test/panel-flow/start') {
      await createPanelFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/panel-flow/reset') {
      resetPanelFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/student-safe-flow/start') {
      createStudentSafeFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/student-safe-flow/complete') {
      return Response.json(completeStudentSafeFlowFixture());
    }
    if (request.method === 'GET' && url.pathname === '/__test/student-safe-flow/raw-history') {
      return Response.json(projectConversationEntries(
        coachKey,
        rawPreparationEntries,
        'raw-stream',
      ));
    }
    if (request.method === 'POST' && url.pathname === '/__test/student-safe-flow/reset') {
      resetStudentSafeFlowFixture();
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/register-plan') {
      return Response.json(await registerFixturePlan());
    }
    if (request.method === 'POST' && url.pathname === '/__test/complete-isomorphic-plan') {
      return Response.json(await completeFixturePlan());
    }
    if (request.method === 'POST' && url.pathname === '/__test/reject-next-lesson-start') {
      setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'prepared');
      rejectNextLessonStart = true;
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/close-lesson') {
      closeLesson(root, 'lessons/lesson-003.md', {
        summary: '完成第一项核验；第二项尚未进行。来源：#trace-event-001。',
      });
      const message: ChatMessage = {
        id: 'fixture-close-message',
        role: 'tutor',
        text: '这节课先停在这里。第一项已完成，第二项留到下次。',
        complete: true,
      };
      fixtureHistory.set('tutor:lesson-003', [{ kind: 'message', message }]);
      hub.publish({
        type: 'message',
        sessionKey: 'tutor:lesson-003',
        message,
      });
      hub.publish({
        type: 'snapshot',
        workspace: readPlanWorkspace(root, 'domain-integrity'),
      });
      return Response.json({ ok: true });
    }
    if (request.method === 'POST' && url.pathname === '/__test/reset-close-lesson') {
      writeFileSync(lesson003Path, lesson003Baseline);
      fixtureHistory.delete('tutor:lesson-003');
      return Response.json({ ok: true });
    }
    return appFetch(request, server);
  },
  websocket: {
    open(socket) { clients.add(socket); },
    close(socket) { clients.delete(socket); },
    message() {},
  },
});

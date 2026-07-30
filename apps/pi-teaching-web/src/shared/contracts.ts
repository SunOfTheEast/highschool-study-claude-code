import type { MemoryReviewSnapshot } from '../memory-review/contracts';

export type LessonStatus = 'prepared' | 'active' | 'paused' | 'closed' | 'abandoned';
export type NodeLifecycleStatus =
  | 'candidate'
  | 'prepared'
  | 'active'
  | 'paused'
  | 'closed'
  | 'completed'
  | 'abandoned';
export type BlockStatus = 'pending' | 'active' | 'completed' | 'skipped';
export type ActivityKind = 'dialogue' | 'problem' | 'material' | 'reflection';
export type SessionKey = `coach:${string}` | `tutor:${string}`;
export const ROADMAP_COACH_SESSION_KEY = 'coach:@roadmap' as const;

export type ActivityBlock = {
  id: string;
  title: string;
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  evidence: string[];
};

export type LessonNode = {
  id: string;
  title: string;
  path: string;
  planId: string;
  status: LessonStatus;
  sessionKey: SessionKey;
  tutorSessionId: string | null;
  blocks: ActivityBlock[];
};

export type LearningReview = {
  conclusion: string;
  boundary: string;
  nextStep: string;
  keyEvidence: Array<{ claim: string; source: string }>;
  supportingEvidence: Array<{
    claim: string;
    source: string;
    limitation: string;
  }>;
  openQuestions: Array<{ question: string; nextCheck: string }>;
};

export type PlanSummary = {
  id: string;
  title: string;
  path: string;
  status: string;
  goal: string;
  capabilityStandard: string;
  planningBasis: string;
  currentPosition: string;
  planSummary: string;
  learningReview: LearningReview | null;
};

export type PublicTreeEntry = {
  handle: string;
  kind: 'plan' | 'lesson';
  nodeId: string | null;
  path: string | null;
  title: string | null;
  publicPurpose: string;
  after: string | null;
  dependsOn: string[];
  status: NodeLifecycleStatus;
};

export type LearningSetSnapshot = {
  title: string;
  overview: string;
  learningPrinciples: string;
  goal: string;
  planTree: PublicTreeEntry[];
  plans: PlanSummary[];
};

export type RoadmapWorkspaceSnapshot = {
  learningSet: LearningSetSnapshot;
  coach: {
    sessionKey: typeof ROADMAP_COACH_SESSION_KEY;
    sessionId: string | null;
  };
};

export type PlanWorkspaceSnapshot = {
  learningSet: LearningSetSnapshot;
  plan: PlanSummary;
  lessonTree: PublicTreeEntry[];
  coach: { sessionKey: SessionKey; sessionId: string | null };
  lessons: LessonNode[];
};

export type StudentPlanState =
  | 'discussing'
  | 'prepared'
  | 'active'
  | 'paused'
  | 'completed';

export type StudentLessonPreview = {
  lessonId: string;
  status: 'prepared' | 'active' | 'paused';
  publicTitle: string;
  publicPurpose: string | null;
  blockCount: number;
  blockKinds: ActivityKind[];
  sourceNumbers: string[];
};

export type StudentPlanProjection = {
  progress: {
    closedLessons: number;
    registeredLessons: number;
    state: StudentPlanState;
  };
  currentPosition: string;
  nextLesson: StudentLessonPreview | null;
  learningReview: LearningReview | null;
};

export type StudentProblemCard = {
  path: string;
  stem: string;
  choices: Array<{ label: string; text: string }>;
};

export type LearningRecordSummary = {
  source: string;
  lessonId: string;
  blockId: string;
  assessment: string;
  support: string;
  note: string;
};

export type StudentNotebook = {
  lesson: Omit<LessonNode, 'blocks'> & { blocks: ActivityBlock[] };
  cards: Record<string, StudentProblemCard>;
  recentRecords: LearningRecordSummary[];
  lessonSummary: string | null;
  authoring?: { source: string };
};

export type CoachContextView = {
  plan: StudentPlanProjection;
  plannerAttention: string;
  priorLessons: Array<{
    lessonId: string;
    title: string;
    summary: string;
    source: string;
  }>;
};

export type ContentSearchHit = {
  kind: 'card' | 'method' | 'material';
  id: string;
  title: string;
  subtitle: string;
  source: string;
  matchedBy: 'asset' | 'trace';
  matchReason: string;
  traceHistory: LearningRecordSummary[];
  card: StudentProblemCard | null;
  preview: string | null;
};

export type ContentSearchResult = {
  query: string;
  hits: ContentSearchHit[];
};

export type HomeContinueTarget = {
  route: string;
  kind: 'roadmap' | 'coach' | 'lesson';
  planId: string | null;
  lessonId: string | null;
  title: string;
  detail: string;
};

export type HomePlanSummary = Pick<
  PlanSummary,
  'id' | 'title' | 'status' | 'goal' | 'capabilityStandard'
>;

export type HomeLearningSetSnapshot = Omit<LearningSetSnapshot, 'plans'> & {
  plans: HomePlanSummary[];
};

export type HomeSnapshot = {
  learningSet: HomeLearningSetSnapshot;
  currentPlan: HomePlanSummary | null;
  currentLessonTree: PublicTreeEntry[];
  eligibleContinueRoutes: string[];
  continueTarget: HomeContinueTarget;
  lessonProgress: { completed: number; total: number };
  studentPlan: StudentPlanProjection | null;
  signals: Array<{ label: string; value: string; source: string | null }>;
  recentReplay: null | { lessonId: string; title: string; route: string };
};

export type PublicContextPageKind =
  | 'resident'
  | 'frozen'
  | 'current'
  | 'on-demand';

export type PublicContextPage = {
  kind: PublicContextPageKind;
  label: string;
  purpose: string;
  sourceCount: number;
  sources: string[];
};

export type AbilityNode = {
  method: string;
  state: 'unobserved' | 'unstable' | 'steady';
  score: number;
  evidenceCount: number;
  sources: string[];
};

export type AbilityProjection = { nodes: AbilityNode[] };

export type EvidenceState = 'active' | 'invalidated' | 'missing' | 'forbidden';

export type HandoffEvidenceNode = {
  source: string;
  label: string;
  state: EvidenceState;
  children: HandoffEvidenceNode[];
};

export type EvidenceView = {
  kind: 'trace';
  source: string;
  state: EvidenceState;
  trace: {
    lessonId: string;
    blockId: string;
    assessment: string;
    support: string;
    note: string;
  };
  card: null | {
    path: string;
    title: string;
    goal: string;
    methods: Array<{ name: string; role: 'primary' | 'secondary' }>;
  };
} | {
  kind: 'handoff';
  source: string;
  state: EvidenceState;
  node: HandoffEvidenceNode;
};

export type RouteChange = {
  id: string;
  action: 'insert' | 'skip' | 'move' | 'repeat';
  blockId: string;
  before: string | null;
  after: string | null;
  reason: string;
  source: string;
};

export type ReplayItem = {
  id: string;
  kind: 'message' | 'trace' | 'route' | 'image';
  label: string;
  detail: string;
  source: string | null;
};

export type LessonReplay = {
  mode: 'full' | 'evidence-only';
  items: ReplayItem[];
  route: { initial: string[]; effective: string[] };
};

export type PersonaChoice = {
  id: string;
  name: string;
  description: string;
  glyph: string;
  accent: string;
  portraitUrl: string | null;
};

export type PersonaPresentation = {
  id: string;
  choices: PersonaChoice[];
};

export type PresentationPreferences = {
  motion: 'gentle' | 'reduced';
  completionFeedback: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'student' | 'coach' | 'tutor';
  text: string;
  complete: boolean;
};

export type LessonReadyNotice = {
  lessonId: string;
  lessonPath: string;
  publicTitle: string;
  publicPurpose: string | null;
  blockCount: number;
  blockKinds: ActivityKind[];
  sourceNumbers: string[];
};

export type ConversationItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'lesson-ready'; lesson: LessonReadyNotice }
  | { kind: 'memory-review'; review: MemoryReviewSnapshot };

export type WorkflowTaskView = {
  id: string;
  label: string;
  role: string;
  dependsOn: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  sourceCount: number;
  cardCount: number;
  progress: string;
  durationMs: number;
  tokens: number;
  toolCount: number;
  currentActivity: string;
};

export type WorkflowView = {
  id: string;
  goal: string;
  mode: 'quick' | 'deep';
  status: 'proposed' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  tasks: WorkflowTaskView[];
};

export type StudyViewEvent =
  | { type: 'snapshot'; workspace: PlanWorkspaceSnapshot }
  | { type: 'learning-set'; value: LearningSetSnapshot }
  | { type: 'message'; sessionKey: SessionKey; message: ChatMessage }
  | { type: 'message-delta'; sessionKey: SessionKey; messageId: string; delta: string }
  | {
    type: 'conversation-snapshot';
    sessionKey: SessionKey;
    items: ConversationItem[];
  }
  | {
    type: 'session-run';
    sessionKey: SessionKey;
    status: 'running' | 'idle';
    label: string;
  }
  | {
    type: 'phase';
    sessionKey: SessionKey;
    phase: 'planning' | 'preparing' | 'waiting' | 'teaching' | 'paused' | 'reviewing';
  }
  | {
    type: 'work-status';
    sessionKey: SessionKey;
    tool: string;
    status: 'running' | 'done' | 'failed';
    label: string;
  }
  | { type: 'activity'; lessonId: string; block: ActivityBlock }
  | {
    type: 'route-change';
    lessonId: string;
    action: 'insert' | 'skip' | 'move' | 'repeat';
    blockId: string;
    reason: string;
  }
  | {
    type: 'ability-update';
    projection: AbilityProjection;
  }
  | { type: 'workflow'; sessionKey: SessionKey; workflow: WorkflowView }
  | { type: 'session-error'; sessionKey: SessionKey; message: string };

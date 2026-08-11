export const PLAN_STATUSES = ['prepared', 'active', 'completed'] as const;
export const LESSON_STATUSES = ['prepared', 'active', 'closed'] as const;
export const BLOCK_STATUSES = ['pending', 'active', 'completed', 'skipped'] as const;
export const ACTIVITY_KINDS = ['dialogue', 'problem', 'material', 'reflection'] as const;

export type PlanStatus = typeof PLAN_STATUSES[number];
export type LessonStatus = typeof LESSON_STATUSES[number];
export type BlockStatus = typeof BLOCK_STATUSES[number];
export type ActivityKind = typeof ACTIVITY_KINDS[number];
export type NodeKind = 'roadmap' | 'plan' | 'lesson';
export type NodeStatus = 'active' | PlanStatus | LessonStatus;
export type NodeSessionKey = `${NodeKind}:${string}`;
export type FreeLearningSessionKey = `free:${string}`;
export type MetaSessionKey = `meta:${string}`;
export type SessionKey = NodeSessionKey | FreeLearningSessionKey | MetaSessionKey;

export type LearningAssetKind = 'note' | 'problem-card';

export type LearningAssetHandle = {
  kind: LearningAssetKind;
  id: string;
};

/** @deprecated Use LearningAssetHandle for selected-context identity. */
export type LearningAssetReference = LearningAssetHandle;

export type LearningSourceReference =
  | { kind: LearningAssetKind; id: string; revision: number }
  | { kind: 'material'; id: string; revision: number; locator: string | null };

export type LearningContextReference =
  | LearningAssetHandle
  | { kind: 'material'; id: string; revision: number; locator: string | null };

export type CalendarDestination =
  | { kind: 'plan'; planId: string }
  | {
    kind: 'free-learning';
    intent: 'open' | 'review';
    contexts: LearningContextReference[];
  };

export type CalendarOpenedReceipt = {
  at: string;
  sessionKey: SessionKey;
};

export type CalendarAppointment = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  startsAt: string;
  plannedMinutes: number | null;
  learningSetPath: string;
  destination: CalendarDestination;
  opened: CalendarOpenedReceipt | null;
};

export type LegacyUnpinnedLearningSourceReference = {
  kind: 'legacy-unpinned';
  assetKind: LearningAssetKind;
  id: string;
};

export type ReadableLearningSourceReference =
  | LearningSourceReference
  | LegacyUnpinnedLearningSourceReference;

export type SemanticTagDraft = {
  core: string[];
  related: string[];
};

export type LearningAssetSemanticTags = SemanticTagDraft & {
  subject: LearningAssetHandle;
  revision: number;
  updatedAt: string;
};

export type SemanticRelation =
  | {
    kind: 'asset-tag';
    asset: LearningAssetHandle;
    tag: string;
    role: 'core' | 'related';
  }
  | {
    kind: 'asset-source';
    asset: LearningAssetHandle;
    source: ReadableLearningSourceReference;
  }
  | { kind: 'tag-neighbor'; left: string; right: string; weight: number }
  | { kind: 'object-anchor'; objectId: string; title: string; tag: string }
  | { kind: 'object-bucket'; objectId: string; bucketId: string; title: string };

export type AssetFormation = {
  sessionId: string;
  kind: 'free-learning' | 'meta' | NodeKind;
  title: string;
  route: string;
};

export type ProblemAttemptResponse =
  | { kind: 'answer'; text: string }
  | { kind: 'cannot' };

export type ProblemAttemptEvent = {
  kind: 'attempt';
  id: string;
  requestId: string;
  at: string;
  cardId: string;
  cardRevision: number;
  answerViewedBefore: boolean;
  response: ProblemAttemptResponse;
};

export type ProblemAnswerRevealEvent = {
  kind: 'answer-reveal';
  id: string;
  requestId: string;
  at: string;
  cardId: string;
  cardRevision: number;
  attemptId: string;
};

export type ProblemActivityEvent = ProblemAttemptEvent | ProblemAnswerRevealEvent;

export type ProblemActivitySnapshot = {
  cardId: string;
  events: ProblemActivityEvent[];
  latestAttempt: ProblemAttemptEvent | null;
  answerRevealedForLatestAttempt: boolean;
};

export type LearningNoteBlock =
  | { kind: 'markdown'; body: string }
  | { kind: 'recall'; prompt: string; answer: string };

export type LearningNote = {
  kind: 'note';
  id: string;
  path: string;
  revision: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdSessionId: string;
  sources: ReadableLearningSourceReference[];
  blocks: LearningNoteBlock[];
};

export type StudentProblemCard = {
  kind: 'problem-card';
  id: string;
  revision: number;
  title: string;
  stem: string;
  studentNote: string;
  standardAnswer: string | null;
  sources: ReadableLearningSourceReference[];
};

export type LearningAssetSummary = {
  kind: LearningAssetKind;
  id: string;
  title: string;
  revision: number;
  updatedAt: string | null;
  tags: SemanticTagDraft | null;
  sources: ReadableLearningSourceReference[];
};

export type LearningAssetLibrarySnapshot = {
  notes: LearningAssetSummary[];
  problemCards: LearningAssetSummary[];
};

export type MaterialSearchStatus =
  | 'native-text'
  | 'pdf-text'
  | 'image-readable'
  | 'unavailable';

export type MaterialRevision = {
  revision: number;
  title: string;
  originalFilename: string;
  mediaType: string;
  sha256: string;
  importedAt: string;
  originalPath: string;
  searchStatus: MaterialSearchStatus;
  searchablePath: string | null;
  locatorKind: 'lines' | 'page' | null;
  requestId: string;
};

export type LearningMaterial = {
  id: string;
  path: string;
  currentRevision: number;
  revisions: MaterialRevision[];
};

export type LearningMaterialView = {
  material: LearningMaterial;
  current: MaterialRevision;
  suggestedLocator: string | null;
};

export type MaterialImportReceipt = {
  id: string;
  revision: number;
  path: string;
  originalPath: string;
  searchStatus: MaterialSearchStatus;
};

export type MaterialLocatorSnapshot = {
  id: string;
  revision: number;
  locator: string | null;
  path: string;
  text: string | null;
};

export type LearningSetGuide = {
  title: string;
  body: string;
  raw: string;
};

export type StudentLearningSetGuide = {
  title: string;
  introduction: string;
  principles: string;
};

export type FreeLearningSessionSummary = {
  id: string;
  sessionKey: FreeLearningSessionKey;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'ended';
  selectedAssets: LearningContextReference[];
};

export type MetaSessionSummary = {
  id: string;
  sessionKey: MetaSessionKey;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningFootprintActivity =
  | 'session-start'
  | 'session-continue'
  | 'asset-created'
  | 'asset-revised'
  | 'material-imported'
  | 'problem-attempt'
  | 'answer-reveal'
  | 'learning-history';

export type LearningFootprintSource =
  | {
      kind: 'session';
      sessionKey: SessionKey;
      phase: 'start' | 'continue';
      status: NodeStatus | 'ended';
    }
  | { kind: 'asset'; asset: LearningAssetHandle; revision: number }
  | { kind: 'material'; id: string; revision: number }
  | {
      kind: 'problem-activity';
      cardId: string;
      cardRevision: number;
      eventId: string;
    }
  | {
      kind: 'object-memory';
      objectId: string;
      path: string;
      evidence: Array<
        | { kind: 'lesson'; lessonId: string; lessonPath: string; blockId: string }
        | { kind: 'free-learning'; sessionId: string }
      >;
    };

export type LearningFootprintEntry = {
  id: string;
  at: string | null;
  activity: LearningFootprintActivity;
  title: string;
  summary: string;
  route: string | null;
  source: LearningFootprintSource;
};

export type LearningFootprintSnapshot = {
  entries: LearningFootprintEntry[];
};

export type LearningSetHomeSnapshot = {
  guide: StudentLearningSetGuide;
  hasCourse: boolean;
  course: null | {
    title: string;
    route: '/course';
    activeLesson: ActiveLessonSummary | null;
  };
  assets: {
    notes: number;
    problemCards: number;
    materials: number;
  };
  recentFreeLearning: FreeLearningSessionSummary[];
  recentMeta: MetaSessionSummary[];
};

export type ActiveLessonSummary = {
  id: string;
  title: string;
  planId: string;
  planTitle: string;
  route: string;
};

export type NodeReference = {
  id: string;
  path: string;
  title: string;
  after: string | null;
  dependsOn: string[];
};

export type RoadmapDocument = {
  id: string;
  kind: 'roadmap';
  status: 'active';
  sessionId: string | null;
  path: 'ROADMAP.md';
  title: string;
  overview: string;
  longTermGoal: string;
  capabilityStandard: string;
  test: string;
  currentPosition: string;
  plans: NodeReference[];
  raw: string;
};

export type PlanDocument = {
  id: string;
  kind: 'plan';
  status: PlanStatus;
  sessionId: string | null;
  path: string;
  parentId: string;
  parentPath: 'ROADMAP.md';
  title: string;
  stageGoal: string;
  capabilityStandard: string;
  test: string;
  currentPosition: string;
  nextLessonArrangement: string;
  lessons: NodeReference[];
  raw: string;
};

export type ActivityBlock = {
  id: string;
  title: string;
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
  classroomLog: string[];
};

export type LessonDocument = {
  id: string;
  kind: 'lesson';
  status: LessonStatus;
  sessionId: string | null;
  path: string;
  parentId: string;
  parentPath: string;
  title: string;
  lessonGoal: string;
  blocks: ActivityBlock[];
  raw: string;
};

export type LessonHandoutBlock = {
  id: string;
  title: string;
  kind: ActivityKind;
  studentView: string;
};

export type LessonHandout = {
  kind: 'lesson-handout';
  planId: string;
  lessonId: string;
  title: string;
  lessonGoal: string;
  blocks: LessonHandoutBlock[];
};

export type CourseTreeNode = {
  kind: NodeKind;
  id: string;
  path: string;
  title: string;
  status: NodeStatus;
  sessionKey: SessionKey;
  after: string | null;
  dependsOn: string[];
  children: CourseTreeNode[];
};

export type CourseSnapshot = {
  guide: LearningSetGuide;
  roadmap: RoadmapDocument;
  tree: CourseTreeNode;
  selected: RoadmapDocument | PlanDocument | LessonDocument | null;
};

export type KnowledgeMethodNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
};

export type KnowledgeCard = {
  path: string;
  id: string;
  title: string;
  sourceNumber: string | null;
  primaryMethod: string | null;
  supportingMethods: string[];
};

export type KnowledgeMaterial = {
  path: string;
  title: string;
  kind: 'text' | 'image' | 'media' | 'other';
  id?: string;
  revision?: number;
  searchStatus?: MaterialSearchStatus;
};

export type KnowledgeSnapshot = {
  methods: KnowledgeMethodNode[];
  cards: KnowledgeCard[];
  materials: KnowledgeMaterial[];
};

export type MaterialSearchPhase =
  | 'starting'
  | 'filtering'
  | 'inspecting'
  | 'comparing'
  | 'done'
  | 'adjusting';

export type MaterialSearchConversationItem = {
  id: string;
  kind: 'material-search';
  status: 'running' | 'done' | 'error';
  phase: MaterialSearchPhase;
  completed: number;
  total: number;
  toolCount: number;
  elapsedMs: number;
  at: string;
  updatedAt: string;
};

export type LessonReviewConversationItem = {
  id: string;
  kind: 'lesson-review';
  status: 'running' | 'done' | 'error';
  elapsedMs: number;
  at: string;
  updatedAt: string;
};

export type PaperResearchPhase =
  | 'searching'
  | 'checking'
  | 'done'
  | 'unavailable';

export type PaperResearchConversationItem = {
  id: string;
  kind: 'paper-research';
  status: 'running' | 'done' | 'error';
  phase: PaperResearchPhase;
  at: string;
  updatedAt: string;
};

export type LearningAssetProposalConversationItem =
  | {
    id: string;
    kind: 'learning-asset-proposal';
    assetKind: 'note';
    mode: 'create' | 'revise';
    targetRevision: number | null;
    title: string;
    blocks: LearningNoteBlock[];
    status: 'shown';
    at: string;
  }
  | {
    id: string;
    kind: 'learning-asset-proposal';
    assetKind: 'problem-card';
    mode: 'create' | 'revise';
    targetRevision: number | null;
    stem: string;
    studentNote: string;
    status: 'shown';
    at: string;
  };

export type LearningAssetSavedConversationItem = {
  id: string;
  kind: 'learning-asset-saved';
  assetKind: LearningAssetKind;
  status: 'running' | 'done' | 'error';
  asset: {
    kind: LearningAssetKind;
    id: string;
    revision: number;
    title: string;
    route: string;
  } | null;
  at: string;
};

export type PublicFocusCycle = {
  sessionKey: SessionKey;
  targetSeconds: 900 | 1500 | 2700;
  startedAt: string;
  status: 'running' | 'paused';
  elapsedSeconds: number;
  remainingSeconds: number;
  expiresAt: string | null;
};

export type FocusConversationItem = {
  id: string;
  kind: 'focus-marker';
  phase: 'started' | 'ended';
  text: string;
  at: string;
};

export type LessonHandoutConversationItem = {
  id: string;
  kind: 'lesson-handout';
  status: 'running' | 'done' | 'error';
  title: string | null;
  url: string | null;
  at: string;
};

export type PeerMove = 'question' | 'association' | 'challenge';
export type PeerExpression = 'neutral' | 'curious' | 'skeptical';
export type PeerDelivery = 'history' | 'live';

export type PeerLive2DManifest = {
  version: 1;
  modelFile: string;
  coreFile: string;
  modelFiles: string[];
};

export type PeerConversationItem = {
  id: string;
  kind: 'peer';
  actorId: string;
  displayName: string;
  status: 'running' | 'done' | 'error';
  text: string | null;
  move: PeerMove | null;
  expression: PeerExpression;
  delivery: PeerDelivery;
  at: string;
};

export type ConversationItem =
  | { id: string; kind: 'user'; text: string; at: string }
  | { id: string; kind: 'assistant'; text: string; at: string }
  | PeerConversationItem
  | MaterialSearchConversationItem
  | PaperResearchConversationItem
  | LearningAssetProposalConversationItem
  | LearningAssetSavedConversationItem
  | FocusConversationItem
  | LessonReviewConversationItem
  | LessonHandoutConversationItem
  | {
    id: string;
    kind: 'tool';
    name: string;
    status: 'running' | 'done' | 'error';
    detail: unknown;
    at: string;
  };

export type SessionRunState = {
  sessionKey: SessionKey;
  status: 'idle' | 'running';
};

export type StudyEvent =
  | { type: 'conversation-item'; sessionKey: SessionKey; item: ConversationItem }
  | { type: 'conversation-snapshot'; sessionKey: SessionKey; items: ConversationItem[] }
  | {
    type: 'assistant-delta';
    sessionKey: SessionKey;
    messageId: string;
    delta: string;
  }
  | { type: 'session-run'; sessionKey: SessionKey; status: 'idle' | 'running' }
  | { type: 'session-error'; sessionKey: SessionKey; message: string }
  | { type: 'home-invalidated' }
  | { type: 'assets-invalidated' }
  | { type: 'course-invalidated' }
  | { type: 'knowledge-invalidated' }
  | { type: 'focus-invalidated' };

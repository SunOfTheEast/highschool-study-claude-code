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
export type SessionKey = `${NodeKind}:${string}`;

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
  guide: { title: string; body: string; raw: string };
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

export type ConversationItem =
  | { id: string; kind: 'user'; text: string; at: string }
  | { id: string; kind: 'assistant'; text: string; at: string }
  | MaterialSearchConversationItem
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
  | { type: 'course-invalidated' }
  | { type: 'knowledge-invalidated' };

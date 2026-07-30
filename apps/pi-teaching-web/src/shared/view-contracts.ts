import type {
  ActivityKind,
  NodeLifecycleStatus,
  SessionKey,
} from './contracts';

export type ViewQuery = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  topicId: string | null;
  timeRange: 'lesson' | 'plan' | 'all';
};

export type CourseTreeNode = {
  key: string;
  kind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string | null;
  parentKey: string | null;
  handle: string;
  title: string;
  publicPurpose: string;
  status: NodeLifecycleStatus;
  after: string | null;
  dependsOn: string[];
  route: string | null;
  sessionKey: SessionKey | null;
  children: CourseTreeNode[];
};

export type PublicPlanView = {
  id: string;
  title: string;
  status: NodeLifecycleStatus;
  goal: string;
  capabilityStandard: string;
  currentPosition: string;
  closedLessons: number;
  registeredLessons: number;
};

export type PublicLessonView = {
  id: string;
  status: NodeLifecycleStatus;
  publicTitle: string;
  publicPurpose: string | null;
  blockCount: number;
  blockKinds: ActivityKind[];
  sourceNumbers: string[];
  canStart: boolean;
  canReprepare: boolean;
  canContinue: boolean;
  canReplay: boolean;
};

export type CourseViewProjection = {
  learningSet: { title: string; overview: string; goal: string };
  roadmap: CourseTreeNode;
  plans: CourseTreeNode[];
  selectedPlan: PublicPlanView | null;
  selectedLesson: PublicLessonView | null;
  continueTarget: { route: string; title: string; detail: string };
};

export type KnowledgeNodeState =
  | 'unobserved'
  | 'observed'
  | 'more-stable'
  | 'invalidated';

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  parentId: string | null;
  state: KnowledgeNodeState;
  evidenceCount: number;
  distinctCardCount: number;
  selected: boolean;
  currentLesson: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'hierarchy';
};

export type PublicMethodCard = {
  cardPath: string;
  title: string;
  role: 'primary' | 'secondary';
};

export type PublicMaterialLink = {
  path: string;
  label: string;
  kind: 'text' | 'image' | 'media';
  viaCardPath: string | null;
};

export type PublicLessonPin = {
  lessonId: string;
  planId: string;
  title: string;
  methodIds: string[];
  route: string;
};

export type PublicMethodEvidence = {
  source: string;
  lessonId: string;
  planId: string;
  cardPath: string | null;
  materialPath: string | null;
  assessment: string;
  support: string;
  occurredAt: string;
  active: boolean;
};

export type PublicMethodDetail = {
  methodId: string;
  name: string;
  parent: { id: string; name: string } | null;
  children: Array<{ id: string; name: string }>;
  cards: PublicMethodCard[];
  materials: PublicMaterialLink[];
  lessons: PublicLessonPin[];
  evidence: PublicMethodEvidence[];
  boundary: string;
};

export type PublicKnowledgeFilters = {
  planId: string | null;
  topicId: string | null;
  timeRange: 'lesson' | 'plan' | 'all';
  availablePlans: Array<{ id: string; title: string }>;
  availableTopics: Array<{ id: string; title: string }>;
};

export type KnowledgeViewProjection = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  lessonPins: PublicLessonPin[];
  selectedMethod: PublicMethodDetail | null;
  filters: PublicKnowledgeFilters;
};

export type PublicEvidenceState =
  | 'active'
  | 'invalidated'
  | 'missing'
  | 'forbidden';

export type PublicMemoryItem = {
  id: string;
  owner: 'student' | 'teaching';
  content: string;
  scope: string;
  rationale: string;
  counterEvidence: string;
  sources: string[];
  sourceState: PublicEvidenceState;
};

export type PublicFinding = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  statement: string;
  boundary: string;
  nextUse: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicOpenQuestion = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  question: string;
  nextCheck: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicSourceIndex = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  label: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicEvidenceNode = {
  source: string;
  label: string;
  kind: 'memory' | 'claim' | 'trace' | 'session' | 'card' | 'block';
  state: PublicEvidenceState;
  children: PublicEvidenceNode[];
};

export type PublicObjectionTarget = {
  source: string;
  route: string;
  sessionKey: SessionKey;
  prefill: string;
};

export type PublicEvidenceDetail = {
  source: string;
  title: string;
  summary: string;
  studentQuote: string | null;
  state: PublicEvidenceState;
  occurredAt: string | null;
  planId: string | null;
  lessonId: string | null;
  blockId: string | null;
  cardPath: string | null;
  materialPath: string | null;
  methods: string[];
  assessment: string | null;
  support: string | null;
  boundary: string | null;
  objection: PublicObjectionTarget | null;
};

export type PublicMemoryFilters = {
  timeRange: 'lesson' | 'plan' | 'all';
  planId: string | null;
  lessonId: string | null;
};

export type MemoryViewProjection = {
  confirmed: PublicMemoryItem[];
  stageFindings: PublicFinding[];
  openQuestions: PublicOpenQuestion[];
  sourceIndexes: PublicSourceIndex[];
  selectedSource: string | null;
  lineage: PublicEvidenceNode | null;
  detail: PublicEvidenceDetail | null;
  filters: PublicMemoryFilters;
};

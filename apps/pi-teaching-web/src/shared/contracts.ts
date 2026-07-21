export type LessonStatus = 'prepared' | 'active' | 'paused' | 'closed' | 'abandoned';
export type BlockStatus = 'pending' | 'active' | 'completed' | 'skipped';
export type ActivityKind = 'dialogue' | 'problem' | 'material' | 'reflection';
export type SessionKey = `coach:${string}` | `tutor:${string}`;

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

export type PlanSummary = {
  id: string;
  title: string;
  path: string;
  status: string;
  goal: string;
  capabilityStandard: string;
};

export type LearningSetSnapshot = {
  title: string;
  overview: string;
  goal: string;
  plans: PlanSummary[];
};

export type PlanWorkspaceSnapshot = {
  learningSet: LearningSetSnapshot;
  plan: PlanSummary;
  coach: { sessionKey: SessionKey; sessionId: string | null };
  lessons: LessonNode[];
};

export type StudentProblemCard = {
  path: string;
  stem: string;
  choices: Array<{ label: string; text: string }>;
};

export type StudentNotebook = {
  lesson: Omit<LessonNode, 'blocks'> & { blocks: ActivityBlock[] };
  cards: Record<string, StudentProblemCard>;
  authoring?: { source: string };
};

export type AbilityNode = {
  method: string;
  state: 'unobserved' | 'unstable' | 'steady';
  score: number;
  evidenceCount: number;
  sources: string[];
};

export type AbilityProjection = { nodes: AbilityNode[] };

export type EvidenceView = {
  source: string;
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

export type PersonaPresentation = {
  id: string;
  choices: Array<{ id: string; name: string }>;
};

export type ChatMessage = {
  id: string;
  role: 'student' | 'coach' | 'tutor';
  text: string;
  complete: boolean;
};

export type StudyViewEvent =
  | { type: 'snapshot'; workspace: PlanWorkspaceSnapshot }
  | { type: 'message'; sessionKey: SessionKey; message: ChatMessage }
  | { type: 'message-delta'; sessionKey: SessionKey; messageId: string; delta: string }
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
    methods: Array<{
      method: string;
      state: 'unobserved' | 'unstable' | 'steady';
      evidence: number;
      sources: string[];
    }>;
  }
  | { type: 'session-error'; sessionKey: SessionKey; message: string };

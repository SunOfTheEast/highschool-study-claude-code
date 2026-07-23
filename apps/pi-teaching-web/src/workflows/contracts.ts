import type { SessionKey } from '../shared/contracts';

export type WorkflowMode = 'quick' | 'deep';
export type WorkflowStatus =
  | 'proposed'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';
export type WorkflowTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export type WorkflowTask = {
  id: string;
  label: string;
  role: string;
  instruction: string;
  dependsOn: string[];
  sourceHandles: string[];
  readRoots: string[];
};

export type WorkflowGraph = {
  id: string;
  goal: string;
  mode: WorkflowMode;
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  tasks: WorkflowTask[];
};

export type EvidenceCardIndexEntry = {
  cardPath: string;
  title: string | null;
  goal: string | null;
  methods: {
    primary: string | null;
    secondary: string[];
  };
  reason: string;
  traceRefs: string[];
};

export type WorkflowTaskResult = {
  card_index?: EvidenceCardIndexEntry[];
  findings: string[];
  evidence_refs: string[];
  recommended_action: string;
  risks: string[];
};

export type WorkflowTaskState = WorkflowTask & {
  status: WorkflowTaskStatus;
  runId: string | null;
  tokens: number;
  durationMs: number;
  result: WorkflowTaskResult | null;
  error: string | null;
};

export type WorkflowSnapshot = {
  id: string;
  parentSessionKey: SessionKey;
  goal: string;
  mode: WorkflowMode;
  status: WorkflowStatus;
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
  tasks: WorkflowTaskState[];
};

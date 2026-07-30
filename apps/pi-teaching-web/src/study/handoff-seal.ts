import {
  parseSourceHandle,
  parseHandoff,
  readActiveTraces,
  readMarkdownFile,
  renderHandoff,
  renderSourceOnlyHandoff,
  type HandoffDraft,
  type SourceHandle,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import {
  resolveEvidenceTree,
  type NodeSessionScope,
  type SessionEvidenceReader,
} from './evidence-tree';

const text = Type.String({ minLength: 1 });
const sources = Type.Array(text, { minItems: 1 });

const claimSchema = Type.Object({
  statement: text,
  scope: text,
  sources,
  boundary: text,
  nextUse: text,
}, { additionalProperties: false });

const openQuestionSchema = Type.Object({
  question: text,
  sources,
  nextCheck: text,
}, { additionalProperties: false });

export const handoffDraftSchema = Type.Object({
  learnerClaims: Type.Array(claimSchema),
  teachingClaims: Type.Array(claimSchema),
  openQuestions: Type.Array(openQuestionSchema),
}, { additionalProperties: false });

export type HandoffSealResult = {
  id: string;
  mode: 'claims' | 'source-only';
  rejectedIssues: string[];
  source: string;
};

export type HandoffSealRuntime = {
  now: () => Date;
  sessions: SessionEvidenceReader;
  sessionId?: string | null;
};

function nodeScope(
  root: string,
  nodePath: string,
): NodeSessionScope {
  const node = readMarkdownFile(root, nodePath);
  const kind = node.frontmatter.kind;
  if (kind !== 'lesson' && kind !== 'plan' && kind !== 'roadmap') {
    throw new Error(`HANDOFF_NODE_KIND_INVALID: ${nodePath}`);
  }
  return {
    nodeKind: kind,
    nodeId: node.id,
    nodePath,
    parentId: kind === 'roadmap'
      ? null
      : typeof node.frontmatter.parent_id === 'string'
        ? node.frontmatter.parent_id
        : null,
    parentPath: kind === 'roadmap'
      ? null
      : typeof node.frontmatter.parent_path === 'string'
        ? node.frontmatter.parent_path
        : null,
  };
}

function allDraftSources(draft: HandoffDraft): string[] {
  return [...new Set([
    ...draft.learnerClaims.flatMap((claim) => claim.sources),
    ...draft.teachingClaims.flatMap((claim) => claim.sources),
    ...draft.openQuestions.flatMap((question) => question.sources),
  ])];
}

function issue(source: string, state: string): string {
  return `HANDOFF_SOURCE_${state.toUpperCase()}: ${source}`;
}

function lessonSourceAllowed(
  handle: SourceHandle,
  scope: NodeSessionScope,
  sessionId: string,
): boolean {
  if (handle.kind === 'trace') return true;
  if (handle.kind === 'session') return handle.sessionId === sessionId;
  if (handle.kind === 'block') return handle.lessonId === scope.nodeId;
  return handle.kind === 'card';
}

function validateDraftSources(
  root: string,
  draft: HandoffDraft,
  scope: NodeSessionScope,
  sessions: SessionEvidenceReader,
  allowed: (handle: SourceHandle) => boolean,
): string[] {
  const issues: string[] = [];
  for (const source of allDraftSources(draft)) {
    let handle: SourceHandle;
    try {
      handle = parseSourceHandle(source);
    } catch {
      issues.push(`HANDOFF_SOURCE_INVALID: ${source}`);
      continue;
    }
    if (!allowed(handle)) {
      issues.push(`HANDOFF_SOURCE_FORBIDDEN: ${source}`);
      continue;
    }
    const evidence = resolveEvidenceTree(root, source, scope, sessions);
    if (evidence.state !== 'active') issues.push(issue(source, evidence.state));
  }
  return issues;
}

function lessonClaimBelongsToPlan(
  root: string,
  handoffId: string,
  plan: NodeSessionScope,
): boolean {
  const lessonId = handoffId.replace(/\/handoff$/, '');
  try {
    const lesson = readMarkdownFile(root, `lessons/${lessonId}.md`);
    if (
      lesson.frontmatter.kind !== 'lesson'
      || lesson.frontmatter.parent_id !== plan.nodeId
      || lesson.frontmatter.parent_path !== plan.nodePath
    ) {
      return false;
    }
    return parseHandoff(lesson.body).identity.id === handoffId;
  } catch {
    return false;
  }
}

function planClaimIsCompleted(
  root: string,
  handoffId: string,
): boolean {
  const planId = handoffId.replace(/\/handoff$/, '');
  try {
    const plan = readMarkdownFile(root, `plans/${planId}.md`);
    return plan.frontmatter.kind === 'plan'
      && plan.frontmatter.status === 'completed'
      && parseHandoff(plan.body).identity.id === handoffId;
  } catch {
    return false;
  }
}

export function sealLessonHandoff(
  root: string,
  lessonPath: string,
  draft: HandoffDraft | undefined,
  runtime: HandoffSealRuntime,
): HandoffSealResult {
  const scope = nodeScope(root, lessonPath);
  if (scope.nodeKind !== 'lesson' || scope.parentId === null) {
    throw new Error(`HANDOFF_LESSON_OWNER_INVALID: ${lessonPath}`);
  }
  const sessionId = runtime.sessionId;
  if (!sessionId) throw new Error('LESSON_SESSION_REQUIRED');
  const identity = {
    id: `${scope.nodeId}/handoff`,
    from: `lesson:${scope.nodeId}`,
    to: `plan:${scope.parentId}`,
    sealedAt: runtime.now().toISOString(),
  };
  const autoSources = [
    ...readActiveTraces(root, [lessonPath]).map((trace) => trace.sourceRef),
    `session:${sessionId}`,
  ];
  const rejectedIssues = draft === undefined
    ? ['HANDOFF_DRAFT_MISSING']
    : validateDraftSources(
      root,
      draft,
      scope,
      runtime.sessions,
      (handle) => lessonSourceAllowed(handle, scope, sessionId),
    );

  if (draft !== undefined && rejectedIssues.length === 0) {
    try {
      return {
        id: identity.id,
        mode: 'claims',
        rejectedIssues: [],
        source: renderHandoff(identity, draft),
      };
    } catch {
      rejectedIssues.push('HANDOFF_DRAFT_INVALID');
    }
  }
  return {
    id: identity.id,
    mode: 'source-only',
    rejectedIssues,
    source: renderSourceOnlyHandoff(identity, [...new Set(autoSources)]),
  };
}

export function sealPlanHandoff(
  root: string,
  planPath: string,
  draft: HandoffDraft,
  runtime: Omit<HandoffSealRuntime, 'sessionId'>,
): HandoffSealResult {
  const scope = nodeScope(root, planPath);
  if (scope.nodeKind !== 'plan' || scope.parentId === null) {
    throw new Error(`HANDOFF_PLAN_OWNER_INVALID: ${planPath}`);
  }
  const issues = validateDraftSources(
    root,
    draft,
    scope,
    runtime.sessions,
    (handle) => handle.kind === 'trace'
      || (
        handle.kind === 'claim'
        && lessonClaimBelongsToPlan(root, handle.handoffId, scope)
      ),
  );
  if (issues.length > 0) throw new Error(issues.join('; '));
  const identity = {
    id: `${scope.nodeId}/handoff`,
    from: `plan:${scope.nodeId}`,
    to: `roadmap:${scope.parentId}`,
    sealedAt: runtime.now().toISOString(),
  };
  return {
    id: identity.id,
    mode: 'claims',
    rejectedIssues: [],
    source: renderHandoff(identity, draft),
  };
}

function quote(value: string): string {
  return JSON.stringify(value.trim());
}

function renderCheckpointDraft(
  id: string,
  sealedAt: string,
  draft: HandoffDraft,
): string {
  renderHandoff({
    id: 'roadmap/handoff',
    from: 'roadmap:roadmap',
    to: 'roadmap:roadmap',
    sealedAt,
  }, draft);
  const lines = [
    `### Checkpoint ${id}`,
    '',
    `- Sealed at: ${sealedAt}`,
  ];
  for (const [index, claim] of draft.learnerClaims.entries()) {
    lines.push(
      '',
      `#### Learner C${index + 1}`,
      '',
      `- Statement: ${quote(claim.statement)}`,
      `- Scope: ${quote(claim.scope)}`,
      '- Sources:',
      ...claim.sources.map((source) => `  - ${source}`),
      `- Boundary: ${quote(claim.boundary)}`,
      `- Next use: ${quote(claim.nextUse)}`,
    );
  }
  for (const [index, claim] of draft.teachingClaims.entries()) {
    lines.push(
      '',
      `#### Teaching T${index + 1}`,
      '',
      `- Statement: ${quote(claim.statement)}`,
      `- Scope: ${quote(claim.scope)}`,
      '- Sources:',
      ...claim.sources.map((source) => `  - ${source}`),
      `- Boundary: ${quote(claim.boundary)}`,
      `- Next use: ${quote(claim.nextUse)}`,
    );
  }
  for (const [index, question] of draft.openQuestions.entries()) {
    lines.push(
      '',
      `#### Open Question Q${index + 1}`,
      '',
      `- Question: ${quote(question.question)}`,
      '- Sources:',
      ...question.sources.map((source) => `  - ${source}`),
      `- Next check: ${quote(question.nextCheck)}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export function sealRoadmapCheckpoint(
  root: string,
  draft: HandoffDraft,
  runtime: Omit<HandoffSealRuntime, 'sessionId'>,
): { id: string; source: string } {
  const scope = nodeScope(root, 'ROADMAP.md');
  if (scope.nodeKind !== 'roadmap') throw new Error('ROADMAP_OWNER_INVALID');
  const issues = validateDraftSources(
    root,
    draft,
    scope,
    runtime.sessions,
    (handle) => handle.kind === 'memory'
      || (
        handle.kind === 'claim'
        && planClaimIsCompleted(root, handle.handoffId)
      ),
  );
  if (issues.length > 0) throw new Error(issues.join('; '));
  const roadmap = readMarkdownFile(root, 'ROADMAP.md').body;
  const maximum = [...roadmap.matchAll(/^### Checkpoint checkpoint-(\d+)$/gm)]
    .map((match) => Number(match[1]))
    .reduce((current, value) => Math.max(current, value), 0);
  const id = `checkpoint-${String(maximum + 1).padStart(3, '0')}`;
  return {
    id,
    source: renderCheckpointDraft(id, runtime.now().toISOString(), draft),
  };
}

export function createCurrentSessionEvidenceReader(
  scope: NodeSessionScope,
  sessionId: string,
  entries: () => readonly unknown[],
): SessionEvidenceReader {
  return {
    read: (requested) => {
      if (requested !== sessionId) return null;
      const messages = new Set(entries().flatMap((entry) => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const id = (entry as { id?: unknown }).id;
        return typeof id === 'string' ? [id] : [];
      }));
      return {
        owner: scope,
        messages,
        label: `${scope.nodeId} session`,
      };
    },
  };
}

export function scopeForNode(root: string, nodePath: string): NodeSessionScope {
  return nodeScope(root, nodePath);
}

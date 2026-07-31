import { existsSync, readFileSync } from 'node:fs';
import {
  parseHandoff,
  parseSourceHandle,
  readCard,
  readTraceRecords,
  resolveInsideRoot,
  type Handoff,
  type HandoffClaimDraft,
  type OpenQuestionDraft,
} from 'highschool-study-markdown/study-domain';
import {
  parseProfileDocument,
  type ProfileEntry,
  type ProfileOwner,
} from '../../memory-review/profile-document';
import type { PlanWorkspaceSnapshot } from '../../shared/contracts';
import type {
  MemoryViewProjection,
  PublicEvidenceDetail,
  PublicEvidenceNode,
  PublicEvidenceState,
  PublicMemoryItem,
  PublicObjectionTarget,
  ViewQuery,
} from '../../shared/view-contracts';
import {
  resolveEvidenceTree,
  type EvidenceNode,
  type NodeSessionScope,
  type SessionEvidenceReader,
} from '../evidence-tree';
import { readRoadmapCheckpoints } from '../roadmap-checkpoints';
import { readLearningSet, readPlanWorkspace } from '../read-workspace';
import { disclosureForLesson } from './view-disclosure';

export type PublicHandoffInput = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  state: PublicEvidenceState;
  learnerClaims: Array<HandoffClaimDraft & { id: string }>;
  teachingClaims: Array<HandoffClaimDraft & { id: string }>;
  openQuestions: Array<OpenQuestionDraft & { id: string }>;
  sourceIndex: string[];
};

type HandoffRecord = {
  handoff: Handoff;
  level: PublicHandoffInput['level'];
  planId: string | null;
  lessonId: string | null;
};

type ProfileRecord = {
  owner: ProfileOwner;
  entry: ProfileEntry;
};

const roadmapScope = {
  nodeKind: 'roadmap',
  nodeId: 'roadmap',
  nodePath: 'ROADMAP.md',
  parentId: null,
  parentPath: null,
} as const satisfies NodeSessionScope;

const cautionOrder: Record<PublicEvidenceState, number> = {
  active: 0,
  invalidated: 1,
  missing: 2,
  forbidden: 3,
};

function claimSource(
  handoffId: string,
  kind: 'learner' | 'teaching',
  id: string,
): string {
  return `claim:${handoffId}#${kind}-${id.toLowerCase()}`;
}

function worstState(states: PublicEvidenceState[]): PublicEvidenceState {
  return states.reduce<PublicEvidenceState>((current, state) => (
    cautionOrder[state] > cautionOrder[current] ? state : current
  ), 'active');
}

function objectionPrefill(source: string): string {
  return `我对这条学习记录有异议。请先核对来源 ${source}，再和我确认哪里不准确；在更正真正落盘前，不要说已经修正。`;
}

export function projectObjectionTarget(
  source: string,
  owner: { planId: string | null; planWritable: boolean },
): PublicObjectionTarget {
  if (owner.planId && owner.planWritable) {
    return {
      source,
      route: `/course/plan/${encodeURIComponent(owner.planId)}`,
      sessionKey: `coach:${owner.planId}`,
      prefill: objectionPrefill(source),
    };
  }
  return {
    source,
    route: '/course',
    sessionKey: 'coach:@roadmap',
    prefill: objectionPrefill(source),
  };
}

export function projectHandoffFindings(
  handoffs: PublicHandoffInput[],
): Pick<
  MemoryViewProjection,
  'stageFindings' | 'openQuestions' | 'sourceIndexes'
> {
  return {
    stageFindings: handoffs.flatMap((handoff) => (
      handoff.state !== 'active'
        ? []
        : handoff.learnerClaims.map((claim) => ({
            id: claimSource(handoff.id, 'learner', claim.id),
            level: handoff.level,
            statement: claim.statement,
            boundary: claim.boundary,
            nextUse: claim.nextUse,
            sources: [...claim.sources],
            state: handoff.state,
          }))
    )),
    openQuestions: handoffs.flatMap((handoff) => (
      handoff.state !== 'active'
        ? []
        : handoff.openQuestions.map((question) => ({
            id: `${handoff.id}#open-${question.id.toLowerCase()}`,
            level: handoff.level,
            question: question.question,
            nextCheck: question.nextCheck,
            sources: [...question.sources],
            state: handoff.state,
          }))
    )),
    sourceIndexes: handoffs.flatMap((handoff) => (
      handoff.learnerClaims.length === 0
      && handoff.openQuestions.length === 0
      && handoff.sourceIndex.length > 0
        ? [{
            id: `${handoff.id}#sources`,
            level: handoff.level,
            label: '本阶段只保留了来源记录',
            sources: [...handoff.sourceIndex],
            state: handoff.state,
          }]
        : []
    )),
  };
}

function readProfiles(root: string): ProfileRecord[] {
  return ([
    ['student', 'memory/student-profile.md'],
    ['teaching', 'memory/teaching-profile.md'],
  ] as const).flatMap(([owner, path]) => {
    const absolute = resolveInsideRoot(root, path);
    if (!existsSync(absolute)) return [];
    return parseProfileDocument(readFileSync(absolute, 'utf8'), owner)
      .map((entry) => ({ owner, entry }));
  });
}

function parseHandoffAt(
  root: string,
  path: string,
): Handoff | null {
  const absolute = resolveInsideRoot(root, path);
  if (!existsSync(absolute)) return null;
  const source = readFileSync(absolute, 'utf8');
  if (!/^## Handoff[ \t]*$/m.test(source)) return null;
  try {
    return parseHandoff(source);
  } catch {
    return null;
  }
}

function handoffRecords(root: string): HandoffRecord[] {
  const learningSet = readLearningSet(root);
  const records: HandoffRecord[] = [];
  const roadmapHandoff = parseHandoffAt(root, 'ROADMAP.md');
  if (roadmapHandoff !== null) {
    records.push({
      handoff: roadmapHandoff,
      level: 'roadmap',
      planId: null,
      lessonId: null,
    });
  }
  for (const handoff of readRoadmapCheckpoints(root)) {
    records.push({
      handoff,
      level: 'roadmap',
      planId: null,
      lessonId: null,
    });
  }
  for (const plan of learningSet.plans) {
    const workspace = readPlanWorkspace(root, plan.id);
    const planHandoff = parseHandoffAt(root, plan.path);
    if (planHandoff !== null) {
      records.push({
        handoff: planHandoff,
        level: 'plan',
        planId: plan.id,
        lessonId: null,
      });
    }
    for (const lesson of workspace.lessons) {
      const policy = disclosureForLesson(lesson.status);
      if (!policy.mayExposeHistoricalLineage) continue;
      const handoff = parseHandoffAt(root, lesson.path);
      if (handoff === null) continue;
      records.push({
        handoff,
        level: 'lesson',
        planId: plan.id,
        lessonId: lesson.id,
      });
    }
  }
  return records;
}

function stateOfSource(
  root: string,
  source: string,
  sessions: SessionEvidenceReader,
): PublicEvidenceState {
  return resolveEvidenceTree(root, source, roadmapScope, sessions).state;
}

function stateOfSources(
  root: string,
  sources: string[],
  sessions: SessionEvidenceReader,
): PublicEvidenceState {
  return worstState(sources.map((source) => (
    stateOfSource(root, source, sessions)
  )));
}

function recordInputs(
  root: string,
  record: HandoffRecord,
  sessions: SessionEvidenceReader,
): PublicHandoffInput[] {
  const values: PublicHandoffInput[] = [];
  for (const claim of record.handoff.learnerClaims) {
    values.push({
      id: record.handoff.identity.id,
      level: record.level,
      state: stateOfSource(root, claim.sourceRef, sessions),
      learnerClaims: [claim],
      teachingClaims: [],
      openQuestions: [],
      sourceIndex: [...claim.sources],
    });
  }
  for (const question of record.handoff.openQuestions) {
    values.push({
      id: record.handoff.identity.id,
      level: record.level,
      state: stateOfSources(root, question.sources, sessions),
      learnerClaims: [],
      teachingClaims: [],
      openQuestions: [question],
      sourceIndex: [...question.sources],
    });
  }
  if (
    record.handoff.learnerClaims.length === 0
    && record.handoff.openQuestions.length === 0
  ) {
    values.push({
      id: record.handoff.identity.id,
      level: record.level,
      state: stateOfSources(root, record.handoff.sourceIndex, sessions),
      learnerClaims: [],
      teachingClaims: [...record.handoff.teachingClaims],
      openQuestions: [],
      sourceIndex: [...record.handoff.sourceIndex],
    });
  }
  return values;
}

function publicEvidenceKind(source: string): PublicEvidenceNode['kind'] {
  if (source.startsWith('memory:')) return 'memory';
  if (source.startsWith('claim:')) return 'claim';
  if (source.startsWith('trace:')) return 'trace';
  if (source.startsWith('session:')) return 'session';
  if (source.startsWith('card:')) return 'card';
  if (source.startsWith('block:')) return 'block';
  return 'claim';
}

function isTeachingClaim(source: string): boolean {
  return /^claim:.+#teaching-t[1-9]\d*$/.test(source);
}

function publicEvidenceNode(node: EvidenceNode): PublicEvidenceNode {
  return {
    source: node.source,
    label: isTeachingClaim(node.source)
      ? '阶段教学安排记录'
      : node.label,
    kind: publicEvidenceKind(node.source),
    state: node.state,
    children: node.children.map(publicEvidenceNode),
  };
}

function collectSources(node: EvidenceNode, target: Set<string>): void {
  target.add(node.source);
  for (const child of node.children) collectSources(child, target);
}

function planWritable(
  workspaces: PlanWorkspaceSnapshot[],
  planId: string | null,
): boolean {
  return planId !== null
    && workspaces.some((workspace) => (
      workspace.plan.id === planId && workspace.plan.status === 'active'
    ));
}

function sourceOwnerPlan(
  source: string,
  records: HandoffRecord[],
  workspaces: PlanWorkspaceSnapshot[],
  sessions: SessionEvidenceReader,
): string | null {
  try {
    const handle = parseSourceHandle(source);
    if (handle.kind === 'claim') {
      return records.find((record) => (
        record.handoff.identity.id === handle.handoffId
      ))?.planId ?? null;
    }
    if (handle.kind === 'block') {
      return workspaces.find((workspace) => (
        workspace.lessons.some((lesson) => lesson.id === handle.lessonId)
      ))?.plan.id ?? null;
    }
    if (handle.kind === 'session') {
      const session = sessions.readSession(`session:${handle.sessionId}`);
      if (session === null) return null;
      if (session.ownerPath.startsWith('plans/')) return session.ownerId;
      return workspaces.find((workspace) => (
        workspace.lessons.some((lesson) => (
          lesson.id === session.ownerId && lesson.path === session.ownerPath
        ))
      ))?.plan.id ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function blockDetail(
  lessonId: string,
  blockId: string,
  workspaces: PlanWorkspaceSnapshot[],
): Pick<
  PublicEvidenceDetail,
  'title' | 'summary' | 'planId' | 'lessonId' | 'blockId'
> | null {
  const workspace = workspaces.find((candidate) => (
    candidate.lessons.some((lesson) => lesson.id === lessonId)
  ));
  const lesson = workspace?.lessons.find((candidate) => (
    candidate.id === lessonId
  ));
  const block = lesson?.blocks.find((candidate) => candidate.id === blockId);
  if (!workspace || !lesson || !block) return null;
  return {
    title: block.title,
    summary: `${block.kind} · ${block.status}`,
    planId: workspace.plan.id,
    lessonId,
    blockId,
  };
}

function detailForSource(
  root: string,
  source: string,
  state: PublicEvidenceState,
  records: HandoffRecord[],
  profiles: ProfileRecord[],
  workspaces: PlanWorkspaceSnapshot[],
  sessions: SessionEvidenceReader,
): PublicEvidenceDetail | null {
  let handle;
  try {
    handle = parseSourceHandle(source);
  } catch {
    return null;
  }
  const ownerPlan = handle.kind === 'trace'
    ? readTraceRecords(root).find((trace) => trace.traceId === handle.traceId)
      ?.planId ?? null
    : sourceOwnerPlan(source, records, workspaces, sessions);
  const objection = projectObjectionTarget(source, {
    planId: ownerPlan,
    planWritable: planWritable(workspaces, ownerPlan),
  });
  const base = {
    source,
    state,
    occurredAt: null,
    planId: ownerPlan,
    lessonId: null,
    blockId: null,
    cardPath: null,
    materialPath: null,
    methods: [],
    assessment: null,
    support: null,
    boundary: null,
    studentQuote: null,
    objection,
  } satisfies Omit<PublicEvidenceDetail, 'title' | 'summary'>;

  if (handle.kind === 'trace') {
    const trace = readTraceRecords(root).find((item) => (
      item.traceId === handle.traceId
    ));
    if (!trace) return null;
    return {
      ...base,
      title: '课堂学习记录',
      summary: trace.note,
      occurredAt: trace.occurredAt,
      planId: trace.planId,
      lessonId: trace.lessonId,
      blockId: trace.blockId,
      cardPath: trace.cardPath,
      materialPath: trace.materialPath,
      methods: trace.methods === null
        ? []
        : [trace.methods.primary, ...trace.methods.secondary],
      assessment: trace.assessment,
      support: trace.support,
    };
  }

  if (handle.kind === 'session') {
    const sessionSource = `session:${handle.sessionId}` as const;
    const session = sessions.readSession(sessionSource);
    if (!session) return null;
    const message = handle.messageId === null
      ? null
      : sessions.readMessage(`${sessionSource}#message:${handle.messageId}`);
    return {
      ...base,
      title: message?.role === 'student' ? '学生原话' : '课堂会话',
      summary: message?.text ?? `${session.ownerId} 的课堂会话`,
      studentQuote: message?.role === 'student' ? message.text : null,
    };
  }

  if (handle.kind === 'card') {
    const card = readCard(root, handle.cardPath);
    if (!card) return null;
    return {
      ...base,
      title: card.title,
      summary: card.goal,
      cardPath: card.path,
      methods: card.methods.map((method) => method.name),
    };
  }

  if (handle.kind === 'block') {
    const detail = blockDetail(
      handle.lessonId,
      handle.blockId,
      workspaces,
    );
    return detail === null ? null : { ...base, ...detail };
  }

  if (handle.kind === 'claim') {
    const record = records.find((candidate) => (
      candidate.handoff.identity.id === handle.handoffId
    ));
    if (!record) return null;
    const claim = (
      handle.claimKind === 'learner'
        ? record.handoff.learnerClaims
        : record.handoff.teachingClaims
    ).find((candidate) => candidate.id === handle.claimId);
    if (!claim) return null;
    const teaching = handle.claimKind === 'teaching';
    return {
      ...base,
      title: teaching ? '阶段教学安排记录' : '阶段学习发现',
      summary: teaching
        ? '这条阶段记录曾影响教学安排。'
        : claim.statement,
      occurredAt: record.handoff.identity.sealedAt,
      planId: record.planId,
      lessonId: record.lessonId,
      boundary: teaching ? null : claim.boundary,
    };
  }

  if (handle.kind === 'memory') {
    const profile = profiles.find((candidate) => (
      candidate.owner === handle.owner
      && candidate.entry.id === handle.entryId
    ));
    if (!profile) return null;
    return {
      ...base,
      title: handle.owner === 'student'
        ? '已确认的学习偏好'
        : '系统怎样配合我',
      summary: profile.entry.content,
      boundary: `适用范围：${profile.entry.scope}；依据：${profile.entry.rationale}；反例：${profile.entry.counterEvidence}`,
    };
  }
  return null;
}

function recordVisible(
  record: HandoffRecord,
  timeRange: ViewQuery['timeRange'],
  planId: string | null,
  lessonId: string | null,
): boolean {
  if (timeRange === 'lesson') {
    return lessonId !== null
      && record.level === 'lesson'
      && record.lessonId === lessonId;
  }
  if (timeRange === 'plan') {
    return planId !== null
      && record.planId === planId
      && (record.level === 'plan' || record.level === 'lesson');
  }
  return true;
}

export function readMemoryView(
  root: string,
  query: ViewQuery,
  sessions: SessionEvidenceReader,
): MemoryViewProjection {
  const learningSet = readLearningSet(root);
  const workspaces = learningSet.plans.map((plan) => (
    readPlanWorkspace(root, plan.id)
  ));
  const validPlan = query.planId === null
    ? null
    : workspaces.find((workspace) => workspace.plan.id === query.planId) ?? null;
  const validLesson = query.lessonId === null
    ? null
    : workspaces.flatMap((workspace) => workspace.lessons.map((lesson) => ({
        workspace,
        lesson,
      }))).find((item) => (
        item.lesson.id === query.lessonId
        && (
          query.planId === null
          || validPlan?.plan.id === item.workspace.plan.id
        )
      )) ?? null;
  const planId = validPlan?.plan.id ?? null;
  const lessonId = validLesson?.lesson.id ?? null;
  const records = handoffRecords(root);
  const visibleRecords = records.filter((record) => recordVisible(
    record,
    query.timeRange,
    planId,
    lessonId,
  ));
  const inputs = visibleRecords.flatMap((record) => (
    recordInputs(root, record, sessions)
  ));
  const handoffProjection = projectHandoffFindings(inputs);
  const profiles = readProfiles(root);
  const confirmed: PublicMemoryItem[] = profiles.map(({ owner, entry }) => ({
    id: entry.id,
    owner,
    content: entry.content,
    scope: entry.scope,
    rationale: entry.rationale,
    counterEvidence: entry.counterEvidence,
    sources: [...entry.sources],
    sourceState: stateOfSources(root, entry.sources, sessions),
  }));

  const visibleSources = new Set<string>();
  for (const { owner, entry } of profiles) {
    const memorySource = `memory:${owner}/${entry.id}`;
    collectSources(
      resolveEvidenceTree(root, memorySource, roadmapScope, sessions),
      visibleSources,
    );
  }
  for (const record of visibleRecords) {
    for (const claim of record.handoff.learnerClaims) {
      collectSources(
        resolveEvidenceTree(root, claim.sourceRef, roadmapScope, sessions),
        visibleSources,
      );
    }
    for (const source of record.handoff.sourceIndex) {
      collectSources(
        resolveEvidenceTree(root, source, roadmapScope, sessions),
        visibleSources,
      );
    }
  }

  const selectedSource = query.evidenceSource !== null
    && visibleSources.has(query.evidenceSource)
    ? query.evidenceSource
    : null;
  const resolved = selectedSource === null
    ? null
    : resolveEvidenceTree(root, selectedSource, roadmapScope, sessions);

  return {
    confirmed,
    ...handoffProjection,
    selectedSource,
    lineage: resolved === null ? null : publicEvidenceNode(resolved),
    detail: resolved === null
      ? null
      : detailForSource(
          root,
          selectedSource!,
          resolved.state,
          records,
          profiles,
          workspaces,
          sessions,
        ),
    filters: {
      timeRange: query.timeRange,
      planId,
      lessonId,
    },
  };
}

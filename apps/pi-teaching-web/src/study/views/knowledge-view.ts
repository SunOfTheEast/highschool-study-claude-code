import { extname, posix } from 'node:path';
import {
  aggregateMethodSignals,
  listCards,
  readActiveTraces,
  readLessonAliases,
  readMarkdownFile,
  readMethodTree,
  readTraceRecords,
  type CardContent,
  type TraceRecord,
} from 'highschool-study-markdown/study-domain';
import type {
  LessonNode,
  NodeLifecycleStatus,
  PlanWorkspaceSnapshot,
} from '../../shared/contracts';
import type {
  KnowledgeGraphNode,
  KnowledgeNodeState,
  KnowledgeViewProjection,
  PublicLessonPin,
  PublicMaterialLink,
  PublicMethodDetail,
  PublicMethodEvidence,
  ViewQuery,
} from '../../shared/view-contracts';
import { readLearningSet, readPlanWorkspace } from '../read-workspace';
import { disclosureForLesson } from './view-disclosure';

type LessonContext = {
  lesson: LessonNode;
  workspace: PlanWorkspaceSnapshot;
  aliasPaths: Map<string, string>;
};

function knowledgeState(
  activeAttemptCount: number,
  distinctCardCount: number,
  historicalAttemptCount: number,
): KnowledgeNodeState {
  if (activeAttemptCount > 0 && distinctCardCount >= 2) return 'more-stable';
  if (activeAttemptCount > 0) return 'observed';
  if (historicalAttemptCount > 0) return 'invalidated';
  return 'unobserved';
}

function traceInQuery(trace: TraceRecord, query: ViewQuery): boolean {
  if (query.timeRange === 'lesson') {
    return query.lessonId !== null && trace.lessonId === query.lessonId;
  }
  if (query.timeRange === 'plan') {
    return query.planId !== null && trace.planId === query.planId;
  }
  return true;
}

function canonicalAliasPath(
  lessonPath: string,
  target: string,
): string | null {
  const source = target.split('#', 1)[0]?.trim();
  if (!source || /^https?:\/\//.test(source) || posix.isAbsolute(source)) {
    return null;
  }
  const path = posix.normalize(posix.join(posix.dirname(lessonPath), source));
  return path === '..' || path.startsWith('../') ? null : path;
}

function lessonContext(
  root: string,
  workspace: PlanWorkspaceSnapshot,
  lesson: LessonNode,
): LessonContext {
  const source = readMarkdownFile(root, lesson.path).body;
  const aliasPaths = new Map<string, string>();
  for (const [alias, target] of readLessonAliases(source)) {
    const path = canonicalAliasPath(lesson.path, target);
    if (path !== null) aliasPaths.set(alias, path);
  }
  return { lesson, workspace, aliasPaths };
}

function allLessonContexts(root: string): LessonContext[] {
  const learningSet = readLearningSet(root);
  return learningSet.plans.flatMap((plan) => {
    const workspace = readPlanWorkspace(root, plan.id);
    return workspace.lessons.map((lesson) => (
      lessonContext(root, workspace, lesson)
    ));
  });
}

function traceIsPublic(
  trace: TraceRecord,
  contexts: Map<string, LessonContext>,
): boolean {
  const context = contexts.get(trace.lessonId);
  if (!context) return false;
  const policy = disclosureForLesson(context.lesson.status);
  const block = context.lesson.blocks.find((item) => item.id === trace.blockId);
  return policy.mayExposeLessonBindings
    && block !== undefined
    && policy.visibleBlockStatuses.includes(block.status);
}

function traceMethods(trace: TraceRecord): string[] {
  return trace.methods === null
    ? []
    : [trace.methods.primary, ...trace.methods.secondary];
}

function visibleCardPaths(context: LessonContext): Set<string> {
  const policy = disclosureForLesson(context.lesson.status);
  if (!policy.mayExposeLessonBindings) return new Set();
  const visibleAliases = new Set(
    context.lesson.blocks
      .filter((block) => policy.visibleBlockStatuses.includes(block.status))
      .flatMap((block) => block.uses),
  );
  return new Set([...context.aliasPaths.entries()].flatMap(([alias, path]) => (
    visibleAliases.has(alias) ? [path] : []
  )));
}

function methodNamesForCards(
  cardsByPath: Map<string, CardContent>,
  paths: Set<string>,
): Set<string> {
  return new Set([...paths].flatMap((path) => (
    cardsByPath.get(path)?.methods.map((method) => method.name) ?? []
  )));
}

function lessonPin(
  context: LessonContext,
  methodIds: string[],
): PublicLessonPin | null {
  if (methodIds.length === 0) return null;
  return {
    lessonId: context.lesson.id,
    planId: context.workspace.plan.id,
    title: context.lesson.title,
    methodIds,
    route: `/course/plan/${encodeURIComponent(context.workspace.plan.id)}`
      + `/lesson/${encodeURIComponent(context.lesson.id)}`,
  };
}

function boundaryFor(
  state: KnowledgeNodeState,
  distinctCardCount: number,
): string {
  if (state === 'more-stable') {
    return `已有 ${distinctCardCount} 张不同题卡的学习记录，表现较稳定；这仍是备课关注信号，不是自动掌握判决。`;
  }
  if (state === 'observed') {
    return '已有真实学习记录，但独立题卡数量仍少，需要继续观察迁移表现。';
  }
  if (state === 'invalidated') {
    return '曾有相关学习记录，但其来源后来被更正，当前不作为有效证据。';
  }
  return '尚无真实学习记录；方法节点只表示学习集的公共知识骨架。';
}

function publicEvidence(
  trace: TraceRecord,
  activeSources: Set<string>,
): PublicMethodEvidence {
  return {
    source: trace.sourceRef,
    lessonId: trace.lessonId,
    planId: trace.planId,
    cardPath: trace.cardPath,
    materialPath: trace.materialPath,
    assessment: trace.assessment,
    support: trace.support,
    occurredAt: trace.occurredAt,
    active: activeSources.has(trace.sourceRef),
  };
}

function deduplicateMaterials(
  values: PublicMaterialLink[],
): PublicMaterialLink[] {
  const byPath = new Map<string, PublicMaterialLink>();
  for (const value of values) {
    const path = posix.normalize(value.path);
    if (!byPath.has(path)) byPath.set(path, { ...value, path });
  }
  return [...byPath.values()].sort((left, right) => (
    left.path.localeCompare(right.path)
  ));
}

function materialKind(path: string): PublicMaterialLink['kind'] {
  const extension = extname(path).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
    return 'image';
  }
  if (['.md', '.txt', '.html', '.htm', '.pdf'].includes(extension)) {
    return 'text';
  }
  return 'media';
}

export function readKnowledgeView(
  root: string,
  rawQuery: ViewQuery,
): KnowledgeViewProjection {
  const learningSet = readLearningSet(root);
  const validPlan = rawQuery.planId === null
    ? null
    : learningSet.plans.find((plan) => plan.id === rawQuery.planId) ?? null;
  const query: ViewQuery = {
    ...rawQuery,
    planId: validPlan?.id ?? null,
  };
  const contexts = allLessonContexts(root);
  const contextsByLesson = new Map(
    contexts.map((context) => [context.lesson.id, context]),
  );
  const selectedContext = query.lessonId === null
    ? null
    : contexts.find((context) => (
      context.lesson.id === query.lessonId
      && (
        rawQuery.planId === null
        || validPlan?.id === context.workspace.plan.id
      )
    )) ?? null;
  query.lessonId = selectedContext?.lesson.id ?? null;

  const tree = readMethodTree(root);
  const treeById = new Map(tree.nodes.map((node) => [node.id, node]));
  const treeByName = new Map(tree.nodes.map((node) => [node.name, node]));
  const childIds = new Map<string, string[]>();
  for (const node of tree.nodes) {
    if (node.parentId === null) continue;
    const values = childIds.get(node.parentId) ?? [];
    values.push(node.id);
    childIds.set(node.parentId, values);
  }

  const availableTopicIds = new Set([
    tree.rootId,
    ...(childIds.get(tree.rootId) ?? []),
  ]);
  const topicId = query.topicId !== null && availableTopicIds.has(query.topicId)
    ? query.topicId
    : null;
  const projectedIds = new Set<string>();
  const collectSubtree = (id: string) => {
    projectedIds.add(id);
    for (const childId of childIds.get(id) ?? []) collectSubtree(childId);
  };
  if (topicId === null) {
    for (const node of tree.nodes) projectedIds.add(node.id);
  } else {
    collectSubtree(topicId);
  }

  const allTraces = readTraceRecords(root)
    .filter((trace) => traceInQuery(trace, query))
    .filter((trace) => traceIsPublic(trace, contextsByLesson));
  const activeIds = new Set(readActiveTraces(root).map((trace) => trace.traceId));
  const activeTraces = allTraces.filter((trace) => activeIds.has(trace.traceId));
  const activeSignals = new Map(
    aggregateMethodSignals(root, activeTraces).map((signal) => [
      signal.method,
      signal,
    ]),
  );
  const historicalSignals = new Map(
    aggregateMethodSignals(root, allTraces).map((signal) => [
      signal.method,
      signal,
    ]),
  );

  const cards = listCards(root);
  const cardsByPath = new Map(cards.map((card) => [card.path, card]));
  const selectedPolicy = disclosureForLesson(selectedContext?.lesson.status ?? null);
  const selectedVisibleCards = selectedContext === null
    ? new Set<string>()
    : visibleCardPaths(selectedContext);
  const hiddenSelectedCards = selectedContext === null
    || selectedPolicy.mayExposeLessonBindings
    ? new Set<string>()
    : new Set(selectedContext.aliasPaths.values());

  const pins: PublicLessonPin[] = [];
  const lessonMethodIds = new Map<string, Set<string>>();
  for (const context of contexts) {
    const policy = disclosureForLesson(context.lesson.status);
    if (!policy.mayExposeLessonBindings) continue;
    const methodNames = new Set(
      activeTraces
        .filter((trace) => trace.lessonId === context.lesson.id)
        .flatMap(traceMethods),
    );
    if (selectedContext?.lesson.id === context.lesson.id) {
      for (const name of methodNamesForCards(cardsByPath, selectedVisibleCards)) {
        methodNames.add(name);
      }
    }
    const methodIds = [...methodNames].flatMap((name) => {
      const node = treeByName.get(name);
      return node && projectedIds.has(node.id) ? [node.id] : [];
    });
    const pin = lessonPin(context, methodIds);
    if (pin !== null) {
      pins.push(pin);
      lessonMethodIds.set(context.lesson.id, new Set(methodIds));
    }
  }
  const currentMethodIds = selectedContext === null
    ? new Set<string>()
    : lessonMethodIds.get(selectedContext.lesson.id) ?? new Set<string>();

  let selectedNode = query.methodName === null
    ? null
    : treeByName.get(query.methodName) ?? null;
  if (selectedNode?.id === tree.rootId) selectedNode = null;
  if (selectedNode === null && query.methodName === null && query.cardPath !== null) {
    const card = cardsByPath.get(query.cardPath);
    const primary = card?.methods.find((method) => method.role === 'primary');
    selectedNode = primary ? treeByName.get(primary.name) ?? null : null;
  }
  if (
    selectedNode !== null
    && (
      !projectedIds.has(selectedNode.id)
      || hiddenSelectedCards.has(query.cardPath ?? '')
    )
  ) {
    selectedNode = null;
  }

  const nodes: KnowledgeGraphNode[] = tree.nodes
    .filter((node) => projectedIds.has(node.id))
    .map((node) => {
      const active = activeSignals.get(node.name);
      const historical = historicalSignals.get(node.name);
      const state = knowledgeState(
        active?.attemptCount ?? 0,
        active?.distinctCardCount ?? 0,
        historical?.attemptCount ?? 0,
      );
      return {
        id: node.id,
        label: node.name,
        parentId: node.parentId,
        state,
        evidenceCount: active?.attemptCount ?? 0,
        distinctCardCount: active?.distinctCardCount ?? 0,
        selected: selectedNode?.id === node.id,
        currentLesson: currentMethodIds.has(node.id),
      };
    });

  const activeSourceRefs = new Set(
    selectedNode === null
      ? []
      : activeSignals.get(selectedNode.name)?.sourceRefs ?? [],
  );
  const historicalSourceRefs = new Set(
    selectedNode === null
      ? []
      : historicalSignals.get(selectedNode.name)?.sourceRefs ?? [],
  );
  const selectedEvidence = allTraces
    .filter((trace) => historicalSourceRefs.has(trace.sourceRef))
    .map((trace) => publicEvidence(trace, activeSourceRefs));

  let selectedMethod: PublicMethodDetail | null = null;
  if (selectedNode !== null) {
    const active = activeSignals.get(selectedNode.name);
    const historical = historicalSignals.get(selectedNode.name);
    const state = knowledgeState(
      active?.attemptCount ?? 0,
      active?.distinctCardCount ?? 0,
      historical?.attemptCount ?? 0,
    );
    const publicCards = cards
      .filter((card) => !hiddenSelectedCards.has(card.path))
      .flatMap((card) => card.methods
        .filter((method) => method.name === selectedNode.name)
        .map((method) => ({
          cardPath: card.path,
          title: card.title,
          role: method.role,
        })));
    const publicCardPaths = new Set(publicCards.map((card) => card.cardPath));
    const traceMaterials = activeTraces.flatMap((trace) => (
      trace.materialPath !== null
      && traceMethods(trace).includes(selectedNode.name)
      && !hiddenSelectedCards.has(trace.cardPath ?? '')
        ? [{
            path: trace.materialPath,
            label: posix.basename(trace.materialPath),
            kind: materialKind(trace.materialPath),
            viaCardPath: trace.cardPath,
          }]
        : []
    ));
    const cardMaterials = cards
      .filter((card) => publicCardPaths.has(card.path))
      .flatMap((card) => card.materials.map((material) => ({
        ...material,
        viaCardPath: card.path,
      })));
    selectedMethod = {
      methodId: selectedNode.id,
      name: selectedNode.name,
      parent: selectedNode.parentId === null
        ? null
        : (() => {
            const parent = treeById.get(selectedNode.parentId);
            return parent ? { id: parent.id, name: parent.name } : null;
          })(),
      children: (childIds.get(selectedNode.id) ?? []).flatMap((id) => {
        const child = treeById.get(id);
        return child && projectedIds.has(id)
          ? [{ id: child.id, name: child.name }]
          : [];
      }),
      cards: publicCards,
      materials: deduplicateMaterials([...cardMaterials, ...traceMaterials]),
      lessons: pins.filter((pin) => pin.methodIds.includes(selectedNode.id)),
      evidence: selectedEvidence,
      boundary: boundaryFor(state, active?.distinctCardCount ?? 0),
    };
  }

  return {
    nodes,
    edges: tree.nodes.flatMap((node) => (
      node.parentId !== null
      && projectedIds.has(node.id)
      && projectedIds.has(node.parentId)
        ? [{
            id: `${node.parentId}->${node.id}`,
            from: node.parentId,
            to: node.id,
            kind: 'hierarchy' as const,
          }]
        : []
    )),
    lessonPins: pins,
    selectedMethod,
    filters: {
      planId: query.planId,
      topicId,
      timeRange: query.timeRange,
      availablePlans: learningSet.plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
      })),
      availableTopics: tree.nodes
        .filter((node) => availableTopicIds.has(node.id))
        .map((node) => ({ id: node.id, title: node.name })),
    },
  };
}

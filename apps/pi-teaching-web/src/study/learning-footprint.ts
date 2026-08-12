import type {
  LearningFootprintEntry,
  LearningFootprintSnapshot,
  NodeStatus,
} from '../shared/contracts';
import {
  freeLearningSessionKey,
  isFreeLearningScope,
  isMetaScope,
  metaSessionKey,
  type StudySessionScope,
} from '../runtime/session-scope';
import {
  listLearningNotes,
  listProblemCards,
  readLearningNoteRevision,
  readProblemCardRevision,
} from './learning-assets';
import { listMaterials } from './materials';
import { readObjectLearningHistoryFacts } from './memory-mutations';
import { listProblemActivities } from './problem-attempts';
import { listAssetReviewHistories } from './asset-reviews';

export type OwnedLearningSessionFact = {
  id: string;
  title: string;
  createdAt: string;
  entryTimes: string[];
  owner: StudySessionScope;
  status: NodeStatus | 'ended';
};

function nodeRoute(kind: 'roadmap' | 'plan' | 'lesson', id: string, parentId: string | null): string {
  if (kind === 'roadmap') return '/course';
  if (kind === 'plan') return `/course/plan/${encodeURIComponent(id)}`;
  return parentId === null
    ? '/course'
    : `/course/plan/${encodeURIComponent(parentId)}/lesson/${encodeURIComponent(id)}`;
}

function sessionIdentity(fact: OwnedLearningSessionFact): {
  key: `free:${string}` | `meta:${string}` | `${'roadmap' | 'plan' | 'lesson'}:${string}`;
  route: string;
  label: string;
} {
  if (isFreeLearningScope(fact.owner)) {
    return { key: freeLearningSessionKey(fact.id), route: `/learn/${encodeURIComponent(fact.id)}`, label: '自由学习' };
  }
  if (isMetaScope(fact.owner)) {
    return { key: metaSessionKey(fact.id), route: `/meta/${encodeURIComponent(fact.id)}`, label: '长期学习规划' };
  }
  const labels = { roadmap: 'Roadmap 讨论', plan: 'Plan 讨论', lesson: '课堂学习' } as const;
  return {
    key: `${fact.owner.nodeKind}:${fact.owner.nodeId}`,
    route: nodeRoute(fact.owner.nodeKind, fact.owner.nodeId, fact.owner.parentId),
    label: labels[fact.owner.nodeKind],
  };
}

function sessionEntries(fact: OwnedLearningSessionFact): LearningFootprintEntry[] {
  const identity = sessionIdentity(fact);
  const entries: LearningFootprintEntry[] = [{
    id: `session:${fact.id}:start`,
    at: fact.createdAt,
    activity: 'session-start',
    title: fact.title,
    summary: `开始${identity.label}`,
    route: identity.route,
    source: {
      kind: 'session',
      sessionKey: identity.key,
      phase: 'start',
      status: fact.status,
    },
  }];
  const times = [...new Set(fact.entryTimes)].sort();
  if (times.length > 1) {
    entries.push({
      id: `session:${fact.id}:continue`,
      at: times.at(-1)!,
      activity: 'session-continue',
      title: fact.title,
      summary: `继续${identity.label}`,
      route: identity.route,
      source: {
        kind: 'session',
        sessionKey: identity.key,
        phase: 'continue',
        status: fact.status,
      },
    });
  }
  return entries;
}

function assetEntries(
  root: string,
  notes: ReturnType<typeof listLearningNotes>,
  cards: ReturnType<typeof listProblemCards>,
): LearningFootprintEntry[] {
  const entries: LearningFootprintEntry[] = [];
  for (const current of notes) {
    for (let revision = 1; revision <= current.revision; revision += 1) {
      const note = readLearningNoteRevision(root, current.id, revision);
      entries.push({
        id: `asset:note:${note.id}@${revision}`,
        at: revision === 1 ? note.createdAt : note.updatedAt,
        activity: revision === 1 ? 'asset-created' : 'asset-revised',
        title: note.title,
        summary: revision === 1 ? '保存为笔记' : `更新笔记至第 ${revision} 版`,
        route: `/assets/notes/${encodeURIComponent(note.id)}`,
        source: { kind: 'asset', asset: { kind: 'note', id: note.id }, revision },
      });
    }
  }
  for (const current of cards) {
    const revisions = current.createdSessionId === null ? [current] : Array.from(
      { length: current.revision },
      (_, index) => readProblemCardRevision(root, current.id, index + 1),
    );
    for (const card of revisions) {
      const revision = card.revision;
      entries.push({
        id: `asset:problem-card:${card.id}@${revision}`,
        at: card.createdSessionId === null
          ? null
          : revision === 1 ? card.createdAt : card.updatedAt,
        activity: revision === 1 ? 'asset-created' : 'asset-revised',
        title: card.title,
        summary: revision === 1 ? '保存为题卡' : `更新题卡至第 ${revision} 版`,
        route: `/assets/problem-cards/${encodeURIComponent(card.id)}`,
        source: { kind: 'asset', asset: { kind: 'problem-card', id: card.id }, revision },
      });
    }
  }
  return entries;
}

function materialEntries(root: string): LearningFootprintEntry[] {
  return listMaterials(root).flatMap((material) => material.revisions.map((revision) => ({
    id: `material:${material.id}@${revision.revision}`,
    at: revision.importedAt,
    activity: 'material-imported' as const,
    title: revision.title,
    summary: revision.revision === 1 ? '导入学习资料' : `导入资料第 ${revision.revision} 版`,
    route: `/assets/materials/${encodeURIComponent(material.id)}`,
    source: { kind: 'material' as const, id: material.id, revision: revision.revision },
  })));
}

function problemActivityEntries(
  root: string,
  cards: ReturnType<typeof listProblemCards>,
): LearningFootprintEntry[] {
  const titles = new Map(cards.map((card) => [card.id, card.title]));
  return listProblemActivities(root).flatMap((activity) => activity.events.map((event) => ({
    id: `problem-activity:${event.cardId}:${event.id}`,
    at: event.at,
    activity: event.kind === 'attempt' ? 'problem-attempt' as const : 'answer-reveal' as const,
    title: titles.get(event.cardId) ?? `题卡 ${event.cardId}`,
    summary: event.kind === 'attempt'
      ? event.response.kind === 'cannot' ? '提交了“不会”' : '提交了一次作答'
      : '查看了标准答案',
    route: `/assets/problem-cards/${encodeURIComponent(event.cardId)}`,
    source: {
      kind: 'problem-activity' as const,
      cardId: event.cardId,
      cardRevision: event.cardRevision,
      eventId: event.id,
    },
  })));
}

const reviewResultLabels = {
  forgot: '没想起',
  effortful: '吃力',
  fluent: '顺利想起',
} as const;

function assetReviewEntries(
  root: string,
  notes: ReturnType<typeof listLearningNotes>,
  cards: ReturnType<typeof listProblemCards>,
): LearningFootprintEntry[] {
  const titles = new Map<string, string>([
    ...notes.map((note) => [`note:${note.id}`, note.title] as const),
    ...cards.map((card) => [`problem-card:${card.id}`, card.title] as const),
  ]);
  return listAssetReviewHistories(root).flatMap((history) => {
    const corrections = new Map<string, 'forgot' | 'effortful' | 'fluent' | null>();
    for (const event of history.events) {
      if (event.kind === 'corrected') {
        corrections.set(event.targetEventId, event.replacementResult);
      }
    }
    return history.events.flatMap((event) => {
      if (event.kind !== 'reviewed') return [];
      const result = corrections.has(event.eventId)
        ? corrections.get(event.eventId)!
        : event.result;
      if (result === null) return [];
      const key = `${history.asset.kind}:${history.asset.id}`;
      return [{
        id: `asset-review:${key}:${event.eventId}`,
        at: event.at,
        activity: 'asset-review' as const,
        title: titles.get(key) ?? `${history.asset.kind === 'note' ? '笔记' : '题卡'} ${history.asset.id}`,
        summary: `复习结果：${reviewResultLabels[result]}`,
        route: history.asset.kind === 'note'
          ? `/assets/notes/${encodeURIComponent(history.asset.id)}`
          : `/assets/problem-cards/${encodeURIComponent(history.asset.id)}`,
        source: {
          kind: 'asset-review' as const,
          asset: history.asset,
          eventId: event.eventId,
          result,
        },
      }];
    });
  });
}

function evidenceRoute(
  evidence: ReturnType<typeof readObjectLearningHistoryFacts>[number]['evidence'],
): string | null {
  const lesson = evidence.find((item) => item.kind === 'lesson');
  if (lesson?.kind === 'lesson') {
    const match = /^plans\/([^/]+)\/lessons\/([^/]+)\.md$/.exec(lesson.lessonPath);
    if (match) {
      return `/course/plan/${encodeURIComponent(match[1]!)}/lesson/${encodeURIComponent(match[2]!)}`;
    }
  }
  const free = evidence.find((item) => item.kind === 'free-learning');
  return free?.kind === 'free-learning' ? `/learn/${encodeURIComponent(free.sessionId)}` : null;
}

function historyEntries(root: string): LearningFootprintEntry[] {
  return readObjectLearningHistoryFacts(root).map((fact) => ({
    id: `object-memory:${fact.objectId}:${fact.index}`,
    at: fact.at,
    activity: 'learning-history' as const,
    title: fact.objectTitle,
    summary: fact.change,
    route: evidenceRoute(fact.evidence),
    source: {
      kind: 'object-memory' as const,
      objectId: fact.objectId,
      path: fact.objectPath,
      evidence: fact.evidence,
    },
  }));
}

function newestFirst(left: LearningFootprintEntry, right: LearningFootprintEntry): number {
  if (left.at === null) return right.at === null ? left.id.localeCompare(right.id) : 1;
  if (right.at === null) return -1;
  return Date.parse(right.at) - Date.parse(left.at) || left.id.localeCompare(right.id);
}

export function readLearningFootprint(
  root: string,
  sessions: readonly OwnedLearningSessionFact[],
): LearningFootprintSnapshot {
  const notes = listLearningNotes(root);
  const cards = listProblemCards(root);
  const entries = [
    ...sessions.flatMap(sessionEntries),
    ...assetEntries(root, notes, cards),
    ...materialEntries(root),
    ...problemActivityEntries(root, cards),
    ...assetReviewEntries(root, notes, cards),
    ...historyEntries(root),
  ];
  return { entries: [...new Map(entries.map((entry) => [entry.id, entry])).values()].sort(newestFirst) };
}

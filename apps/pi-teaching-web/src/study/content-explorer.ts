import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
} from 'node:path';
import {
  listCanonicalMethodNames,
  readActiveTraces,
  readCard,
  readLessonAliases,
  resolveInsideRoot,
  searchCards,
  type TraceRecord,
} from 'highschool-study-markdown/study-domain';
import type {
  ContentSearchHit,
  ContentSearchResult,
  LearningRecordSummary,
  SessionKey,
} from '../shared/contracts';
import { readLearningSet, readPlanWorkspace } from './read-workspace';
import { readStudentProblemCard } from './student-notebook';

const textExtensions = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.html']);

type Scope = {
  full: boolean;
  cards: Set<string>;
  materials: Set<string>;
  methods: Set<string>;
};

function canonicalTarget(lessonPath: string, target: string): string {
  return normalize(join(dirname(lessonPath), target)).replaceAll('\\', '/');
}

function traceSummary(trace: TraceRecord): LearningRecordSummary {
  return {
    source: trace.sourceRef,
    lessonId: trace.lessonId,
    blockId: trace.blockId,
    assessment: trace.assessment,
    support: trace.support,
    note: trace.note,
  };
}

function scopeFor(root: string, sessionKey: SessionKey): Scope {
  if (sessionKey === 'coach:@roadmap') {
    throw new Error('CONTENT_SEARCH_ROADMAP_UNAVAILABLE');
  }
  if (sessionKey.startsWith('coach:')) {
    readPlanWorkspace(root, sessionKey.slice(6));
    return {
      full: true,
      cards: new Set(),
      materials: new Set(),
      methods: new Set(),
    };
  }

  const lessonId = sessionKey.slice(6);
  const lesson = readLearningSet(root).plans.flatMap((plan) => (
    readPlanWorkspace(root, plan.id).lessons
  )).find((candidate) => candidate.id === lessonId);
  if (!lesson) throw new Error('CONTENT_SEARCH_SESSION_NOT_FOUND');
  if (lesson.status === 'prepared') throw new Error('CONTENT_SEARCH_TUTOR_NOT_STARTED');
  if (lesson.status === 'closed' || lesson.status === 'abandoned') {
    return {
      full: true,
      cards: new Set(),
      materials: new Set(),
      methods: new Set(),
    };
  }

  const source = readFileSync(resolveInsideRoot(root, lesson.path), 'utf8');
  const aliases = readLessonAliases(source);
  const cards = new Set<string>();
  const materials = new Set<string>();
  const methods = new Set<string>();
  for (const alias of lesson.blocks
    .filter((block) => block.status === 'active' || block.status === 'completed')
    .flatMap((block) => block.uses)) {
    const target = aliases.get(alias);
    if (!target) continue;
    const path = canonicalTarget(lesson.path, target);
    if (path.startsWith('cards/')) cards.add(path);
    if (path.startsWith('materials/')) materials.add(path.split('#')[0]!);
  }
  for (const trace of readActiveTraces(root, [lesson.path])) {
    if (trace.cardPath) cards.add(trace.cardPath);
    if (trace.materialPath) materials.add(trace.materialPath.split('#')[0]!);
    if (trace.methods) {
      methods.add(trace.methods.primary);
      for (const method of trace.methods.secondary) methods.add(method);
    }
  }
  for (const cardPath of cards) {
    for (const method of readCard(root, cardPath)?.methods ?? []) methods.add(method.name);
  }
  return { full: false, cards, materials, methods };
}

function materialPaths(root: string): string[] {
  const base = resolveInsideRoot(root, 'materials');
  if (!existsSync(base)) return [];
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        result.push(relative(resolveInsideRoot(root, '.'), absolute).replaceAll('\\', '/'));
      }
    }
  };
  visit(base);
  return result.sort();
}

function matches(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.every((term) => normalized.includes(term));
}

function preview(source: string, terms: string[]): string {
  const flat = source.replace(/\s+/g, ' ').trim();
  const index = Math.max(0, ...terms.map((term) => flat.toLowerCase().indexOf(term)));
  const start = Math.max(0, index - 70);
  const excerpt = flat.slice(start, start + 260);
  return `${start > 0 ? '…' : ''}${excerpt}${start + excerpt.length < flat.length ? '…' : ''}`;
}

function traceMatches(trace: TraceRecord, terms: string[]): boolean {
  return matches([
    trace.note,
    trace.lessonId,
    trace.blockId,
    trace.cardPath ?? '',
    trace.materialPath ?? '',
    trace.methods?.primary ?? '',
    ...(trace.methods?.secondary ?? []),
  ].join('\n'), terms);
}

export function searchStudentContent(
  root: string,
  input: { query: string; sessionKey: SessionKey; limit: number },
): ContentSearchResult {
  const query = input.query.trim();
  if (!query) return { query: '', hits: [] };
  const scope = scopeFor(root, input.sessionKey);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const traces = readActiveTraces(root);
  const tracesByCard = new Map<string, TraceRecord[]>();
  for (const trace of traces) {
    if (!trace.cardPath) continue;
    const current = tracesByCard.get(trace.cardPath) ?? [];
    current.push(trace);
    tracesByCard.set(trace.cardPath, current);
  }
  const ranked: Array<ContentSearchHit & { rank: number }> = [];

  const directCards = searchCards(root, { query, limit: 10_000 }).cards;
  const directPaths = new Set(directCards.map((card) => card.path));
  const traceCardPaths = new Set(
    traces.filter((trace) => trace.cardPath && traceMatches(trace, terms))
      .map((trace) => trace.cardPath!),
  );
  for (const path of new Set([...directPaths, ...traceCardPaths])) {
    if (!scope.full && !scope.cards.has(path)) continue;
    const card = readCard(root, path);
    if (!card) continue;
    const matchedBy = directPaths.has(path) ? 'asset' : 'trace';
    ranked.push({
      rank: matchedBy === 'asset' ? 1 : 2,
      kind: 'card',
      id: `card:${path}`,
      title: card.title,
      subtitle: card.goal || card.methods.map((method) => method.name).join(' · ') || '真实题卡',
      source: path,
      matchedBy,
      matchReason: matchedBy === 'asset'
        ? `题卡内容命中“${query}”`
        : `相关学习记录命中“${query}”`,
      traceHistory: (tracesByCard.get(path) ?? [])
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .map(traceSummary),
      card: readStudentProblemCard(root, path),
      preview: null,
    });
  }

  for (const method of listCanonicalMethodNames(root)) {
    const methodTraces = traces.filter((trace) => (
      trace.methods?.primary === method || trace.methods?.secondary.includes(method)
    ));
    const direct = matches(method, terms);
    const byTrace = methodTraces.some((trace) => traceMatches(trace, terms));
    if ((!direct && !byTrace) || (!scope.full && !scope.methods.has(method))) continue;
    ranked.push({
      rank: direct ? 1 : 2,
      kind: 'method',
      id: `method:${method}`,
      title: method,
      subtitle: '规范方法节点',
      source: 'graph/vocabulary.yaml',
      matchedBy: direct ? 'asset' : 'trace',
      matchReason: direct ? `方法名称命中“${query}”` : `相关学习记录命中“${query}”`,
      traceHistory: methodTraces.map(traceSummary),
      card: null,
      preview: null,
    });
  }

  for (const path of materialPaths(root)) {
    if (!scope.full && !scope.materials.has(path)) continue;
    const extension = extname(path).toLowerCase();
    const readable = textExtensions.has(extension);
    const source = readable ? readFileSync(resolveInsideRoot(root, path), 'utf8') : '';
    const direct = matches(`${path}\n${source}`, terms);
    const materialTraces = traces.filter((trace) => trace.materialPath?.split('#')[0] === path);
    const byTrace = materialTraces.some((trace) => traceMatches(trace, terms));
    if (!direct && !byTrace) continue;
    ranked.push({
      rank: direct ? 1 : 2,
      kind: 'material',
      id: `material:${path}`,
      title: basename(path),
      subtitle: readable ? '可阅读材料' : '媒体材料',
      source: path,
      matchedBy: direct ? 'asset' : 'trace',
      matchReason: direct ? `材料内容命中“${query}”` : `相关学习记录命中“${query}”`,
      traceHistory: materialTraces.map(traceSummary),
      card: null,
      preview: readable ? preview(source, terms) : null,
    });
  }

  const seen = new Set<string>();
  const hits = ranked
    .sort((left, right) => left.rank - right.rank || left.source.localeCompare(right.source))
    .filter((hit) => {
      const key = `${hit.kind}:${hit.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, Math.min(input.limit, 50)))
    .map(({ rank: _rank, ...hit }) => hit);
  return { query, hits };
}

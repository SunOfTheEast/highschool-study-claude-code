import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { parse } from 'yaml';
import { readCardAlternatives, type CardAlternative } from './alternatives';
import { resolveInsideRoot } from './learning-set';
import { buildTraceIndex } from './trace-index';
import { readActiveTraces, type TraceRecord } from './traces';

type CardCore = {
  path: string;
  title: string;
  content: string;
  goal: string;
  methods: Array<{ name: string; role: 'primary' | 'secondary' }>;
  steps: Array<{ id: string; title: string }>;
  parts: string[];
  materials: CardMaterialRef[];
};

export type CardMaterialRef = {
  path: string;
  label: string;
  kind: 'text' | 'image' | 'media';
};

export type CardHit = CardCore & {
  traceHistory: TraceRecord[];
  alternatives: CardAlternative[];
};

export type CardContent = CardCore;
export type ActiveTraceReader = (root: string) => TraceRecord[];
export type CardSearchInput = { query: string; limit: number };

type LoadedCard = { card: CardContent; searchText: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sourcePath(value: unknown): string | null {
  const object = record(value);
  const candidate = typeof value === 'string'
    ? value
    : typeof object?.path === 'string'
      ? object.path
      : '';
  const path = candidate.trim().replace(/:\d+(?:-\d+)?$/, '');
  return path.startsWith('materials/')
    && !path.split('/').some((segment) => (
      segment === '' || segment === '.' || segment === '..'
    ))
    ? path
    : null;
}

function materialKind(path: string): CardMaterialRef['kind'] {
  const extension = extname(path).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
    return 'image';
  }
  if (['.md', '.txt', '.html', '.htm', '.pdf'].includes(extension)) {
    return 'text';
  }
  return 'media';
}

function cardPaths(root: string): string[] {
  const rootPath = resolveInsideRoot(root, '.');
  const cardsPath = resolveInsideRoot(root, 'cards');
  if (!existsSync(cardsPath)) return [];
  const paths: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && ['.yaml', '.yml'].includes(extname(entry.name).toLowerCase())) {
        paths.push(relative(rootPath, path).replaceAll('\\', '/'));
      }
    }
  };
  visit(cardsPath);
  return paths.sort();
}

function loadCard(root: string, path: string): LoadedCard | null {
  const source = readFileSync(resolveInsideRoot(root, path), 'utf8');
  const raw = record(parse(source));
  if (raw?.schema !== 'highschool-study.problem-card.v1') return null;
  const graph = record(raw.graph);
  const goal = record(graph?.goal);
  const method = record(graph?.method);
  const rubric = record(raw.rubric);
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  const methods: CardHit['methods'] = [];
  const primary = text(method?.primary);
  if (primary) methods.push({ name: primary, role: 'primary' });
  for (const name of Array.isArray(method?.secondary) ? method.secondary : []) {
    if (typeof name === 'string' && !methods.some((item) => item.name === name)) {
      methods.push({ name, role: 'secondary' });
    }
  }
  const stem = text(raw.stem);
  const sourceEvidence = record(raw.source_evidence);
  const materialPaths = [
    ...(Array.isArray(sourceEvidence?.source_refs) ? sourceEvidence.source_refs : []),
    ...(Array.isArray(sourceEvidence?.source_images) ? sourceEvidence.source_images : []),
  ].map(sourcePath).filter((path): path is string => path !== null);
  const materials = [...new Set(materialPaths)].map((path) => ({
    path,
    label: basename(path),
    kind: materialKind(path),
  }));
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .flatMap((value) => {
      if (typeof value === 'string' && value.trim()) return [value.trim()];
      const part = record(value);
      const id = text(part?.part_id);
      return id ? [id] : [];
    });
  const card: CardContent = {
    path,
    title: stem || text(raw.content_item_id),
    content: source,
    goal: text(goal?.primary),
    methods,
    steps: criteria.flatMap((value) => {
      const criterion = record(value);
      const id = text(criterion?.step_id);
      const title = text(criterion?.description);
      return id && title ? [{ id, title }] : [];
    }),
    parts,
    materials,
  };
  return { card, searchText: `${path}\n${source}`.toLowerCase() };
}

export function readCard(root: string, path: string): CardContent | null {
  return loadCard(root, path)?.card ?? null;
}

export function listCards(root: string): CardContent[] {
  return cardPaths(root)
    .map((path) => loadCard(root, path)?.card ?? null)
    .filter((card): card is CardContent => card !== null);
}

export function createCardSearcher(readTraces: ActiveTraceReader = readActiveTraces) {
  return (root: string, input: CardSearchInput): { cards: CardHit[] } => {
    const activeTraces = readTraces(root);
    const index = buildTraceIndex(activeTraces);
    const terms = input.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return { cards: [] };
    const cards = cardPaths(root)
      .map((path) => loadCard(root, path))
      .filter((value): value is LoadedCard => value !== null)
      .map((value) => ({
        ...value,
        score: terms.filter((term) => value.searchText.includes(term)).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => (
        right.score - left.score || left.card.path.localeCompare(right.card.path)
      ))
      .map(({ card }) => ({
        ...card,
        traceHistory: index.byCardPath.get(card.path) ?? [],
        alternatives: readCardAlternatives(root, card.path),
      }))
      .slice(0, input.limit);
    return { cards };
  };
}

const defaultCardSearcher = createCardSearcher();

export function searchCards(root: string, input: CardSearchInput): { cards: CardHit[] } {
  return defaultCardSearcher(root, input);
}

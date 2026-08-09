import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  legacyCardSemanticProjection,
} from '../../scripts/build-card-recall-index';
import type {
  LearningAssetHandle,
  ReadableLearningSourceReference,
  SemanticRelation,
} from '../shared/contracts';
import {
  listLearningNotes,
  readProblemCard,
} from './learning-assets';
import {
  readSemanticTags,
  semanticTagsPath,
} from './semantic-tags';

export type SemanticRecallRow = {
  path: string;
  kind: 'note' | 'problem-card';
  id: string;
  core: string[];
  related: string[];
  titleOrStem: string;
};

export type SemanticRecallQuery = {
  terms: string[];
  limit: number;
  allowRelatedExpansion: boolean;
};

function hasTags(root: string, asset: LearningAssetHandle): boolean {
  return existsSync(join(root, semanticTagsPath(asset)));
}

type CardDocument = {
  path: string;
  value: Record<string, unknown>;
};

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function cardDocuments(root: string): CardDocument[] {
  const base = join(root, 'cards');
  if (!existsSync(base)) return [];
  const paths: string[] = [];
  const visit = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.revisions') continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(directory, entry.name), relative);
      else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) paths.push(`cards/${relative}`);
    }
  };
  visit(base, '');
  return paths.sort().flatMap((path) => {
    const parsed: unknown = parseYaml(readFileSync(join(root, path), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).schema === 'highschool-study.problem-card.v1'
      ? [{ path, value: parsed as Record<string, unknown> }]
      : [];
  });
}

export function readSemanticRecallRows(root: string): SemanticRecallRow[] {
  const rows: SemanticRecallRow[] = [];
  for (const note of listLearningNotes(root)) {
    const asset = { kind: 'note' as const, id: note.id };
    if (!hasTags(root, asset)) continue;
    const tags = readSemanticTags(root, asset);
    rows.push({
      path: note.path,
      kind: 'note',
      id: note.id,
      core: tags.core,
      related: tags.related,
      titleOrStem: note.title,
    });
  }
  for (const document of cardDocuments(root)) {
    const id = document.value.content_item_id;
    if (typeof id !== 'string' || id.length === 0) continue;
    const asset = { kind: 'problem-card' as const, id };
    if (stableIdPattern.test(id) && hasTags(root, asset)) {
      const tags = readSemanticTags(root, asset);
      rows.push({
        path: document.path,
        kind: 'problem-card',
        id,
        core: tags.core,
        related: tags.related,
        titleOrStem: String(document.value.stem ?? ''),
      });
      continue;
    }
    if (!('graph' in document.value)) continue;
    const legacy = legacyCardSemanticProjection(document.value, document.path);
    rows.push({
      path: document.path,
      kind: 'problem-card',
      id: legacy.id,
      core: legacy.core,
      related: legacy.related,
      titleOrStem: legacy.stem,
    });
  }
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

function oneLine(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').replaceAll('\t', ' ');
}

export function buildSemanticRecallIndex(root: string): string {
  const rows = readSemanticRecallRows(root);
  return [
    'path\tkind\tid\tcore\trelated\ttitle_or_stem',
    ...rows.map((row) => [
      row.path,
      row.kind,
      row.id,
      JSON.stringify(row.core),
      JSON.stringify(row.related),
      oneLine(row.titleOrStem),
    ].join('\t')),
    '',
  ].join('\n');
}

export function refreshSemanticRecallIndex(root: string): string {
  const path = join(root, 'semantics/indexes/asset-recall.tsv');
  const source = buildSemanticRecallIndex(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
}

function normalizedTerms(terms: string[]): string[] {
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function rowMatches(row: SemanticRecallRow, terms: string[]): boolean {
  const values = [...row.core, ...row.related, row.titleOrStem];
  return terms.every((term) => values.some((value) => value.includes(term)));
}

export function querySemanticRecall(root: string, query: SemanticRecallQuery): {
  candidates: SemanticRecallRow[];
  matched: number;
  relatedTerms: string[];
} {
  if (!Number.isSafeInteger(query.limit) || query.limit < 1) {
    throw new Error('SEMANTIC_RECALL_LIMIT_INVALID');
  }
  const terms = normalizedTerms(query.terms);
  if (terms.length === 0) throw new Error('SEMANTIC_RECALL_TERMS_REQUIRED');
  const matches = readSemanticRecallRows(root).filter((row) => rowMatches(row, terms));
  const relatedTerms = query.allowRelatedExpansion
    ? [...new Set(matches.flatMap((row) => [...row.core, ...row.related]))]
      .filter((tag) => !terms.includes(tag))
      .sort()
    : [];
  return {
    candidates: matches.slice(0, query.limit),
    matched: matches.length,
    relatedTerms,
  };
}

function markdownDocuments(root: string, directory: string): Array<{ name: string; source: string }> {
  const path = join(root, directory);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ name, source: readFileSync(join(path, name), 'utf8') }));
}

function heading(source: string): { id: string; title: string } | null {
  const match = /^#\s+([^：:\s]+)[：:]\s*(.+?)\s*$/m.exec(source);
  return match ? { id: match[1]!, title: match[2]! } : null;
}

export function projectSemanticRelations(root: string): SemanticRelation[] {
  const rows = readSemanticRecallRows(root);
  const relations: SemanticRelation[] = [];
  const neighborWeights = new Map<string, number>();
  for (const row of rows) {
    const asset = { kind: row.kind, id: row.id } satisfies LearningAssetHandle;
    for (const tag of row.core) relations.push({ kind: 'asset-tag', asset, tag, role: 'core' });
    for (const tag of row.related) relations.push({ kind: 'asset-tag', asset, tag, role: 'related' });
    const tags = [...new Set([...row.core, ...row.related])].sort();
    for (let left = 0; left < tags.length; left += 1) {
      for (let right = left + 1; right < tags.length; right += 1) {
        const key = `${tags[left]}\u0000${tags[right]}`;
        neighborWeights.set(key, (neighborWeights.get(key) ?? 0) + 1);
      }
    }
  }
  for (const note of listLearningNotes(root)) {
    for (const source of note.sources) {
      relations.push({
        kind: 'asset-source',
        asset: { kind: 'note', id: note.id },
        source,
      });
    }
  }
  for (const document of cardDocuments(root)) {
    const id = document.value.content_item_id;
    if (typeof id !== 'string' || !stableIdPattern.test(id) || !document.value.m1b) continue;
    const card = readProblemCard(root, id);
    for (const source of card.sources) {
      relations.push({
        kind: 'asset-source',
        asset: { kind: 'problem-card', id: card.id },
        source,
      });
    }
  }
  for (const [key, weight] of neighborWeights) {
    const [left, right] = key.split('\u0000');
    relations.push({ kind: 'tag-neighbor', left: left!, right: right!, weight });
  }
  for (const object of markdownDocuments(root, 'memory/objects')) {
    const value = heading(object.source);
    if (value) {
      relations.push({
        kind: 'object-anchor',
        objectId: value.id,
        title: value.title,
        tag: value.title,
      });
    }
  }
  for (const bucket of markdownDocuments(root, 'memory/indexes')) {
    const value = heading(bucket.source);
    if (!value) continue;
    const objectIds = [...bucket.source.matchAll(/\.\.\/objects\/(obj-[A-Za-z0-9._-]+)\.md/g)]
      .map((match) => match[1]!);
    for (const objectId of new Set(objectIds)) {
      relations.push({
        kind: 'object-bucket',
        objectId,
        bucketId: value.id,
        title: value.title,
      });
    }
  }
  return relations.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

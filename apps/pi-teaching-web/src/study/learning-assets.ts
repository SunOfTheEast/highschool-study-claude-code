import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  LearningAssetLibrarySnapshot,
  LearningAssetHandle,
  LearningAssetReference,
  LearningSourceReference,
  LearningNote,
  LearningNoteBlock,
  ReadableLearningSourceReference,
  SemanticTagDraft,
  StudentProblemCard,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import type { DocumentCandidate } from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';
import {
  planSemanticTagsSave,
  type SemanticTags,
} from './semantic-tags';

export type { LearningNote, LearningNoteBlock, StudentProblemCard } from '../shared/contracts';

export type ProblemCard = {
  kind: 'problem-card';
  id: string;
  path: string;
  revision: number;
  title: string;
  stem: string;
  standardAnswer: string;
  teacherRationale: string;
  studentNote: string;
  createdAt: string | null;
  updatedAt: string | null;
  createdSessionId: string | null;
  sources: ReadableLearningSourceReference[];
};

export type AssetSaveTarget = { id: string; expectedRevision: number };

export type LearningAssetSaveDraft = {
  target?: AssetSaveTarget;
  expectedTagRevision?: number;
  tags: SemanticTagDraft;
  sources: LearningSourceReference[];
};

type ContentOnlyAssetEditDraft = {
  target: AssetSaveTarget;
  expectedTagRevision?: never;
  tags?: never;
  sources: ReadableLearningSourceReference[];
};

export type LearningNoteSaveDraft = {
  title: string;
  blocks: LearningNoteBlock[];
} & (LearningAssetSaveDraft | ContentOnlyAssetEditDraft);

export type ProblemCardSaveDraft = {
  stem: string;
  standardAnswer: string;
  teacherRationale: string;
  studentNote: string;
} & (LearningAssetSaveDraft | ContentOnlyAssetEditDraft);

export type AssetSaveReceipt = {
  kind: 'note' | 'problem-card';
  id: string;
  revision: number;
  path: string;
};

type RecordValue = Record<string, unknown>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function checkedId(value: string, label: string): string {
  if (!idPattern.test(value)) throw new Error(`${label.toUpperCase()}_INVALID: ${value}`);
  return value;
}

function checkedRevision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function checkedTime(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO timestamp`);
  return text;
}

function checkedSources(value: unknown): ReadableLearningSourceReference[] {
  if (!Array.isArray(value)) throw new Error('sources must be an array');
  const seen = new Set<string>();
  return value.map((item, index) => {
    const source = record(item);
    if (!source) throw new Error(`sources[${index}] is invalid`);
    const kind = source?.kind;
    const id = source?.id;
    if (kind === 'material') {
      if (typeof id !== 'string') throw new Error(`sources[${index}] is invalid`);
      checkedId(id, 'source id');
      const revision = checkedRevision(source.revision, `sources[${index}].revision`);
      const locator = requiredText(source.locator, `sources[${index}].locator`);
      const key = `material:${id}@${revision}#${locator}`;
      if (seen.has(key)) throw new Error(`DUPLICATE_ASSET_SOURCE: ${key}`);
      seen.add(key);
      return { kind, id, revision, locator };
    }
    if ((kind !== 'note' && kind !== 'problem-card') || typeof id !== 'string') {
      throw new Error(`sources[${index}] is invalid`);
    }
    checkedId(id, 'source id');
    if (source.revision === undefined) {
      const key = `legacy-unpinned:${kind}:${id}`;
      if (seen.has(key)) throw new Error(`DUPLICATE_ASSET_SOURCE: ${key}`);
      seen.add(key);
      return { kind: 'legacy-unpinned', assetKind: kind, id };
    }
    const revision = checkedRevision(source.revision, `sources[${index}].revision`);
    const key = `${kind}:${id}@${revision}`;
    if (seen.has(key)) throw new Error(`DUPLICATE_ASSET_SOURCE: ${key}`);
    seen.add(key);
    return { kind, id, revision };
  });
}

function sourceValue(source: ReadableLearningSourceReference): RecordValue {
  if (source.kind === 'legacy-unpinned') {
    return { kind: source.assetKind, id: source.id };
  }
  return source;
}

function checkedBlocks(value: unknown): LearningNoteBlock[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('blocks must contain at least one block');
  }
  return value.map((item, index) => {
    const block = record(item);
    if (block?.kind === 'markdown') {
      return { kind: 'markdown', body: requiredText(block.body, `blocks[${index}].body`) };
    }
    if (block?.kind === 'recall') {
      return {
        kind: 'recall',
        prompt: requiredText(block.prompt, `blocks[${index}].prompt`),
        answer: requiredText(block.answer, `blocks[${index}].answer`),
      };
    }
    throw new Error(`blocks[${index}].kind is invalid`);
  });
}

function filesBelow(root: string, directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  if (lstatSync(absolute).isSymbolicLink() || !lstatSync(absolute).isDirectory()) {
    throw new StudyDocumentError(directory, 'asset directory must be a real directory');
  }
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new StudyDocumentError(relative(root, path), 'asset path cannot be a symbolic link');
      }
      if (entry.isDirectory() && entry.name !== '.revisions') visit(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
    }
  };
  visit(absolute);
  return files.sort();
}

function yamlAt(root: string, path: string): RecordValue {
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) throw new StudyDocumentError(path, 'asset does not exist');
  if (lstatSync(absolute).isSymbolicLink()) {
    throw new StudyDocumentError(path, 'asset cannot be a symbolic link');
  }
  let value: unknown;
  try {
    value = parseYaml(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new StudyDocumentError(
      path,
      error instanceof Error ? error.message : 'invalid YAML',
    );
  }
  const result = record(value);
  if (!result) throw new StudyDocumentError(path, 'YAML root must be a mapping');
  return result;
}

function canonicalYaml(value: RecordValue): string {
  return stringifyYaml(value, { lineWidth: 0 });
}

function noteRevisionPath(id: string, revision: number): string {
  return `notes/.revisions/${checkedId(id, 'note id')}/${checkedRevision(revision, 'note revision')}.note.yaml`;
}

function noteFromValue(path: string, value: RecordValue, archived = false): LearningNote {
  if (value.schema !== 'studyforge.note.v1') {
    throw new StudyDocumentError(path, 'expected studyforge.note.v1');
  }
  const id = checkedId(requiredText(value.id, 'note id'), 'note id');
  const revision = checkedRevision(value.revision, 'note revision');
  const expectedPath = `notes/${id}.note.yaml`;
  const validPath = archived ? noteRevisionPath(id, revision) : expectedPath;
  if (path !== validPath) throw new StudyDocumentError(path, `Note path must be ${validPath}`);
  return {
    kind: 'note',
    id,
    path,
    revision,
    title: requiredText(value.title, 'note title'),
    createdAt: checkedTime(value.created_at, 'created_at'),
    updatedAt: checkedTime(value.updated_at, 'updated_at'),
    createdSessionId: checkedId(
      requiredText(value.created_session_id, 'created_session_id'),
      'created session id',
    ),
    sources: checkedSources(value.sources ?? []),
    blocks: checkedBlocks(value.blocks),
  };
}

function noteValue(note: LearningNote): RecordValue {
  return {
    schema: 'studyforge.note.v1',
    id: note.id,
    revision: note.revision,
    title: note.title,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    created_session_id: note.createdSessionId,
    sources: note.sources.map(sourceValue),
    blocks: note.blocks,
  };
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]!.trim();
}

function problemCardFromValue(root: string, path: string, value: RecordValue): ProblemCard {
  if (value.schema !== 'highschool-study.problem-card.v1') {
    throw new StudyDocumentError(path, 'expected highschool-study.problem-card.v1');
  }
  const id = checkedId(requiredText(value.content_item_id, 'content_item_id'), 'problem card id');
  const stem = requiredText(value.stem, 'stem');
  const m1b = record(value.m1b);
  const absolute = resolveDocumentPath(root, path);
  const stats = existsSync(absolute) ? statSync(absolute) : null;
  return {
    kind: 'problem-card',
    id,
    path,
    revision: m1b ? checkedRevision(m1b.revision, 'problem card revision') : 1,
    title: firstLine(stem),
    stem,
    standardAnswer: optionalText(value.answer),
    teacherRationale: optionalText(value.teacher_rationale)
      || optionalText(record(value.solution)?.source_solution_summary),
    studentNote: optionalText(value.student_note),
    createdAt: m1b
      ? checkedTime(m1b.created_at, 'created_at')
      : stats?.birthtime.toISOString() ?? null,
    updatedAt: m1b
      ? checkedTime(m1b.updated_at, 'updated_at')
      : stats?.mtime.toISOString() ?? null,
    createdSessionId: m1b
      ? checkedId(requiredText(m1b.created_session_id, 'created_session_id'), 'created session id')
      : null,
    sources: m1b ? checkedSources(m1b.sources ?? []) : [],
  };
}

function nextNumericId(root: string, kind: 'note' | 'problem'): string {
  const paths = kind === 'note' ? filesBelow(root, 'notes') : filesBelow(root, 'cards');
  const matcher = kind === 'note' ? /^notes\/note-(\d+)\.note\.yaml$/ : /(?:^|\/)problem-(\d+)\.card\.yaml$/;
  let maximum = 0;
  for (const path of paths) {
    const match = matcher.exec(path);
    if (match) maximum = Math.max(maximum, Number.parseInt(match[1]!, 10));
  }
  return `${kind}-${String(maximum + 1).padStart(3, '0')}`;
}

function checkedSessionId(value: string): string {
  return checkedId(value, 'session id');
}

function sameSources(
  left: readonly ReadableLearningSourceReference[],
  right: readonly ReadableLearningSourceReference[],
): boolean {
  return JSON.stringify(left.map(sourceValue)) === JSON.stringify(right.map(sourceValue));
}

function checkedDraftSources(
  value: unknown,
  current: readonly ReadableLearningSourceReference[] | null,
): ReadableLearningSourceReference[] {
  const sources = checkedSources(value);
  if (sources.some((source) => source.kind === 'legacy-unpinned')) {
    if (current === null || !sameSources(sources, current)) {
      throw new Error('LEGACY_UNPINNED_SOURCE');
    }
  }
  return sources;
}

function notePath(id: string): string {
  return `notes/${checkedId(id, 'note id')}.note.yaml`;
}

export function readLearningNote(root: string, id: string): LearningNote {
  const path = notePath(id);
  return noteFromValue(path, yamlAt(root, path));
}

export function readLearningNoteRevision(root: string, id: string, revision: number): LearningNote {
  const checked = checkedRevision(revision, 'note revision');
  try {
    const current = readLearningNote(root, id);
    if (current.revision === checked) return current;
  } catch (error) {
    if (!(error instanceof StudyDocumentError) || !error.message.includes('asset does not exist')) {
      throw error;
    }
  }
  const path = noteRevisionPath(id, checked);
  try {
    return noteFromValue(path, yamlAt(root, path), true);
  } catch (error) {
    if (error instanceof StudyDocumentError && error.message.includes('asset does not exist')) {
      throw new Error(`ASSET_REVISION_UNRESOLVED: note:${id}@${checked}`);
    }
    throw error;
  }
}

export function listLearningNotes(root: string): LearningNote[] {
  return filesBelow(root, 'notes')
    .filter((path) => path.endsWith('.note.yaml'))
    .map((path) => noteFromValue(path, yamlAt(root, path)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function problemCardMatches(root: string, id: string): Array<{ path: string; value: RecordValue }> {
  const target = checkedId(id, 'problem card id');
  return filesBelow(root, 'cards')
    .filter((path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()))
    .flatMap((path) => {
      const value = yamlAt(root, path);
      return value.schema === 'highschool-study.problem-card.v1'
        && value.content_item_id === target
        ? [{ path, value }]
        : [];
    });
}

export function readProblemCard(root: string, id: string): ProblemCard {
  const matches = problemCardMatches(root, id);
  if (matches.length !== 1) {
    throw new StudyDocumentError(
      `cards/${id}`,
      matches.length === 0 ? 'problem card does not exist' : 'duplicate problem card id',
    );
  }
  return problemCardFromValue(root, matches[0]!.path, matches[0]!.value);
}

function problemRevisionPath(id: string, revision: number): string {
  return `cards/m1b/.revisions/${checkedId(id, 'problem card id')}/${checkedRevision(revision, 'problem card revision')}.card.yaml`;
}

export function readProblemCardRevision(root: string, id: string, revision: number): ProblemCard {
  const checked = checkedRevision(revision, 'problem card revision');
  try {
    const current = readProblemCard(root, id);
    if (current.revision === checked) return current;
  } catch (error) {
    if (!(error instanceof StudyDocumentError) || !error.message.includes('problem card does not exist')) {
      throw error;
    }
  }
  const path = problemRevisionPath(id, checked);
  try {
    const card = problemCardFromValue(root, path, yamlAt(root, path));
    if (card.id !== id || card.revision !== checked) {
      throw new StudyDocumentError(path, 'problem card archive identity changed');
    }
    return card;
  } catch (error) {
    if (error instanceof StudyDocumentError && error.message.includes('asset does not exist')) {
      throw new Error(`ASSET_REVISION_UNRESOLVED: problem-card:${id}@${checked}`);
    }
    throw error;
  }
}

type AssetRevisionIdentity = {
  kind: 'note' | 'problem-card';
  id: string;
  revision: number;
};

function assetRevisionKey(identity: AssetRevisionIdentity): string {
  return `${identity.kind}:${identity.id}@${identity.revision}`;
}

function readAssetRevisionSources(
  root: string,
  identity: AssetRevisionIdentity,
): ReadableLearningSourceReference[] {
  return identity.kind === 'note'
    ? readLearningNoteRevision(root, identity.id, identity.revision).sources
    : readProblemCardRevision(root, identity.id, identity.revision).sources;
}

function validateSourceGraph(
  root: string,
  target: AssetRevisionIdentity,
  sources: readonly ReadableLearningSourceReference[],
): void {
  const complete = new Set<string>();
  const active = new Set<string>();

  const visit = (identity: AssetRevisionIdentity) => {
    const key = assetRevisionKey(identity);
    if (active.has(key)) throw new Error(`ASSET_SOURCE_CYCLE: ${key}`);
    if (complete.has(key)) return;
    active.add(key);
    for (const source of readAssetRevisionSources(root, identity)) {
      if (source.kind === 'material' || source.kind === 'legacy-unpinned') continue;
      visit(source);
    }
    active.delete(key);
    complete.add(key);
  };

  for (const source of sources) {
    if (source.kind === 'legacy-unpinned') continue;
    if (source.kind === 'material') {
      throw new Error(`ASSET_REVISION_UNRESOLVED: material:${source.id}@${source.revision}#${source.locator}`);
    }
    if (source.kind === target.kind && source.id === target.id) {
      throw new Error(`ASSET_SOURCE_SELF_REFERENCE: ${source.kind}:${source.id}`);
    }
    visit(source);
  }
}

export function listProblemCards(root: string): ProblemCard[] {
  const cards = filesBelow(root, 'cards')
    .filter((path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()))
    .flatMap((path) => {
      const value = yamlAt(root, path);
      return value.schema === 'highschool-study.problem-card.v1'
        ? [problemCardFromValue(root, path, value)]
        : [];
    });
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) throw new StudyDocumentError(card.path, `duplicate problem card id ${card.id}`);
    ids.add(card.id);
  }
  return cards.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export function readLearningAssetLibrary(root: string): LearningAssetLibrarySnapshot {
  return {
    notes: listLearningNotes(root).map((note) => ({
      kind: 'note',
      id: note.id,
      title: note.title,
      revision: note.revision,
      updatedAt: note.updatedAt,
    })),
    problemCards: listProblemCards(root).map((card) => ({
      kind: 'problem-card',
      id: card.id,
      title: card.title,
      revision: card.revision,
      updatedAt: card.updatedAt,
    })),
  };
}

export function readStudentProblemCard(
  root: string,
  id: string,
  answerRevealed: boolean,
): StudentProblemCard {
  const card = readProblemCard(root, id);
  return {
    kind: card.kind,
    id: card.id,
    revision: card.revision,
    title: card.title,
    stem: card.stem,
    studentNote: card.studentNote,
    standardAnswer: answerRevealed ? card.standardAnswer : null,
    sources: card.sources,
  };
}

function noteCandidate(note: LearningNote, before: string | null): DocumentCandidate {
  const after = canonicalYaml(noteValue(note));
  return {
    path: note.path,
    before,
    after,
    validate: (source) => {
      const value = record(parseYaml(source));
      if (!value) throw new StudyDocumentError(note.path, 'YAML root must be a mapping');
      noteFromValue(note.path, value);
    },
  };
}

function noteArchiveCandidate(note: LearningNote, bytes: string): DocumentCandidate {
  const path = noteRevisionPath(note.id, note.revision);
  return {
    path,
    before: null,
    after: bytes,
    validate: (source) => {
      const value = record(parseYaml(source));
      if (!value) throw new StudyDocumentError(path, 'YAML root must be a mapping');
      const archived = noteFromValue(path, value, true);
      if (archived.id !== note.id || archived.revision !== note.revision) {
        throw new StudyDocumentError(path, 'note archive identity changed');
      }
    },
  };
}

function plannedTagCandidate(
  root: string,
  subject: LearningAssetHandle,
  draft: { expectedTagRevision?: number; tags?: SemanticTagDraft },
  recordedAt: string,
  creating: boolean,
): { candidate: DocumentCandidate; tags: SemanticTags } | null {
  if (draft.tags === undefined) {
    if (creating) throw new Error('SEMANTIC_TAG_CORE_REQUIRED');
    if (draft.expectedTagRevision !== undefined) {
      throw new Error(`SEMANTIC_TAG_DRAFT_REQUIRED: ${subject.kind}:${subject.id}`);
    }
    return null;
  }
  return planSemanticTagsSave(root, subject, {
    ...(draft.expectedTagRevision === undefined
      ? {}
      : { expectedRevision: draft.expectedTagRevision }),
    tags: draft.tags,
  }, recordedAt);
}

export function planLearningNoteSave(
  root: string,
  sessionId: string,
  draft: LearningNoteSaveDraft,
  recordedAt: string,
): {
  candidates: DocumentCandidate[];
  receipt: AssetSaveReceipt;
  note: LearningNote;
  semanticTags: SemanticTags | null;
} {
  checkedTime(recordedAt, 'recordedAt');
  checkedSessionId(sessionId);
  const title = requiredText(draft.title, 'note title');
  const blocks = checkedBlocks(draft.blocks);
  let before: string | null = null;
  let archive: DocumentCandidate | null = null;
  let note: LearningNote;
  if (draft.target) {
    const current = readLearningNote(root, draft.target.id);
    if (current.revision !== draft.target.expectedRevision) {
      throw new Error(`ASSET_REVISION_STALE: ${current.id}`);
    }
    const sources = checkedDraftSources(draft.sources, current.sources);
    validateSourceGraph(root, {
      kind: 'note', id: current.id, revision: current.revision + 1,
    }, sources);
    before = readFileSync(resolveDocumentPath(root, current.path), 'utf8');
    archive = noteArchiveCandidate(current, before);
    note = {
      ...current,
      title,
      blocks,
      sources,
      revision: current.revision + 1,
      updatedAt: recordedAt,
    };
  } else {
    const sources = checkedDraftSources(draft.sources, null);
    const id = nextNumericId(root, 'note');
    note = {
      kind: 'note',
      id,
      path: notePath(id),
      revision: 1,
      title,
      createdAt: recordedAt,
      updatedAt: recordedAt,
      createdSessionId: sessionId,
      sources,
      blocks,
    };
    validateSourceGraph(root, { kind: 'note', id, revision: 1 }, sources);
  }
  const tagPlan = plannedTagCandidate(
    root,
    { kind: 'note', id: note.id },
    draft,
    recordedAt,
    draft.target === undefined,
  );
  return {
    candidates: [
      ...(archive ? [archive] : []),
      noteCandidate(note, before),
      ...(tagPlan ? [tagPlan.candidate] : []),
    ],
    receipt: { kind: 'note', id: note.id, revision: note.revision, path: note.path },
    note,
    semanticTags: tagPlan?.tags ?? null,
  };
}

function problemCardValue(card: ProblemCard): RecordValue {
  return {
    schema: 'highschool-study.problem-card.v1',
    content_item_id: card.id,
    content_revision_id: `${card.id}-r${card.revision}`,
    storage_uri: card.path,
    stem: card.stem,
    answer: card.standardAnswer,
    teacher_rationale: card.teacherRationale,
    student_note: card.studentNote,
    m1b: {
      revision: card.revision,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      created_session_id: card.createdSessionId,
      sources: card.sources.map(sourceValue),
    },
  };
}

function problemCandidate(root: string, card: ProblemCard, before: string | null): DocumentCandidate {
  const after = canonicalYaml(problemCardValue(card));
  return {
    path: card.path,
    before,
    after,
    validate: (source) => {
      const value = record(parseYaml(source));
      if (!value) throw new StudyDocumentError(card.path, 'YAML root must be a mapping');
      const parsed = problemCardFromValue(root, card.path, value);
      if (parsed.id !== card.id || parsed.revision !== card.revision) {
        throw new StudyDocumentError(card.path, 'problem card candidate identity changed');
      }
    },
  };
}

function problemArchiveCandidate(root: string, card: ProblemCard, bytes: string): DocumentCandidate {
  const path = problemRevisionPath(card.id, card.revision);
  return {
    path,
    before: null,
    after: bytes,
    validate: (source) => {
      const value = record(parseYaml(source));
      if (!value) throw new StudyDocumentError(path, 'YAML root must be a mapping');
      const archived = problemCardFromValue(root, path, value);
      if (archived.id !== card.id || archived.revision !== card.revision) {
        throw new StudyDocumentError(path, 'problem card archive identity changed');
      }
    },
  };
}

export function planProblemCardSave(
  root: string,
  sessionId: string,
  draft: ProblemCardSaveDraft,
  recordedAt: string,
): {
  candidates: DocumentCandidate[];
  receipt: AssetSaveReceipt;
  card: ProblemCard;
  semanticTags: SemanticTags | null;
} {
  checkedTime(recordedAt, 'recordedAt');
  checkedSessionId(sessionId);
  const stem = requiredText(draft.stem, 'stem');
  const standardAnswer = requiredText(draft.standardAnswer, 'standardAnswer');
  const teacherRationale = requiredText(draft.teacherRationale, 'teacherRationale');
  const studentNote = optionalText(draft.studentNote);
  let before: string | null = null;
  let archive: DocumentCandidate | null = null;
  let card: ProblemCard;
  if (draft.target) {
    const current = readProblemCard(root, draft.target.id);
    if (current.revision !== draft.target.expectedRevision) {
      throw new Error(`ASSET_REVISION_STALE: ${current.id}`);
    }
    if (current.createdSessionId === null) {
      throw new Error(`LEGACY_PROBLEM_CARD_READ_ONLY: ${current.id}`);
    }
    const sources = checkedDraftSources(draft.sources, current.sources);
    validateSourceGraph(root, {
      kind: 'problem-card', id: current.id, revision: current.revision + 1,
    }, sources);
    before = readFileSync(resolveDocumentPath(root, current.path), 'utf8');
    archive = problemArchiveCandidate(root, current, before);
    card = {
      ...current,
      title: firstLine(stem),
      stem,
      standardAnswer,
      teacherRationale,
      studentNote,
      sources,
      revision: current.revision + 1,
      updatedAt: recordedAt,
    };
  } else {
    const sources = checkedDraftSources(draft.sources, null);
    const id = nextNumericId(root, 'problem');
    const path = `cards/m1b/${id}.card.yaml`;
    card = {
      kind: 'problem-card',
      id,
      path,
      revision: 1,
      title: firstLine(stem),
      stem,
      standardAnswer,
      teacherRationale,
      studentNote,
      createdAt: recordedAt,
      updatedAt: recordedAt,
      createdSessionId: sessionId,
      sources,
    };
    validateSourceGraph(root, { kind: 'problem-card', id, revision: 1 }, sources);
  }
  const tagPlan = plannedTagCandidate(
    root,
    { kind: 'problem-card', id: card.id },
    draft,
    recordedAt,
    draft.target === undefined,
  );
  return {
    candidates: [
      ...(archive ? [archive] : []),
      problemCandidate(root, card, before),
      ...(tagPlan ? [tagPlan.candidate] : []),
    ],
    receipt: { kind: 'problem-card', id: card.id, revision: card.revision, path: card.path },
    card,
    semanticTags: tagPlan?.tags ?? null,
  };
}

export function renderSelectedAssetContext(
  root: string,
  references: readonly LearningAssetReference[],
): string {
  if (references.length === 0) return '';
  const sections = references.map((reference, index) => {
    const alias = `source-${index + 1}`;
    if (reference.kind === 'note') {
      const note = readLearningNote(root, reference.id);
      return [
        `## ${alias} · note:${note.id}`,
        '',
        canonicalYaml({
          title: note.title,
          revision: note.revision,
          blocks: note.blocks,
          sources: note.sources,
        }).trim(),
      ].join('\n');
    }
    const card = readProblemCard(root, reference.id);
    return [
      `## ${alias} · problem-card:${card.id}`,
      '',
      canonicalYaml({
        revision: card.revision,
        stem: card.stem,
        standard_answer: card.standardAnswer,
        teacher_rationale: card.teacherRationale,
        student_note: card.studentNote,
        sources: card.sources,
      }).trim(),
    ].join('\n');
  });
  return ['# Selected Learning Assets', '', ...sections].join('\n\n');
}

export function resolveSelectedAssetAliases(
  root: string,
  references: readonly LearningAssetReference[],
  aliases: readonly string[],
): LearningSourceReference[] {
  const seen = new Set<string>();
  return aliases.map((alias) => {
    if (!/^source-[1-9][0-9]*$/.test(alias)) throw new Error(`ASSET_SOURCE_ALIAS_INVALID: ${alias}`);
    const index = Number.parseInt(alias.slice('source-'.length), 10) - 1;
    const reference = references[index];
    if (!reference) throw new Error(`ASSET_SOURCE_ALIAS_UNKNOWN: ${alias}`);
    if (seen.has(alias)) throw new Error(`ASSET_SOURCE_ALIAS_DUPLICATE: ${alias}`);
    seen.add(alias);
    const revision = reference.kind === 'note'
      ? readLearningNote(root, reference.id).revision
      : readProblemCard(root, reference.id).revision;
    return { kind: reference.kind, id: reference.id, revision };
  });
}

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  LearningAssetHandle,
  SemanticTagDraft,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import type { DocumentCandidate } from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';

export type SemanticTags = {
  schema: 'studyforge.semantic-tags.v1';
  subject: LearningAssetHandle;
  revision: number;
  core: string[];
  related: string[];
  updatedAt: string;
};

export type SemanticTagsSaveDraft = {
  expectedRevision?: number;
  tags: SemanticTagDraft;
};

type RecordValue = Record<string, unknown>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function checkedSubject(value: unknown): LearningAssetHandle {
  const subject = record(value);
  const kind = subject?.kind;
  const id = subject?.id;
  if ((kind !== 'note' && kind !== 'problem-card') || typeof id !== 'string' || !idPattern.test(id)) {
    throw new Error('SEMANTIC_TAG_SUBJECT_INVALID');
  }
  return { kind, id };
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('SEMANTIC_TAG_REVISION_INVALID');
  }
  return Number(value);
}

function checkedTime(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('SEMANTIC_TAG_TIME_INVALID');
  }
  return value;
}

function checkedTagList(value: unknown, field: 'core' | 'related'): string[] {
  if (!Array.isArray(value)) throw new Error(`SEMANTIC_TAG_${field.toUpperCase()}_INVALID`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (
      typeof item !== 'string'
      || item.length === 0
      || item !== item.trim()
      || /[\r\n\t]/u.test(item)
      || [...item].length > 40
    ) {
      throw new Error(`SEMANTIC_TAG_${field.toUpperCase()}_INVALID`);
    }
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function checkedSemanticTagDraft(draft: SemanticTagDraft): SemanticTagDraft {
  const core = checkedTagList(draft?.core, 'core');
  if (core.length === 0) throw new Error('SEMANTIC_TAG_CORE_REQUIRED');
  const coreSet = new Set(core);
  const related = checkedTagList(draft?.related, 'related')
    .filter((tag) => !coreSet.has(tag));
  return { core, related };
}

export function semanticTagsPath(subject: LearningAssetHandle): string {
  const checked = checkedSubject(subject);
  return `semantics/assets/${checked.kind}/${checked.id}.tags.yaml`;
}

function semanticTagsFromValue(path: string, value: unknown): SemanticTags {
  const root = record(value);
  if (!root || root.schema !== 'studyforge.semantic-tags.v1') {
    throw new StudyDocumentError(path, 'expected studyforge.semantic-tags.v1');
  }
  const subject = checkedSubject(root.subject);
  if (semanticTagsPath(subject) !== path) {
    throw new StudyDocumentError(path, `semantic tag path does not match ${subject.kind}:${subject.id}`);
  }
  const tags = checkedSemanticTagDraft({
    core: root.core as string[],
    related: root.related as string[],
  });
  return {
    schema: 'studyforge.semantic-tags.v1',
    subject,
    revision: checkedRevision(root.revision),
    core: tags.core,
    related: tags.related,
    updatedAt: checkedTime(root.updated_at),
  };
}

function semanticTagsValue(tags: SemanticTags): RecordValue {
  return {
    schema: tags.schema,
    subject: tags.subject,
    revision: tags.revision,
    core: tags.core,
    related: tags.related,
    updated_at: tags.updatedAt,
  };
}

export function readSemanticTags(root: string, subject: LearningAssetHandle): SemanticTags {
  const path = semanticTagsPath(subject);
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) throw new StudyDocumentError(path, 'semantic tags do not exist');
  if (lstatSync(absolute).isSymbolicLink()) {
    throw new StudyDocumentError(path, 'semantic tags cannot be a symbolic link');
  }
  let value: unknown;
  try {
    value = parseYaml(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new StudyDocumentError(path, error instanceof Error ? error.message : 'invalid YAML');
  }
  return semanticTagsFromValue(path, value);
}

export function planSemanticTagsSave(
  root: string,
  subject: LearningAssetHandle,
  draft: SemanticTagsSaveDraft,
  recordedAt: string,
): { candidate: DocumentCandidate; tags: SemanticTags } {
  const path = semanticTagsPath(subject);
  const absolute = resolveDocumentPath(root, path);
  const exists = existsSync(absolute);
  const before = exists ? readFileSync(absolute, 'utf8') : null;
  const current = exists ? readSemanticTags(root, subject) : null;
  if (current === null) {
    if (draft.expectedRevision !== undefined) {
      throw new Error(`SEMANTIC_TAG_REVISION_STALE: ${subject.kind}:${subject.id}`);
    }
  } else if (draft.expectedRevision !== current.revision) {
    throw new Error(`SEMANTIC_TAG_REVISION_STALE: ${subject.kind}:${subject.id}`);
  }
  const checked = checkedSemanticTagDraft(draft.tags);
  const tags: SemanticTags = {
    schema: 'studyforge.semantic-tags.v1',
    subject: checkedSubject(subject),
    revision: (current?.revision ?? 0) + 1,
    core: checked.core,
    related: checked.related,
    updatedAt: checkedTime(recordedAt),
  };
  const after = stringifyYaml(semanticTagsValue(tags), { lineWidth: 0 });
  return {
    tags,
    candidate: {
      path,
      before,
      after,
      validate: (source) => {
        const parsed = semanticTagsFromValue(path, parseYaml(source));
        if (
          parsed.subject.kind !== tags.subject.kind
          || parsed.subject.id !== tags.subject.id
          || parsed.revision !== tags.revision
        ) {
          throw new StudyDocumentError(path, 'semantic tag candidate identity changed');
        }
      },
    },
  };
}

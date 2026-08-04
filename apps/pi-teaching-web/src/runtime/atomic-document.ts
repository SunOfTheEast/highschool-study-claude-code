import {
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { StudyDocumentError } from '../study/markdown';

export type DocumentMutation<T> = {
  source: string;
  value: T;
};

export function resolveDocumentPath(root: string, path: string): string {
  if (!path || isAbsolute(path)) {
    throw new StudyDocumentError(path, 'path must be learning-set-relative');
  }
  const base = resolve(root);
  const target = resolve(base, path);
  if (target === base || !target.startsWith(`${base}${sep}`)) {
    throw new StudyDocumentError(path, 'path escapes the learning set');
  }
  return target;
}

export function mutateDocumentAtomically<T>(
  root: string,
  path: string,
  transform: (source: string) => DocumentMutation<T>,
  validate: (source: string) => unknown = () => undefined,
): T {
  const absolute = resolveDocumentPath(root, path);
  const before = readFileSync(absolute, 'utf8');
  const mode = statSync(absolute).mode;
  validate(before);
  const candidate = transform(before);
  validate(candidate.source);

  const temporary = join(
    dirname(absolute),
    `.${basename(absolute)}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporary, candidate.source, {
      encoding: 'utf8',
      flag: 'wx',
      mode,
    });
    if (readFileSync(absolute, 'utf8') !== before) {
      throw new StudyDocumentError(path, 'SOURCE_STALE');
    }
    renameSync(temporary, absolute);
    return candidate.value;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

import {
  cpSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';

export type LearningSetValidation =
  | { ok: true; root: string }
  | {
    ok: false;
    code:
      | 'LEARNING_SET_DIRECTORY_NOT_FOUND'
      | 'LEARNING_SET_GUIDE_NOT_FOUND'
      | 'LEARNING_SET_MEMORY_INDEX_NOT_FOUND';
  };

function safeName(value: string): string {
  if (
    value.length === 0
    || value.trim() !== value
    || value === '.'
    || value === '..'
    || /[\\/\0\r\n]/.test(value)
  ) throw new Error('LEARNING_SET_NAME_INVALID');
  return value;
}

function destination(documentsHome: string, name: string): string {
  const base = resolve(documentsHome);
  const result = resolve(base, safeName(name), 'learning-set');
  if (!result.startsWith(`${base}${sep}`)) throw new Error('LEARNING_SET_NAME_INVALID');
  return result;
}

export function validateLearningSet(input: string): LearningSetValidation {
  const root = resolve(input);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { ok: false, code: 'LEARNING_SET_DIRECTORY_NOT_FOUND' };
  }
  if (!existsSync(join(root, 'LEARNING_GUIDE.md'))) {
    return { ok: false, code: 'LEARNING_SET_GUIDE_NOT_FOUND' };
  }
  if (!existsSync(join(root, 'memory', 'INDEX.md'))) {
    return { ok: false, code: 'LEARNING_SET_MEMORY_INDEX_NOT_FOUND' };
  }
  return { ok: true, root };
}

function copyFresh(sourceRoot: string, targetRoot: string): string {
  if (existsSync(targetRoot)) throw new Error('LEARNING_SET_DESTINATION_EXISTS');
  const source = validateLearningSet(sourceRoot);
  if (!source.ok) throw new Error(source.code);
  mkdirSync(resolve(targetRoot, '..'), { recursive: true });
  cpSync(source.root, targetRoot, { recursive: true, errorOnExist: true });
  return targetRoot;
}

export function createBlankLearningSet(input: {
  documentsHome: string;
  name: string;
  templateRoot: string;
}): string {
  return copyFresh(input.templateRoot, destination(input.documentsHome, input.name));
}

export function copyLearningSet(input: {
  sourceRoot: string;
  documentsHome: string;
  name: string;
}): string {
  return copyFresh(input.sourceRoot, destination(input.documentsHome, input.name));
}

import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { StudyError } from './errors';

function isOutside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '..' || pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(pathFromRoot);
}

function nearestExistingAncestor(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const resolvedRoot = realpathSync(root);
  if (isAbsolute(relativePath)) throw new StudyError('OUTSIDE_LEARNING_SET');

  const lexicalPath = resolve(resolvedRoot, relativePath);
  if (isOutside(resolvedRoot, lexicalPath)) throw new StudyError('OUTSIDE_LEARNING_SET');

  const existingAncestor = nearestExistingAncestor(lexicalPath);
  const realAncestor = realpathSync(existingAncestor);
  if (isOutside(resolvedRoot, realAncestor)) throw new StudyError('OUTSIDE_LEARNING_SET');

  return existsSync(lexicalPath) ? realpathSync(lexicalPath) : lexicalPath;
}

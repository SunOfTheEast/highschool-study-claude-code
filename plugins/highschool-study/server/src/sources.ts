import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative } from 'node:path';
import { parse } from 'yaml';
import { isStudyError } from './errors';
import { resolveInsideRoot } from './learning-set';
import { readMarkdownFile } from './markdown';

export type SourceResolution = {
  valid: boolean;
  path: string | null;
  fragment: string | null;
  excerpt: string | null;
  error: 'OUTSIDE_LEARNING_SET' | 'MISSING_FILE' | 'MISSING_FRAGMENT' | null;
};

const invalid = (
  error: Exclude<SourceResolution['error'], null>,
  path: string | null = null,
  fragment: string | null = null,
): SourceResolution => ({ valid: false, path, fragment, excerpt: null, error });

function splitTarget(target: string): { path: string; fragment: string | null } {
  const fragmentIndex = target.indexOf('#');
  if (fragmentIndex < 0) return { path: target, fragment: null };
  return {
    path: target.slice(0, fragmentIndex),
    fragment: target.slice(fragmentIndex + 1) || null,
  };
}

function cardStepExcerpt(source: string, fragment: string): string | null {
  const match = /^step=(.+)$/.exec(fragment);
  if (!match?.[1]) return null;
  const document: unknown = parse(source);
  if (document === null || typeof document !== 'object' || Array.isArray(document)) return null;
  if ((document as Record<string, unknown>).schema !== 'highschool-study.problem-card.v1') return null;
  const rubric = (document as Record<string, unknown>).rubric;
  if (rubric === null || typeof rubric !== 'object' || Array.isArray(rubric)) return null;
  const criteria = (rubric as Record<string, unknown>).criteria;
  if (!Array.isArray(criteria)) return null;
  for (const criterion of criteria) {
    if (criterion === null || typeof criterion !== 'object' || Array.isArray(criterion)) continue;
    const record = criterion as Record<string, unknown>;
    if (record.step_id !== match[1]) continue;
    return typeof record.description === 'string' ? record.description : match[1];
  }
  return null;
}

function canonicalPath(root: string, absolutePath: string): string {
  return relative(resolveInsideRoot(root, '.'), absolutePath).replaceAll('\\', '/');
}

export function sourceResolve(
  root: string,
  input: { fromPath: string; target: string },
): SourceResolution {
  let fromAbsolute: string;
  try {
    fromAbsolute = resolveInsideRoot(root, input.fromPath);
    if (!existsSync(fromAbsolute)) return invalid('MISSING_FILE');
  } catch (error) {
    return isStudyError(error) && error.code === 'OUTSIDE_LEARNING_SET'
      ? invalid('OUTSIDE_LEARNING_SET')
      : invalid('MISSING_FILE');
  }

  const target = splitTarget(input.target);
  let targetAbsolute: string;
  try {
    if (target.path && isAbsolute(target.path)) return invalid('OUTSIDE_LEARNING_SET');
    const fromPath = canonicalPath(root, fromAbsolute);
    const targetPath = target.path ? `${dirname(fromPath)}/${target.path}` : fromPath;
    targetAbsolute = resolveInsideRoot(root, targetPath);
    if (!existsSync(targetAbsolute)) return invalid('MISSING_FILE');
  } catch (error) {
    return isStudyError(error) && error.code === 'OUTSIDE_LEARNING_SET'
      ? invalid('OUTSIDE_LEARNING_SET')
      : invalid('MISSING_FILE');
  }

  const path = canonicalPath(root, targetAbsolute);
  try {
    if (extname(targetAbsolute).toLowerCase() === '.md') {
      const document = readMarkdownFile(root, path);
      if (target.fragment === null) {
        return { valid: true, path, fragment: null, excerpt: document.body, error: null };
      }
      const excerpt = document.headings.get(target.fragment);
      return excerpt === undefined
        ? invalid('MISSING_FRAGMENT', path, target.fragment)
        : { valid: true, path, fragment: target.fragment, excerpt, error: null };
    }

    const source = readFileSync(targetAbsolute, 'utf8');
    if (target.fragment === null) {
      return { valid: true, path, fragment: null, excerpt: source, error: null };
    }
    const excerpt = cardStepExcerpt(source, target.fragment);
    return excerpt === null
      ? invalid('MISSING_FRAGMENT', path, target.fragment)
      : { valid: true, path, fragment: target.fragment, excerpt, error: null };
  } catch (error) {
    if (isStudyError(error) && error.code === 'OUTSIDE_LEARNING_SET') return invalid('OUTSIDE_LEARNING_SET');
    return invalid('MISSING_FRAGMENT', path, target.fragment);
  }
}

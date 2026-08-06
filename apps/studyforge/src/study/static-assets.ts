import { existsSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export function filesBelow(root: string, directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    }
  };
  visit(absolute);
  return files.sort();
}

function hasFileBelow(
  root: string,
  directory: string,
  accept: (path: string) => boolean,
): boolean {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return false;
  const visit = (current: string): boolean => readdirSync(current, { withFileTypes: true })
    .some((entry) => {
      const path = join(current, entry.name);
      return entry.isDirectory() ? visit(path) : entry.isFile() && accept(path);
    });
  return visit(absolute);
}

export function hasKnowledgeAssets(root: string): boolean {
  return existsSync(join(root, 'graph/method_tree.yaml'))
    || hasFileBelow(
      root,
      'cards',
      (path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()),
    )
    || hasFileBelow(root, 'materials', () => true);
}

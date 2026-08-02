import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { StudyDocumentError } from '../study/markdown';

function fileInside(root: string, path: string): string {
  if (!path || isAbsolute(path)) throw new StudyDocumentError(path, 'path must be learning-set-relative');
  const base = resolve(root);
  const target = resolve(base, path);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new StudyDocumentError(path, 'path escapes the learning set');
  }
  return target;
}

export function setFrontmatterField(
  root: string,
  path: string,
  field: string,
  value: unknown,
  expected?: unknown,
): void {
  const absolute = fileInside(root, path);
  const source = readFileSync(absolute, 'utf8');
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(source);
  if (!match) throw new StudyDocumentError(path, 'missing YAML frontmatter');
  const lines = match[2]!.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${field}:`));
  if (index < 0) throw new StudyDocumentError(path, `frontmatter.${field} is missing`);
  const current = lines[index]!.slice(field.length + 1).trim();
  if (expected !== undefined) {
    const renderedExpected = stringifyYaml(expected).trim();
    if (current !== renderedExpected) {
      throw new StudyDocumentError(path, `frontmatter.${field} expected ${renderedExpected}, found ${current}`);
    }
  }
  lines[index] = `${field}: ${stringifyYaml(value).trim()}`;
  const frontmatter = `${match[1]}${lines.join('\n')}${match[3]}`;
  writeFileSync(absolute, `${frontmatter}${source.slice(match[0].length)}`);
}

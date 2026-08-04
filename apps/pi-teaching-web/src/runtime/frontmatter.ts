import { stringify as stringifyYaml } from 'yaml';
import { parseLessonSource, StudyDocumentError } from '../study/markdown';
import { mutateDocumentAtomically } from './atomic-document';

export function replaceFrontmatterField(
  source: string,
  path: string,
  field: string,
  value: unknown,
  expected?: unknown,
): string {
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
  const newline = match[1]!.includes('\r\n') ? '\r\n' : '\n';
  const frontmatter = `${match[1]}${lines.join(newline)}${match[3]}`;
  return `${frontmatter}${source.slice(match[0].length)}`;
}

export function setFrontmatterField(
  root: string,
  path: string,
  field: string,
  value: unknown,
  expected?: unknown,
): void {
  const validate = path.startsWith('lessons/')
    ? (source: string) => parseLessonSource(path, source)
    : () => undefined;
  mutateDocumentAtomically(
    root,
    path,
    (source) => ({
      source: replaceFrontmatterField(source, path, field, value, expected),
      value: undefined,
    }),
    validate,
  );
}

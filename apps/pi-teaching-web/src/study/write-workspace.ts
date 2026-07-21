import { readFileSync, writeFileSync } from 'node:fs';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';

export type RouteChangeInput = {
  action: 'insert' | 'skip' | 'move' | 'repeat';
  blockId: string;
  reason: string;
  source: string;
  before?: string;
  after?: string;
};

function read(root: string, path: string): { absolute: string; source: string } {
  const absolute = resolveInsideRoot(root, path);
  return { absolute, source: readFileSync(absolute, 'utf8') };
}

function write(absolute: string, source: string): void {
  writeFileSync(absolute, source.endsWith('\n') ? source : `${source}\n`);
}

export function setFrontmatterField(root: string, path: string, key: string, value: string): void {
  const document = read(root, path);
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(document.source);
  if (!match) throw new Error(`FRONTMATTER_REQUIRED: ${path}`);
  const line = new RegExp(`^${key}:.*$`, 'm');
  const body = line.test(match[2]!)
    ? match[2]!.replace(line, `${key}: ${value}`)
    : `${match[2]}\n${key}: ${value}`;
  write(document.absolute, document.source.replace(match[0], `${match[1]}${body}${match[3]}`));
}

export function setBlockStatus(
  root: string,
  lessonPath: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): void {
  const document = read(root, lessonPath);
  const heading = new RegExp(`^## Block ${blockId}(?:（[^）]+）)?\\s*$`, 'm');
  const match = heading.exec(document.source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = document.source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? document.source.length : next;
  const block = document.source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  const replacement = state
    ? block.replace(state[0], state[0].replace(/^- Status:.*$/m, `- Status: ${status}`))
    : block.replace(
      match[0],
      `${match[0]}\n\n### Node State\n\n- Kind: dialogue\n- Required: true\n- Status: ${status}\n- Depends on:\n- Uses:`,
    );
  write(
    document.absolute,
    document.source.slice(0, match.index) + replacement + document.source.slice(end),
  );
}

export function appendRouteChange(root: string, lessonPath: string, input: RouteChangeInput): void {
  const document = read(root, lessonPath);
  if (!document.source.includes(`## Block ${input.blockId}`)) {
    throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  }
  const ids = [...document.source.matchAll(/^### Route change route-(\d+)$/gm)]
    .map((match) => Number(match[1]));
  const id = `route-${String(Math.max(0, ...ids) + 1).padStart(3, '0')}`;
  const heading = document.source.includes('\n## Route Changes\n') ? '' : '\n## Route Changes\n';
  const placement = input.before
    ? `\n- Before: ${input.before}`
    : input.after
      ? `\n- After: ${input.after}`
      : '';
  write(
    document.absolute,
    `${document.source.trimEnd()}${heading}\n### Route change ${id}\n\n- Action: ${input.action}\n- Block: ${input.blockId}${placement}\n- Reason: ${input.reason}\n- Source: ${input.source}\n`,
  );
}

function replaceSection(source: string, heading: string, value: string): string {
  const pattern = new RegExp(`(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  if (!pattern.test(source)) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  return source.replace(pattern, `$1\n${value.trim()}\n\n`);
}

export function closeLesson(
  root: string,
  lessonPath: string,
  input: { reflection: string; summary: string },
): void {
  const document = read(root, lessonPath);
  let source = replaceSection(document.source, 'Reflection', input.reflection);
  source = replaceSection(source, 'Lesson Summary', input.summary);
  write(document.absolute, source);
  setFrontmatterField(root, lessonPath, 'status', 'closed');
}

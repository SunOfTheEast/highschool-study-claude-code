import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import {
  appendRouteChangeSource,
  transitionClassroomSource,
  type ClassroomTransitionInput,
} from './classroom-transition';

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

function replaceFrontmatterField(
  source: string,
  path: string,
  key: string,
  value: string,
): string {
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(source);
  if (!match) throw new Error(`FRONTMATTER_REQUIRED: ${path}`);
  const line = new RegExp(`^${key}:.*$`, 'm');
  const body = line.test(match[2]!)
    ? match[2]!.replace(line, `${key}: ${value}`)
    : `${match[2]}\n${key}: ${value}`;
  return source.replace(match[0], `${match[1]}${body}${match[3]}`);
}

export function setFrontmatterField(
  root: string,
  path: string,
  key: string,
  value: string,
): void {
  const document = read(root, path);
  write(
    document.absolute,
    replaceFrontmatterField(document.source, path, key, value),
  );
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): string {
  const escaped = blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(
    `^## Block ${escaped}(?:（[^）]+）)?\\s*$`,
    'm',
  );
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  if (!state) throw new Error(`BLOCK_STATE_REQUIRED: ${blockId}`);
  const replacement = block.replace(
    state[0],
    state[0].replace(/^- Status:.*$/m, `- Status: ${status}`),
  );
  return source.slice(0, match.index) + replacement + source.slice(end);
}

export function setBlockStatus(
  root: string,
  lessonPath: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): void {
  const document = read(root, lessonPath);
  write(
    document.absolute,
    replaceBlockStatus(document.source, blockId, status),
  );
}

export function appendRouteChange(
  root: string,
  lessonPath: string,
  input: RouteChangeInput,
): void {
  const document = read(root, lessonPath);
  if (!document.source.includes(`## Block ${input.blockId}`)) {
    throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  }
  write(
    document.absolute,
    appendRouteChangeSource(document.source, input),
  );
}

export function applyClassroomTransition(
  root: string,
  lessonPath: string,
  input: ClassroomTransitionInput,
): void {
  const document = read(root, lessonPath);
  write(
    document.absolute,
    transitionClassroomSource(document.source, input),
  );
}

function replaceSection(
  source: string,
  heading: string,
  value: string,
): string {
  const pattern = new RegExp(
    `(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`,
    'm',
  );
  if (!pattern.test(source)) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  return source.replace(
    pattern,
    (_match, sectionHeading: string) => (
      `${sectionHeading}\n${value.trim()}\n\n`
    ),
  );
}

export type LessonCloseInput = {
  summary: string;
};

export function closeLesson(
  root: string,
  lessonPath: string,
  input: LessonCloseInput,
): void {
  const document = read(root, lessonPath);
  const status = readMarkdownFile(root, lessonPath).frontmatter.status;
  if (status === 'closed' || status === 'abandoned') {
    throw new Error(`LESSON_ALREADY_TERMINAL: ${status}`);
  }
  let source = replaceSection(document.source, 'Lesson Summary', input.summary);
  source = replaceFrontmatterField(source, lessonPath, 'status', 'closed');
  write(document.absolute, source);
}

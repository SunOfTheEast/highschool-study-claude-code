import { readFileSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  ACTIVITY_KINDS,
  BLOCK_STATUSES,
  LESSON_STATUSES,
  PLAN_STATUSES,
  type ActivityBlock,
  type ActivityKind,
  type BlockStatus,
  type CourseSnapshot,
  type CourseTreeNode,
  type LessonDocument,
  type LessonStatus,
  type NodeReference,
  type PlanDocument,
  type PlanStatus,
  type RoadmapDocument,
} from '../shared/contracts';

type Frontmatter = Record<string, unknown>;

type MarkdownSection = {
  heading: string;
  content: string;
};

export class StudyDocumentError extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${path}: ${reason}`);
    this.name = 'StudyDocumentError';
  }
}

function normalizedRelativePath(root: string, requestedPath: string): string {
  if (requestedPath.length === 0 || isAbsolute(requestedPath)) {
    throw new StudyDocumentError(requestedPath, 'path must be relative to the learning set');
  }
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, requestedPath);
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new StudyDocumentError(requestedPath, 'path escapes the learning set');
  }
  return relative(absoluteRoot, absolutePath).split(sep).join('/');
}

function readSource(root: string, requestedPath: string): {
  path: string;
  raw: string;
  frontmatter: Frontmatter;
  body: string;
} {
  const path = normalizedRelativePath(root, requestedPath);
  let raw: string;
  try {
    raw = readFileSync(resolve(root, path), 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unable to read file';
    throw new StudyDocumentError(path, detail);
  }

  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) throw new StudyDocumentError(path, 'missing YAML frontmatter');
  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(match[1]!);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid YAML frontmatter';
    throw new StudyDocumentError(path, detail);
  }
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new StudyDocumentError(path, 'frontmatter must be a mapping');
  }
  return {
    path,
    raw,
    frontmatter: frontmatter as Frontmatter,
    body: raw.slice(match[0].length),
  };
}

function requiredString(
  frontmatter: Frontmatter,
  key: string,
  path: string,
): string {
  const value = frontmatter[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new StudyDocumentError(path, `frontmatter.${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalSessionId(frontmatter: Frontmatter, path: string): string | null {
  const value = frontmatter.session_id;
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new StudyDocumentError(path, 'frontmatter.session_id must be a string or null');
  }
  return value.trim();
}

function requireLiteral(
  frontmatter: Frontmatter,
  key: string,
  expected: string,
  path: string,
): void {
  if (frontmatter[key] !== expected) {
    throw new StudyDocumentError(path, `frontmatter.${key} must be ${expected}`);
  }
}

function requiredEnum<T extends string>(
  frontmatter: Frontmatter,
  key: string,
  values: readonly T[],
  path: string,
): T {
  const value = frontmatter[key];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new StudyDocumentError(path, `frontmatter.${key} must be one of ${values.join(', ')}`);
  }
  return value as T;
}

function readTitle(body: string, path: string): string {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  if (!match) throw new StudyDocumentError(path, 'missing document title');
  return match[1]!.trim();
}

function splitSections(source: string, level: 2 | 3): MarkdownSection[] {
  const prefix = '#'.repeat(level);
  const matcher = new RegExp(`^${prefix}\\s+(.+?)\\s*$`, 'gm');
  const headings = [...source.matchAll(matcher)];
  return headings.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    return {
      heading: match[1]!.trim(),
      content: source.slice(start, end).trim(),
    };
  });
}

function oneSection(
  sections: MarkdownSection[],
  heading: string,
  path: string,
  allowEmpty = false,
): string {
  const matches = sections.filter((section) => section.heading === heading);
  if (matches.length !== 1) {
    throw new StudyDocumentError(path, `expected exactly one "${heading}" section`);
  }
  if (!allowEmpty && matches[0]!.content.length === 0) {
    throw new StudyDocumentError(path, `section "${heading}" cannot be empty`);
  }
  return matches[0]!.content;
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizedTreePath(requestedPath: string, ownerPath: string): string {
  if (
    requestedPath.length === 0
    || isAbsolute(requestedPath)
    || requestedPath.includes('\\')
  ) {
    throw new StudyDocumentError(ownerPath, `invalid child path ${requestedPath}`);
  }
  const normalized = posix.normalize(requestedPath);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new StudyDocumentError(ownerPath, `child path escapes the learning set: ${requestedPath}`);
  }
  return normalized;
}

function parseTree(content: string, path: string, childKind: 'plan' | 'lesson'): NodeReference[] {
  const lines = content.split(/\r?\n/);
  const entries: NodeReference[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!.trimEnd();
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    const match = /^- \[([A-Za-z0-9][A-Za-z0-9._-]*) \| ([^\]]+)\]\(([^)]+)\)$/.exec(line);
    if (!match) {
      throw new StudyDocumentError(path, `invalid ${childKind} tree entry: ${line}`);
    }
    const id = match[1]!;
    const title = match[2]!.trim();
    const childPath = normalizedTreePath(match[3]!, path);
    let after: string | null | undefined;
    let dependsOn: string[] | undefined;
    index += 1;
    while (index < lines.length && /^\s{2,}- /.test(lines[index]!)) {
      const metadata = /^\s{2,}- (After|Depends on):\s*(.*?)\s*$/.exec(lines[index]!);
      if (!metadata) {
        throw new StudyDocumentError(path, `invalid ${childKind} tree metadata: ${lines[index]}`);
      }
      if (metadata[1] === 'After') after = metadata[2]!.trim() || null;
      else dependsOn = parseCommaList(metadata[2]!);
      index += 1;
    }
    if (after === undefined || dependsOn === undefined) {
      throw new StudyDocumentError(path, `${childKind} ${id} requires After and Depends on metadata`);
    }
    entries.push({ id, path: childPath, title, after, dependsOn });
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new StudyDocumentError(path, `duplicate child id ${entry.id}`);
    if (paths.has(entry.path)) throw new StudyDocumentError(path, `duplicate child path ${entry.path}`);
    ids.add(entry.id);
    paths.add(entry.path);
  }
  return entries;
}

function parseState(content: string, path: string, blockId: string): {
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
} {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const match = /^- (Kind|Required|Status|Depends on|Uses):\s*(.*?)\s*$/.exec(line);
    if (!match) throw new StudyDocumentError(path, `invalid Node State line in ${blockId}: ${line}`);
    if (values.has(match[1]!)) {
      throw new StudyDocumentError(path, `duplicate ${match[1]} in ${blockId}`);
    }
    values.set(match[1]!, match[2]!);
  }
  for (const key of ['Kind', 'Required', 'Status', 'Depends on', 'Uses']) {
    if (!values.has(key)) throw new StudyDocumentError(path, `${blockId} is missing ${key}`);
  }
  const kind = values.get('Kind')!;
  const status = values.get('Status')!;
  if (!ACTIVITY_KINDS.includes(kind as ActivityKind)) {
    throw new StudyDocumentError(path, `${blockId} has invalid Kind ${kind}`);
  }
  if (!BLOCK_STATUSES.includes(status as BlockStatus)) {
    throw new StudyDocumentError(path, `${blockId} has invalid Status ${status}`);
  }
  const required = values.get('Required');
  if (required !== 'true' && required !== 'false') {
    throw new StudyDocumentError(path, `${blockId} Required must be true or false`);
  }
  return {
    kind: kind as ActivityKind,
    required: required === 'true',
    status: status as BlockStatus,
    dependsOn: parseCommaList(values.get('Depends on')!),
    uses: parseCommaList(values.get('Uses')!),
  };
}

function parseLog(content: string, path: string, blockId: string): string[] {
  if (content.trim().length === 0) return [];
  const entries: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const item = /^-\s+(.+)$/.exec(line);
    if (item) {
      entries.push(item[1]!.trim());
      continue;
    }
    if (/^\s{2,}\S/.test(line) && entries.length > 0) {
      entries[entries.length - 1] = `${entries.at(-1)} ${line.trim()}`;
      continue;
    }
    throw new StudyDocumentError(path, `${blockId} Classroom Log must contain Markdown list items`);
  }
  return entries;
}

function parseBlock(section: MarkdownSection, path: string): ActivityBlock {
  const heading = /^Block\s+([A-Za-z0-9][A-Za-z0-9._-]*)(?:\s*[：:]\s*(.+))?$/.exec(section.heading);
  if (!heading) throw new StudyDocumentError(path, `invalid Block heading "${section.heading}"`);
  const id = heading[1]!;
  const title = heading[2]?.trim() || id;
  const sections = splitSections(section.content, 3);
  const allowed = new Set(['Node State', 'Student View', 'Teacher Control', 'Classroom Log']);
  for (const nested of sections) {
    if (!allowed.has(nested.heading)) {
      throw new StudyDocumentError(path, `${id} has unsupported section "${nested.heading}"`);
    }
  }
  const state = parseState(oneSection(sections, 'Node State', path), path, id);
  const studentView = oneSection(sections, 'Student View', path);
  const teacherControl = oneSection(sections, 'Teacher Control', path);
  const logSections = sections.filter((nested) => nested.heading === 'Classroom Log');
  if (logSections.length !== 1) {
    throw new StudyDocumentError(path, `${id} requires exactly one Classroom Log section`);
  }
  return {
    id,
    title,
    ...state,
    studentView,
    teacherControl,
    classroomLog: parseLog(logSections[0]!.content, path, id),
  };
}

export function readRoadmap(root: string): RoadmapDocument {
  const source = readSource(root, 'ROADMAP.md');
  requireLiteral(source.frontmatter, 'id', 'roadmap', source.path);
  requireLiteral(source.frontmatter, 'kind', 'roadmap', source.path);
  requireLiteral(source.frontmatter, 'status', 'active', source.path);
  const sections = splitSections(source.body, 2);
  return {
    id: 'roadmap',
    kind: 'roadmap',
    status: 'active',
    sessionId: optionalSessionId(source.frontmatter, source.path),
    path: 'ROADMAP.md',
    title: readTitle(source.body, source.path),
    overview: oneSection(sections, 'Overview', source.path),
    longTermGoal: oneSection(sections, 'Long-term Goal', source.path),
    capabilityStandard: oneSection(sections, 'Observable Capability Standard', source.path),
    test: oneSection(sections, 'Test', source.path),
    plans: parseTree(oneSection(sections, 'Plan Tree', source.path, true), source.path, 'plan'),
    currentPosition: oneSection(sections, 'Current Position', source.path),
    raw: source.raw,
  };
}

export function readPlan(root: string, requestedPath: string): PlanDocument {
  const source = readSource(root, requestedPath);
  requireLiteral(source.frontmatter, 'kind', 'plan', source.path);
  const status = requiredEnum<PlanStatus>(source.frontmatter, 'status', PLAN_STATUSES, source.path);
  const sections = splitSections(source.body, 2);
  return {
    id: requiredString(source.frontmatter, 'id', source.path),
    kind: 'plan',
    status,
    sessionId: optionalSessionId(source.frontmatter, source.path),
    path: source.path,
    parentId: requiredString(source.frontmatter, 'parent_id', source.path),
    parentPath: requiredString(source.frontmatter, 'parent_path', source.path) as 'ROADMAP.md',
    title: readTitle(source.body, source.path),
    stageGoal: oneSection(sections, 'Stage Goal', source.path),
    capabilityStandard: oneSection(sections, 'Observable Capability Standard', source.path),
    test: oneSection(sections, 'Test', source.path),
    lessons: parseTree(oneSection(sections, 'Lesson Tree', source.path, true), source.path, 'lesson'),
    currentPosition: oneSection(sections, 'Current Position', source.path),
    nextLessonArrangement: oneSection(sections, 'Next Lesson Arrangement', source.path),
    raw: source.raw,
  };
}

export function readLesson(root: string, requestedPath: string): LessonDocument {
  const source = readSource(root, requestedPath);
  requireLiteral(source.frontmatter, 'kind', 'lesson', source.path);
  const status = requiredEnum<LessonStatus>(source.frontmatter, 'status', LESSON_STATUSES, source.path);
  const sections = splitSections(source.body, 2);
  for (const section of sections) {
    if (section.heading !== 'Lesson Goal' && !section.heading.startsWith('Block ')) {
      throw new StudyDocumentError(source.path, `unsupported Lesson section "${section.heading}"`);
    }
  }
  const blockSections = sections.filter((section) => section.heading.startsWith('Block '));
  if (blockSections.length === 0) throw new StudyDocumentError(source.path, 'Lesson requires at least one Block');
  const blocks = blockSections.map((section) => parseBlock(section, source.path));
  const ids = new Set<string>();
  for (const block of blocks) {
    if (ids.has(block.id)) throw new StudyDocumentError(source.path, `duplicate Block id ${block.id}`);
    ids.add(block.id);
  }
  for (const block of blocks) {
    for (const dependency of block.dependsOn) {
      if (!ids.has(dependency) || dependency === block.id) {
        throw new StudyDocumentError(source.path, `${block.id} has invalid dependency ${dependency}`);
      }
    }
  }
  return {
    id: requiredString(source.frontmatter, 'id', source.path),
    kind: 'lesson',
    status,
    sessionId: optionalSessionId(source.frontmatter, source.path),
    path: source.path,
    parentId: requiredString(source.frontmatter, 'parent_id', source.path),
    parentPath: requiredString(source.frontmatter, 'parent_path', source.path),
    title: readTitle(source.body, source.path),
    lessonGoal: oneSection(sections, 'Lesson Goal', source.path),
    blocks,
    raw: source.raw,
  };
}

function readGuide(root: string): CourseSnapshot['guide'] {
  const source = readSource(root, 'LEARNING_GUIDE.md');
  const title = typeof source.frontmatter.title === 'string'
    ? source.frontmatter.title.trim()
    : readTitle(source.body, source.path);
  if (!title) throw new StudyDocumentError(source.path, 'guide title cannot be empty');
  return { title, body: source.body.trim(), raw: source.raw };
}

export function readCourseTree(root: string): CourseSnapshot {
  const roadmap = readRoadmap(root);
  const seenNodeIds = new Set([roadmap.id]);
  const planNodes: CourseTreeNode[] = roadmap.plans.map((reference) => {
    const plan = readPlan(root, reference.path);
    if (plan.id !== reference.id) {
      throw new StudyDocumentError(reference.path, `tree id ${reference.id} does not match child id ${plan.id}`);
    }
    if (plan.parentId !== roadmap.id || plan.parentPath !== roadmap.path) {
      throw new StudyDocumentError(reference.path, 'Plan parent does not match ROADMAP.md');
    }
    if (seenNodeIds.has(plan.id)) throw new StudyDocumentError(reference.path, `duplicate node id ${plan.id}`);
    seenNodeIds.add(plan.id);
    const lessonNodes = plan.lessons.map((lessonReference): CourseTreeNode => {
      const lesson = readLesson(root, lessonReference.path);
      if (lesson.id !== lessonReference.id) {
        throw new StudyDocumentError(
          lessonReference.path,
          `tree id ${lessonReference.id} does not match child id ${lesson.id}`,
        );
      }
      if (lesson.parentId !== plan.id || lesson.parentPath !== plan.path) {
        throw new StudyDocumentError(lessonReference.path, `Lesson parent does not match ${plan.path}`);
      }
      if (seenNodeIds.has(lesson.id)) {
        throw new StudyDocumentError(lessonReference.path, `duplicate node id ${lesson.id}`);
      }
      seenNodeIds.add(lesson.id);
      return {
        kind: 'lesson',
        id: lesson.id,
        path: lesson.path,
        title: lessonReference.title,
        status: lesson.status,
        sessionKey: `lesson:${lesson.id}`,
        after: lessonReference.after,
        dependsOn: lessonReference.dependsOn,
        children: [],
      };
    });
    return {
      kind: 'plan',
      id: plan.id,
      path: plan.path,
      title: reference.title,
      status: plan.status,
      sessionKey: `plan:${plan.id}`,
      after: reference.after,
      dependsOn: reference.dependsOn,
      children: lessonNodes,
    };
  });

  const tree: CourseTreeNode = {
    kind: 'roadmap',
    id: roadmap.id,
    path: roadmap.path,
    title: roadmap.title,
    status: roadmap.status,
    sessionKey: `roadmap:${roadmap.id}`,
    after: null,
    dependsOn: [],
    children: planNodes,
  };
  return { guide: readGuide(root), roadmap, tree, selected: null };
}

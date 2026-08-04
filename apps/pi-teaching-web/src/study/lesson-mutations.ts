import { existsSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import {
  ACTIVITY_KINDS,
  type ActivityBlock,
  type ActivityKind,
  type LessonDocument,
} from '../shared/contracts';
import { StudyDocumentError, parseLessonSource } from './markdown';

export type BlockPlacement = {
  position: 'before' | 'after';
  anchorBlockId: string;
};

export type LessonBlockDraft = {
  title: string;
  kind: ActivityKind;
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type ClassroomChange =
  | { command: 'start'; blockId: string }
  | {
    command: 'advance';
    outcome: 'completed' | 'skipped';
    nextBlockId: string | null;
  }
  | { command: 'insert'; placement: BlockPlacement; block: LessonBlockDraft }
  | { command: 'revise'; blockId: string; block: LessonBlockDraft }
  | { command: 'move'; blockId: string; placement: BlockPlacement }
  | { command: 'skip_pending'; blockId: string };

export type ClassroomMutationReceipt = {
  source: string;
  command: ClassroomChange['command'];
  createdBlockId: string | null;
  activeBlockId: string | null;
  eligibleBlockIds: string[];
};

type SourceSpan = {
  start: number;
  end: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockSpan(path: string, source: string, blockId: string): SourceSpan {
  const heading = new RegExp(
    `^## Block ${escapeRegExp(blockId)}(?:[ \\t]*[：:][ \\t]*.+)?[ \\t]*$`,
    'm',
  ).exec(source);
  if (!heading) throw new StudyDocumentError(path, `Block ${blockId} is missing`);
  const tail = source.slice(heading.index + heading[0].length);
  const next = /^##\s+/m.exec(tail);
  return {
    start: heading.index,
    end: next ? heading.index + heading[0].length + next.index : source.length,
  };
}

type BlockSourceSpan = SourceSpan & {
  id: string;
  source: string;
};

function blockSpans(path: string, source: string): BlockSourceSpan[] {
  const headings = [...source.matchAll(
    /^## Block ([A-Za-z0-9][A-Za-z0-9._-]*)(?:[ \t]*[：:][ \t]*.+)?[ \t]*$/gm,
  )];
  if (headings.length === 0) throw new StudyDocumentError(path, 'Lesson requires at least one Block');
  return headings.map((heading, index) => {
    const start = heading.index!;
    const end = headings[index + 1]?.index ?? source.length;
    return {
      id: heading[1]!,
      start,
      end,
      source: source.slice(start, end).trimEnd(),
    };
  });
}

function classroomLogContentSpan(
  path: string,
  source: string,
  blockId: string,
): SourceSpan {
  const block = blockSpan(path, source, blockId);
  const blockSource = source.slice(block.start, block.end);
  const heading = /^### Classroom Log[ \t]*$/m.exec(blockSource);
  if (!heading) {
    throw new StudyDocumentError(path, `${blockId} requires exactly one Classroom Log section`);
  }
  const start = block.start + heading.index + heading[0].length;
  const tail = source.slice(start, block.end);
  const next = /^###\s+/m.exec(tail);
  return { start, end: next ? start + next.index : block.end };
}

function renderLogItem(note: string, path: string): string {
  const normalized = note.trim();
  if (!normalized) throw new StudyDocumentError(path, 'classroom note cannot be empty');
  const lines = normalized.split(/\r?\n/).map((line) => line.trimEnd());
  return [`- ${lines[0]!}`, ...lines.slice(1).map((line) => `  ${line}`)].join('\n');
}

export function appendClassroomLogSource(
  path: string,
  source: string,
  note: string,
): string {
  const lesson = parseLessonSource(path, source);
  if (lesson.status !== 'active') {
    throw new StudyDocumentError(path, `Lesson must be active, found ${lesson.status}`);
  }
  const active = lesson.blocks.filter((block) => block.status === 'active');
  if (active.length !== 1) {
    throw new StudyDocumentError(path, `expected exactly one active Block, found ${active.length}`);
  }

  const span = classroomLogContentSpan(path, source, active[0]!.id);
  const content = source.slice(span.start, span.end);
  const rendered = renderLogItem(note, path);
  const candidate = !content.trim()
    ? `${source.slice(0, span.start)}\n\n${rendered}${source.slice(span.start)}`
    : (() => {
        const trailing = /\s*$/.exec(content)?.[0].length ?? 0;
        const insertion = span.end - trailing;
        return `${source.slice(0, insertion)}\n${rendered}${source.slice(insertion)}`;
      })();
  parseLessonSource(path, candidate);
  return candidate;
}

function requireActiveLesson(path: string, source: string): LessonDocument {
  const lesson = parseLessonSource(path, source);
  if (lesson.status !== 'active') {
    throw new StudyDocumentError(path, `Lesson must be active, found ${lesson.status}`);
  }
  const active = lesson.blocks.filter((block) => block.status === 'active');
  if (active.length > 1) {
    throw new StudyDocumentError(path, `expected at most one active Block, found ${active.length}`);
  }
  return lesson;
}

function currentActive(lesson: LessonDocument): ActivityBlock | null {
  return lesson.blocks.find((block) => block.status === 'active') ?? null;
}

function blockById(
  lesson: LessonDocument,
  blockId: string,
  path: string,
): ActivityBlock {
  const block = lesson.blocks.find((candidate) => candidate.id === blockId);
  if (!block) throw new StudyDocumentError(path, `Block ${blockId} is missing`);
  return block;
}

function dependenciesResolved(block: ActivityBlock, lesson: LessonDocument): boolean {
  const byId = new Map(lesson.blocks.map((candidate) => [candidate.id, candidate]));
  return block.dependsOn.every((dependency) => {
    const status = byId.get(dependency)?.status;
    return status === 'completed' || status === 'skipped';
  });
}

function replaceBlockStatus(
  path: string,
  source: string,
  blockId: string,
  status: ActivityBlock['status'],
): string {
  const span = blockSpan(path, source, blockId);
  const block = source.slice(span.start, span.end);
  const state = /^### Node State[ \t]*$\n([\s\S]*?)(?=^###\s+|(?![\s\S]))/m.exec(block);
  if (!state || !/^- Status:.*$/m.test(state[0])) {
    throw new StudyDocumentError(path, `${blockId} has invalid Node State`);
  }
  const next = block.replace(
    state[0],
    state[0].replace(/^- Status:.*$/m, `- Status: ${status}`),
  );
  return source.slice(0, span.start) + next + source.slice(span.end);
}

function validateDraft(path: string, draft: LessonBlockDraft): void {
  if (!draft.title.trim() || /[\r\n]/.test(draft.title)) {
    throw new StudyDocumentError(path, 'Block title must be one non-empty line');
  }
  if (!ACTIVITY_KINDS.includes(draft.kind)) {
    throw new StudyDocumentError(path, `invalid Block Kind ${String(draft.kind)}`);
  }
  if (typeof draft.required !== 'boolean') {
    throw new StudyDocumentError(path, 'Block Required must be boolean');
  }
  if (!draft.studentView.trim() || !draft.teacherControl.trim()) {
    throw new StudyDocumentError(path, 'Block Student View and Teacher Control cannot be empty');
  }
}

function validateUsePath(root: string, lessonPath: string, requestedPath: string): void {
  if (!requestedPath || isAbsolute(requestedPath) || requestedPath.includes('\\')) {
    throw new StudyDocumentError(lessonPath, `Uses path is invalid: ${requestedPath}`);
  }
  const normalized = posix.normalize(requestedPath);
  if (normalized !== requestedPath || normalized === '..' || normalized.startsWith('../')) {
    throw new StudyDocumentError(lessonPath, `Uses path escapes the learning set: ${requestedPath}`);
  }
  const isCard = normalized.startsWith('cards/')
    && ['.yaml', '.yml'].includes(extname(normalized).toLowerCase());
  const isMaterial = normalized.startsWith('materials/');
  if (!isCard && !isMaterial) {
    throw new StudyDocumentError(lessonPath, `Uses path has unsupported source type: ${requestedPath}`);
  }
  const absoluteRoot = realpathSync(root);
  const absolute = resolve(root, normalized);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new StudyDocumentError(lessonPath, `Uses path does not exist: ${requestedPath}`);
  }
  const real = realpathSync(absolute);
  const inside = relative(absoluteRoot, real);
  if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new StudyDocumentError(lessonPath, `Uses path escapes the learning set: ${requestedPath}`);
  }
}

function validateDraftUses(
  root: string,
  path: string,
  draft: LessonBlockDraft,
  active: ActivityBlock | null,
  retained: ActivityBlock | null = null,
): void {
  const allowed = new Set([
    ...(active?.uses ?? []),
    ...(retained?.uses ?? []),
  ]);
  for (const use of draft.uses) {
    if (!allowed.has(use)) {
      throw new StudyDocumentError(path, `Uses path is outside the current evidence boundary: ${use}`);
    }
    validateUsePath(root, path, use);
  }
}

function renderBlock(
  id: string,
  draft: LessonBlockDraft,
  status: ActivityBlock['status'] = 'pending',
  classroomLog: string[] = [],
): string {
  const lines = [
    `## Block ${id}：${draft.title.trim()}`,
    '',
    '### Node State',
    '',
    `- Kind: ${draft.kind}`,
    `- Required: ${String(draft.required)}`,
    `- Status: ${status}`,
    `- Depends on: ${draft.dependsOn.join(', ')}`,
    `- Uses: ${draft.uses.join(', ')}`,
    '',
    '### Student View',
    '',
    draft.studentView.trim(),
    '',
    '### Teacher Control',
    '',
    draft.teacherControl.trim(),
    '',
    '### Classroom Log',
  ];
  for (const item of classroomLog) lines.push('', `- ${item}`);
  return lines.join('\n');
}

function nextBlockId(lesson: LessonDocument): string {
  const maximum = lesson.blocks
    .map((block) => /^block-(\d+)$/.exec(block.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
    .reduce((current, value) => Math.max(current, value), 0);
  return `block-${String(maximum + 1).padStart(3, '0')}`;
}

function insertAtPlacement(
  path: string,
  source: string,
  placement: BlockPlacement,
  rendered: string,
): string {
  const anchor = blockSpans(path, source)
    .find((candidate) => candidate.id === placement.anchorBlockId);
  if (!anchor) {
    throw new StudyDocumentError(path, `placement anchor ${placement.anchorBlockId} is missing`);
  }
  const position = placement.position === 'before' ? anchor.start : anchor.end;
  const prefix = source.slice(0, position).trimEnd();
  const suffix = source.slice(position).trimStart();
  return `${prefix}\n\n${rendered}${suffix ? `\n\n${suffix}` : '\n'}`;
}

function replaceBlockSection(
  path: string,
  source: string,
  blockId: string,
  rendered: string,
): string {
  const span = blockSpan(path, source, blockId);
  const prefix = source.slice(0, span.start).trimEnd();
  const suffix = source.slice(span.end).trimStart();
  return `${prefix}\n\n${rendered}${suffix ? `\n\n${suffix}` : '\n'}`;
}

function moveBlockSection(
  path: string,
  source: string,
  blockId: string,
  placement: BlockPlacement,
): string {
  if (blockId === placement.anchorBlockId) {
    throw new StudyDocumentError(path, `Block ${blockId} cannot be placed relative to itself`);
  }
  const moving = blockSpans(path, source).find((candidate) => candidate.id === blockId);
  if (!moving) throw new StudyDocumentError(path, `Block ${blockId} is missing`);
  const without = `${source.slice(0, moving.start).trimEnd()}\n\n${
    source.slice(moving.end).trimStart()
  }`;
  return insertAtPlacement(path, without, placement, moving.source);
}

function same(value: unknown): string {
  return JSON.stringify(value);
}

function withoutStatus(block: ActivityBlock): Omit<ActivityBlock, 'status'> {
  const { status: _status, ...rest } = block;
  return rest;
}

function assertMutationBoundary(
  path: string,
  before: LessonDocument,
  after: LessonDocument,
  change: ClassroomChange,
): void {
  const identity = (lesson: LessonDocument) => ({
    id: lesson.id,
    kind: lesson.kind,
    status: lesson.status,
    sessionId: lesson.sessionId,
    path: lesson.path,
    parentId: lesson.parentId,
    parentPath: lesson.parentPath,
    title: lesson.title,
    lessonGoal: lesson.lessonGoal,
  });
  if (same(identity(before)) !== same(identity(after))) {
    throw new StudyDocumentError(path, 'classroom mutation changed Lesson identity or goal');
  }
  const afterById = new Map(after.blocks.map((block) => [block.id, block]));
  for (const block of before.blocks) {
    const next = afterById.get(block.id);
    if (!next) throw new StudyDocumentError(path, `classroom mutation removed ${block.id}`);
    if (change.command === 'revise' && change.blockId === block.id) {
      if (
        next.id !== block.id
        || next.status !== block.status
        || same(next.classroomLog) !== same(block.classroomLog)
      ) {
        throw new StudyDocumentError(path, `revise changed protected facts in ${block.id}`);
      }
      continue;
    }
    if (change.command === 'start' || change.command === 'advance' || change.command === 'skip_pending') {
      if (same(withoutStatus(next)) !== same(withoutStatus(block))) {
        throw new StudyDocumentError(path, `status command changed content in ${block.id}`);
      }
      continue;
    }
    if (same(next) !== same(block)) {
      throw new StudyDocumentError(path, `${change.command} changed protected content in ${block.id}`);
    }
  }
}

function mutationReceipt(
  source: string,
  path: string,
  command: ClassroomChange['command'],
  createdBlockId: string | null,
): ClassroomMutationReceipt {
  const lesson = parseLessonSource(path, source);
  const active = currentActive(lesson);
  const eligibleBlockIds = active
    ? []
    : lesson.blocks
        .filter((block) => block.status === 'pending' && dependenciesResolved(block, lesson))
        .map((block) => block.id);
  return {
    source,
    command,
    createdBlockId,
    activeBlockId: active?.id ?? null,
    eligibleBlockIds,
  };
}

export function applyClassroomChange(
  root: string,
  path: string,
  source: string,
  change: ClassroomChange,
): ClassroomMutationReceipt {
  const before = requireActiveLesson(path, source);
  const active = currentActive(before);
  let candidate: string;
  let createdBlockId: string | null = null;

  if (change.command === 'start') {
    if (active) throw new StudyDocumentError(path, `active Block already exists: ${active.id}`);
    const target = blockById(before, change.blockId, path);
    if (target.status !== 'pending') {
      throw new StudyDocumentError(path, `start requires a pending Block: ${target.id}`);
    }
    if (!dependenciesResolved(target, before)) {
      throw new StudyDocumentError(path, `Block ${target.id} has unresolved dependencies`);
    }
    candidate = replaceBlockStatus(path, source, target.id, 'active');
  } else if (change.command === 'advance') {
    if (!active) throw new StudyDocumentError(path, 'advance requires one active Block');
    if (active.classroomLog.length === 0) {
      throw new StudyDocumentError(path, `${active.id} Classroom Log requires evidence before advance`);
    }
    candidate = replaceBlockStatus(path, source, active.id, change.outcome);
    if (change.nextBlockId !== null) {
      const intermediate = parseLessonSource(path, candidate);
      const target = blockById(intermediate, change.nextBlockId, path);
      if (target.status !== 'pending') {
        throw new StudyDocumentError(path, `advance successor must be pending: ${target.id}`);
      }
      if (!dependenciesResolved(target, intermediate)) {
        throw new StudyDocumentError(path, `Block ${target.id} has unresolved dependencies`);
      }
      candidate = replaceBlockStatus(path, candidate, target.id, 'active');
    }
  } else if (change.command === 'insert') {
    validateDraft(path, change.block);
    validateDraftUses(root, path, change.block, active);
    createdBlockId = nextBlockId(before);
    candidate = insertAtPlacement(
      path,
      source,
      change.placement,
      renderBlock(createdBlockId, change.block),
    );
  } else if (change.command === 'revise') {
    const target = blockById(before, change.blockId, path);
    if (target.status !== 'pending') {
      throw new StudyDocumentError(path, `revise requires a pending Block: ${target.id}`);
    }
    validateDraft(path, change.block);
    validateDraftUses(root, path, change.block, active, target);
    candidate = replaceBlockSection(
      path,
      source,
      target.id,
      renderBlock(target.id, change.block, target.status, target.classroomLog),
    );
  } else if (change.command === 'move') {
    const target = blockById(before, change.blockId, path);
    if (target.status !== 'pending') {
      throw new StudyDocumentError(path, `move requires a pending Block: ${target.id}`);
    }
    candidate = moveBlockSection(path, source, target.id, change.placement);
  } else if (change.command === 'skip_pending') {
    const target = blockById(before, change.blockId, path);
    if (target.status !== 'pending') {
      throw new StudyDocumentError(path, `skip_pending requires a pending Block: ${target.id}`);
    }
    if (!active || active.classroomLog.length === 0) {
      throw new StudyDocumentError(path, 'skip_pending requires a reason in the active Block Classroom Log');
    }
    candidate = replaceBlockStatus(path, source, target.id, 'skipped');
  } else {
    const exhaustive: never = change;
    throw new StudyDocumentError(path, `unsupported classroom command ${String(exhaustive)}`);
  }

  const after = parseLessonSource(path, candidate);
  if (after.blocks.filter((block) => block.status === 'active').length > 1) {
    throw new StudyDocumentError(path, 'classroom mutation produced multiple active Blocks');
  }
  assertMutationBoundary(path, before, after, change);
  return mutationReceipt(candidate, path, change.command, createdBlockId);
}

import {
  readPreparedLessonBlocks,
  type PreparedLessonBlock,
} from './validate-prepared-lesson';

type BlockStatus = PreparedLessonBlock['status'];
type RouteAction = 'skip' | 'move' | 'repeat';

export type DynamicBlockDraft = {
  kind: 'dialogue' | 'material' | 'problem' | 'reflection';
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type ClassroomTransitionInput =
  | { action: 'activate'; blockId: string }
  | { action: 'complete'; blockId: string }
  | { action: 'skip'; blockId: string }
  | {
      action: 'route';
      routeAction: RouteAction;
      blockId: string;
      before?: string;
      after?: string;
      reason: string;
      source: string;
    }
  | {
      action: 'insert';
      after: string | null;
      block: DynamicBlockDraft;
      reason: string;
      source: string;
    };

export type RouteChangeSourceInput = {
  action: RouteAction | 'insert';
  blockId: string;
  before?: string;
  after?: string;
  reason: string;
  source: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lessonStatus(source: string): string | null {
  const frontmatter = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n/.exec(source)?.[1] ?? '';
  return /^status:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter)?.[1] ?? null;
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: BlockStatus,
): string {
  const heading = new RegExp(
    `^## Block ${escapeRegExp(blockId)}(?:（[^）]+）)?[ \\t]*$`,
    'm',
  );
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /^### Node State[ \t]*$\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/m
    .exec(block);
  if (!state || !/^- Status:.*$/m.test(state[0])) {
    throw new Error(`CLASSROOM_NODE_STATE_INVALID: ${blockId}`);
  }
  const replacement = block.replace(
    state[0],
    state[0].replace(/^- Status:.*$/m, `- Status: ${status}`),
  );
  return source.slice(0, match.index) + replacement + source.slice(end);
}

type BlockSection = {
  id: string;
  start: number;
  end: number;
  source: string;
};

function blockSections(source: string): BlockSection[] {
  const headings = [...source.matchAll(
    /^## Block ([^（\s]+)(?:（[^）]+）)?[ \t]*$/gm,
  )];
  return headings.map((heading) => {
    const tail = source.slice(heading.index! + heading[0].length);
    const next = /^## [^\n]+$/m.exec(tail);
    const end = next === null
      ? source.length
      : heading.index! + heading[0].length + next.index;
    return {
      id: heading[1]!,
      start: heading.index!,
      end,
      source: source.slice(heading.index!, end).trimEnd(),
    };
  });
}

function nextBlockId(blocks: PreparedLessonBlock[]): string {
  const maximum = blocks
    .map((block) => /^block-(\d+)$/.exec(block.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
    .reduce((current, value) => Math.max(current, value), 0);
  return `block-${String(maximum + 1).padStart(3, '0')}`;
}

function validateDynamicBlock(
  blocks: PreparedLessonBlock[],
  block: DynamicBlockDraft,
): void {
  if (!['dialogue', 'material', 'problem', 'reflection'].includes(block.kind)) {
    throw new Error(`DYNAMIC_BLOCK_KIND_INVALID: ${block.kind}`);
  }
  if (!block.studentView.trim() || !block.teacherControl.trim()) {
    throw new Error('DYNAMIC_BLOCK_CONTENT_REQUIRED');
  }
  const known = new Set(blocks.map((candidate) => candidate.id));
  const missing = block.dependsOn.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(`DYNAMIC_BLOCK_DEPENDENCY_NOT_FOUND: ${missing.join(',')}`);
  }
  if (block.kind === 'problem' && block.uses.length !== 1) {
    throw new Error(`DYNAMIC_PROBLEM_CARD_COUNT: ${block.uses.length}`);
  }
  if (block.kind !== 'problem' && block.uses.length !== 0) {
    throw new Error(`DYNAMIC_NON_PROBLEM_CARD_FORBIDDEN: ${block.kind}`);
  }
}

function renderDynamicBlock(id: string, block: DynamicBlockDraft): string {
  return [
    `## Block ${id}（${block.required ? '必做' : '可选'}）`,
    '',
    '### Node State',
    '',
    `- Kind: ${block.kind}`,
    `- Required: ${String(block.required)}`,
    '- Status: pending',
    `- Depends on: ${block.dependsOn.join(', ')}`,
    `- Uses: ${block.uses.join(', ')}`,
    '',
    '### Student View',
    '',
    block.studentView.trim(),
    '',
    '### Teacher Control',
    '',
    block.teacherControl.trim(),
  ].join('\n');
}

function insertBlockSection(
  source: string,
  after: string | null,
  rendered: string,
): string {
  const sections = blockSections(source);
  let position: number;
  if (after === null) {
    const last = sections.at(-1);
    if (last === undefined) {
      const firstTail = /^## (?:Lesson Summary|Aliases|Handoff|Traces|Route Changes)[ \t]*$/m
        .exec(source);
      position = firstTail?.index ?? source.length;
    } else {
      position = last.end;
    }
  } else {
    const anchor = sections.find((section) => section.id === after);
    if (anchor === undefined) throw new Error(`ROUTE_ANCHOR_NOT_FOUND: ${after}`);
    position = anchor.end;
  }
  const prefix = source.slice(0, position).trimEnd();
  const suffix = source.slice(position).trimStart();
  return `${prefix}\n\n${rendered}\n\n${suffix}`;
}

function moveBlockSection(
  source: string,
  blockId: string,
  before: string | undefined,
  after: string | undefined,
): string {
  if (!before && !after) throw new Error('ROUTE_PLACEMENT_REQUIRED');
  const sections = blockSections(source);
  const moving = sections.find((section) => section.id === blockId);
  if (moving === undefined) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const without = `${source.slice(0, moving.start).trimEnd()}\n\n${
    source.slice(moving.end).trimStart()
  }`;
  const remaining = blockSections(without);
  const anchorId = before ?? after!;
  const anchor = remaining.find((section) => section.id === anchorId);
  if (anchor === undefined) throw new Error(`ROUTE_ANCHOR_NOT_FOUND: ${anchorId}`);
  const position = before ? anchor.start : anchor.end;
  const prefix = without.slice(0, position).trimEnd();
  const suffix = without.slice(position).trimStart();
  return `${prefix}\n\n${moving.source}\n\n${suffix}`;
}

export function appendRouteChangeSource(
  source: string,
  input: RouteChangeSourceInput,
): string {
  const ids = [...source.matchAll(/^### Route change route-(\d+)$/gm)]
    .map((match) => Number(match[1]));
  const id = `route-${String(Math.max(0, ...ids) + 1).padStart(3, '0')}`;
  const heading = source.includes('\n## Route Changes\n') ? '' : '\n## Route Changes\n';
  const placement = input.before
    ? `\n- Before: ${input.before}`
    : input.after
      ? `\n- After: ${input.after}`
      : '';
  return `${source.trimEnd()}${heading}\n### Route change ${id}\n\n`
    + `- Action: ${input.action}\n`
    + `- Block: ${input.blockId}${placement}\n`
    + `- Reason: ${input.reason}\n`
    + `- Source: ${input.source}\n`;
}

function applyRouteTransition(
  source: string,
  blocks: PreparedLessonBlock[],
  input: Extract<ClassroomTransitionInput, { action: 'route' }>,
): string {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const active = blocks.filter((block) => block.status === 'active');
  const block = byId.get(input.blockId);
  if (!block) throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  if (input.before && input.after) throw new Error('ROUTE_PLACEMENT_AMBIGUOUS');
  for (const anchor of [input.before, input.after].filter(
    (value): value is string => Boolean(value),
  )) {
    if (!byId.has(anchor)) throw new Error(`ROUTE_ANCHOR_NOT_FOUND: ${anchor}`);
    if (anchor === input.blockId) throw new Error(`ROUTE_SELF_ANCHOR: ${anchor}`);
  }

  const expected: Record<RouteAction, BlockStatus[]> = {
    move: ['pending'],
    skip: ['pending'],
    repeat: ['completed', 'skipped'],
  };
  if (!expected[input.routeAction].includes(block.status)) {
    throw new Error(
      `ROUTE_BLOCK_STATUS_INVALID: action=${input.routeAction}; `
      + `block=${block.id}; status=${block.status}`,
    );
  }
  if (input.routeAction === 'repeat' && active.length > 0) {
    throw new Error(`ROUTE_REPEAT_WHILE_ACTIVE: ${active[0]!.id}`);
  }

  const nextStatus: Partial<Record<RouteAction, BlockStatus>> = {
    skip: 'skipped',
    repeat: 'pending',
  };
  const status = nextStatus[input.routeAction];
  const next = input.routeAction === 'move'
    ? moveBlockSection(source, block.id, input.before, input.after)
    : status === undefined
      ? source
      : replaceBlockStatus(source, block.id, status);
  return appendRouteChangeSource(next, {
    action: input.routeAction,
    blockId: input.blockId,
    reason: input.reason,
    source: input.source,
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {}),
  });
}

export function transitionClassroomSource(
  source: string,
  input: ClassroomTransitionInput,
): string {
  const status = lessonStatus(source);
  if (status !== 'active') {
    throw new Error(`CLASSROOM_LESSON_NOT_ACTIVE: ${status ?? '(missing)'}`);
  }
  const blocks = readPreparedLessonBlocks(source);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const active = blocks.filter((block) => block.status === 'active');
  if (active.length > 1) {
    throw new Error(
      `CLASSROOM_ACTIVE_BLOCK_CONFLICT: ${active.map((block) => block.id).join(',')}`,
    );
  }
  if (input.action === 'insert') {
    validateDynamicBlock(blocks, input.block);
    const id = nextBlockId(blocks);
    const inserted = insertBlockSection(
      source,
      input.after,
      renderDynamicBlock(id, input.block),
    );
    return appendRouteChangeSource(inserted, {
      action: 'insert',
      blockId: id,
      reason: input.reason,
      source: input.source,
      ...(input.after ? { after: input.after } : {}),
    });
  }

  const block = byId.get(input.blockId);
  if (!block) throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);

  if (input.action === 'activate') {
    if (active.length > 0) {
      throw new Error(`CLASSROOM_ACTIVE_BLOCK_EXISTS: ${active[0]!.id}`);
    }
    if (block.status !== 'pending') {
      throw new Error(`CLASSROOM_ACTIVATE_REQUIRES_PENDING: ${block.id}`);
    }
    const unresolved = block.dependsOn.filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !['completed', 'skipped'].includes(dependency.status);
    });
    if (unresolved.length > 0) {
      throw new Error(
        `CLASSROOM_DEPENDENCY_UNRESOLVED: block=${block.id}; `
        + `dependsOn=${unresolved.join(',')}`,
      );
    }
    return replaceBlockStatus(source, block.id, 'active');
  }

  if (input.action === 'complete' || input.action === 'skip') {
    if (active.length !== 1 || active[0]!.id !== block.id) {
      throw new Error(
        `CLASSROOM_BLOCK_NOT_ACTIVE: requested=${block.id}; `
        + `active=${active[0]?.id ?? '(none)'}`,
      );
    }
    return replaceBlockStatus(
      source,
      block.id,
      input.action === 'complete' ? 'completed' : 'skipped',
    );
  }

  return applyRouteTransition(source, blocks, input);
}

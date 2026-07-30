import { posix } from 'node:path';

export type ChildKind = 'plan' | 'lesson';

export type CandidateContent = {
  publicPurpose: string;
  after: string | null;
  dependsOn: string[];
  considerWhen: string;
  sources: string[];
  privateNote: string;
};

export type CandidateEntry = CandidateContent & {
  state: 'candidate';
  handle: string;
};

export type MaterializedEntry = CandidateContent & {
  state: 'materialized';
  handle: string;
  childId: string;
  childPath: string;
  title: string;
};

export type ChildTreeEntry = CandidateEntry | MaterializedEntry;

export type ChildTree = {
  kind: ChildKind;
  entries: ChildTreeEntry[];
};

export type CandidateDraft = CandidateContent;

export type CandidateChange =
  | { action: 'add'; candidate: CandidateDraft }
  | { action: 'revise'; handle: string; candidate: CandidateDraft }
  | { action: 'remove'; handle: string };

type EntryFields = {
  node?: string;
  publicPurpose?: string;
  after?: string;
  dependsOn?: string;
  considerWhen?: string;
  sources: string[];
  privateNote?: string;
};

const entryHeadingPattern = /^### (Candidate|Child) ([^\s]+)$/;

function fail(code: string): never {
  throw new Error(code);
}

function expectedHeading(kind: ChildKind): 'Plan Tree' | 'Lesson Tree' {
  return kind === 'plan' ? 'Plan Tree' : 'Lesson Tree';
}

function handlePattern(kind: ChildKind): RegExp {
  return new RegExp(`^${kind}-candidate-\\d{3,}$`);
}

function structuralLines(body: string): Array<{
  index: number;
  line: string;
}> {
  const result: Array<{ index: number; line: string }> = [];
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  let fence: string | null = null;
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
    if (marker) {
      if (fence === null) {
        fence = marker[0]!;
      } else if (marker[0] === fence && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence === null) result.push({ index, line });
  }
  return result;
}

function sectionLines(
  body: string,
  heading: 'Plan Tree' | 'Lesson Tree',
): string[] {
  const normalized = body.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const structural = structuralLines(normalized);
  const matches = structural.filter(({ line }) => line === `## ${heading}`);
  if (matches.length !== 1) fail('NODE_TREE_SECTION_REQUIRED');
  const start = matches[0]!.index + 1;
  const end = structural.find(({ index, line }) => (
    index >= start && /^#{1,2} /.test(line)
  ))?.index ?? lines.length;
  return lines.slice(start, end);
}

function parseFields(lines: string[]): EntryFields {
  const fields: EntryFields = { sources: [] };
  const seen = new Set<string>();
  let readingSources = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const nestedSource = /^\s{2,}-\s+(.+)$/.exec(line);
    if (readingSources && nestedSource) {
      const source = nestedSource[1]!.trim();
      if (!source) fail('NODE_TREE_ENTRY_INVALID');
      fields.sources.push(source);
      continue;
    }

    readingSources = false;
    const field = /^-\s+(Node|Public purpose|After|Depends on|Consider when|Sources|Private note):(?:\s*(.*))?$/.exec(
      line,
    );
    if (!field) fail('NODE_TREE_ENTRY_INVALID');
    const key = field[1]!;
    if (seen.has(key)) fail('NODE_TREE_ENTRY_INVALID');
    seen.add(key);
    const value = field[2]?.trim() ?? '';
    if (key === 'Sources') {
      if (value) fail('NODE_TREE_ENTRY_INVALID');
      readingSources = true;
    } else if (key === 'Node') {
      fields.node = value;
    } else if (key === 'Public purpose') {
      fields.publicPurpose = value;
    } else if (key === 'After') {
      fields.after = value;
    } else if (key === 'Depends on') {
      fields.dependsOn = value;
    } else if (key === 'Consider when') {
      fields.considerWhen = value;
    } else {
      fields.privateNote = value;
    }
  }
  return fields;
}

function candidateContent(fields: EntryFields): CandidateContent {
  if (
    fields.publicPurpose === undefined
    || fields.after === undefined
    || fields.dependsOn === undefined
    || fields.considerWhen === undefined
    || fields.privateNote === undefined
    || !fields.publicPurpose
    || !fields.considerWhen
    || !fields.privateNote
  ) {
    fail('NODE_TREE_ENTRY_INVALID');
  }
  const dependsOn = fields.dependsOn
    ? fields.dependsOn.split(',').map((value) => value.trim())
    : [];
  if (dependsOn.some((value) => !value) || new Set(dependsOn).size !== dependsOn.length) {
    fail('NODE_TREE_ENTRY_INVALID');
  }
  return {
    publicPurpose: fields.publicPurpose,
    after: fields.after || null,
    dependsOn,
    considerWhen: fields.considerWhen,
    sources: [...fields.sources],
    privateNote: fields.privateNote,
  };
}

function resolveChildNode(
  value: string,
  kind: ChildKind,
  parentPath: string,
): Pick<MaterializedEntry, 'childId' | 'childPath' | 'title'> {
  const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
  if (!match) fail('NODE_TREE_ENTRY_INVALID');
  const title = match[1]!.trim();
  const target = match[2]!.trim();
  if (
    !title
    || !target
    || target.startsWith('/')
    || target.includes('\\')
    || target.includes('?')
    || target.includes('#')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)
    || !target.endsWith('.md')
  ) {
    fail('NODE_TREE_ENTRY_INVALID');
  }
  const childPath = posix.normalize(posix.join(posix.dirname(parentPath), target));
  const expectedDirectory = kind === 'plan' ? 'plans/' : 'lessons/';
  if (
    childPath === '..'
    || childPath.startsWith('../')
    || !childPath.startsWith(expectedDirectory)
  ) {
    fail('NODE_TREE_ENTRY_INVALID');
  }
  const childId = posix.basename(childPath, '.md');
  if (!childId || childId === '.' || childId === '..') {
    fail('NODE_TREE_ENTRY_INVALID');
  }
  return { childId, childPath, title };
}

function validateContent(content: CandidateContent): void {
  if (
    !content.publicPurpose.trim()
    || !content.considerWhen.trim()
    || !content.privateNote.trim()
    || content.sources.some((source) => !source.trim())
    || content.dependsOn.some((handle) => !handle.trim())
    || new Set(content.dependsOn).size !== content.dependsOn.length
  ) {
    fail('NODE_TREE_ENTRY_INVALID');
  }
}

function validateTree(tree: ChildTree): void {
  const pattern = handlePattern(tree.kind);
  const handles = new Set<string>();
  for (const entry of tree.entries) {
    validateContent(entry);
    if (!pattern.test(entry.handle)) fail('NODE_TREE_ENTRY_INVALID');
    if (handles.has(entry.handle)) fail('NODE_TREE_HANDLE_DUPLICATE');
    handles.add(entry.handle);
  }
  for (const entry of tree.entries) {
    const references = [
      ...(entry.after ? [entry.after] : []),
      ...entry.dependsOn,
    ];
    if (
      references.some((handle) => !handles.has(handle) || handle === entry.handle)
    ) {
      fail('NODE_TREE_REFERENCE_INVALID');
    }
  }
}

export function parseChildTree(
  body: string,
  heading: 'Plan Tree' | 'Lesson Tree',
  kind: ChildKind,
  parentPath: string,
): ChildTree {
  if (heading !== expectedHeading(kind)) fail('NODE_TREE_ENTRY_INVALID');
  const lines = sectionLines(body, heading);
  const headings: Array<{
    index: number;
    entryType: 'Candidate' | 'Child';
    handle: string;
  }> = [];
  let fence: string | null = null;
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
    if (marker) {
      if (fence === null) {
        fence = marker[0]!;
      } else if (marker[0] === fence && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    const match = entryHeadingPattern.exec(line);
    if (match) {
      headings.push({
        index,
        entryType: match[1] as 'Candidate' | 'Child',
        handle: match[2]!,
      });
    } else if (/^###\s/.test(line)) {
      fail('NODE_TREE_ENTRY_INVALID');
    }
  }

  const entries = headings.map((entry, index): ChildTreeEntry => {
    const end = headings[index + 1]?.index ?? lines.length;
    const fields = parseFields(lines.slice(entry.index + 1, end));
    const content = candidateContent(fields);
    if (entry.entryType === 'Candidate') {
      if (fields.node !== undefined) fail('NODE_TREE_ENTRY_INVALID');
      return {
        state: 'candidate',
        handle: entry.handle,
        ...content,
      };
    }
    if (fields.node === undefined) fail('NODE_TREE_ENTRY_INVALID');
    return {
      state: 'materialized',
      handle: entry.handle,
      ...resolveChildNode(fields.node, kind, parentPath),
      ...content,
    };
  });

  const tree: ChildTree = { kind, entries };
  validateTree(tree);
  return tree;
}

function relativeChildPath(parentPath: string, childPath: string): string {
  return posix.relative(posix.dirname(parentPath), childPath);
}

function renderEntry(
  entry: ChildTreeEntry,
  parentPath: string,
): string {
  const lines = [
    `### ${entry.state === 'candidate' ? 'Candidate' : 'Child'} ${entry.handle}`,
    '',
  ];
  if (entry.state === 'materialized') {
    lines.push(
      `- Node: [${entry.title}](${relativeChildPath(parentPath, entry.childPath)})`,
    );
  }
  lines.push(
    `- Public purpose: ${entry.publicPurpose}`,
    `- After: ${entry.after ?? ''}`,
    `- Depends on: ${entry.dependsOn.join(', ')}`,
    `- Consider when: ${entry.considerWhen}`,
    '- Sources:',
    ...entry.sources.map((source) => `  - ${source}`),
    `- Private note: ${entry.privateNote}`,
  );
  return lines.join('\n');
}

export function renderChildTree(
  heading: 'Plan Tree' | 'Lesson Tree',
  tree: ChildTree,
  parentPath: string,
): string {
  if (heading !== expectedHeading(tree.kind)) fail('NODE_TREE_ENTRY_INVALID');
  validateTree(tree);
  const entries = tree.entries.map((entry) => renderEntry(entry, parentPath));
  return [
    `## ${heading}`,
    '',
    entries.length > 0
      ? entries.join('\n\n')
      : `（尚未编排 ${tree.kind === 'plan' ? 'Plan' : 'Lesson'}。）`,
    '',
  ].join('\n');
}

export function nextCandidateHandle(tree: ChildTree): string {
  const prefix = `${tree.kind}-candidate-`;
  const highest = tree.entries.reduce((max, entry) => {
    const value = Number(entry.handle.slice(prefix.length));
    return Number.isSafeInteger(value) ? Math.max(max, value) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

function cloneContent(content: CandidateContent): CandidateContent {
  return {
    publicPurpose: content.publicPurpose.trim(),
    after: content.after?.trim() || null,
    dependsOn: content.dependsOn.map((value) => value.trim()),
    considerWhen: content.considerWhen.trim(),
    sources: content.sources.map((value) => value.trim()),
    privateNote: content.privateNote.trim(),
  };
}

export function applyCandidateChanges(
  tree: ChildTree,
  changes: CandidateChange[],
): ChildTree {
  let entries = tree.entries.map((entry): ChildTreeEntry => ({
    ...entry,
    dependsOn: [...entry.dependsOn],
    sources: [...entry.sources],
  }));
  for (const change of changes) {
    if (change.action === 'add') {
      entries.push({
        state: 'candidate',
        handle: nextCandidateHandle({ kind: tree.kind, entries }),
        ...cloneContent(change.candidate),
      });
      continue;
    }
    const index = entries.findIndex((entry) => entry.handle === change.handle);
    if (index < 0) fail('NODE_TREE_CANDIDATE_REQUIRED');
    const current = entries[index]!;
    if (current.state === 'materialized') {
      fail('NODE_TREE_MATERIALIZED_IMMUTABLE');
    }
    if (change.action === 'remove') {
      entries.splice(index, 1);
    } else {
      entries[index] = {
        state: 'candidate',
        handle: current.handle,
        ...cloneContent(change.candidate),
      };
    }
  }
  const result: ChildTree = { kind: tree.kind, entries };
  validateTree(result);
  return result;
}

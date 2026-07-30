import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  applyCandidateChanges,
  parseChildTree,
  parseSourceHandle,
  readMarkdownFile,
  renderChildTree,
  resolveInsideRoot,
  type CandidateChange,
  type ChildKind,
  type ChildTree,
  type MaterializedEntry,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import { parse } from 'yaml';

const nonempty = Type.String({ minLength: 1 });

export const candidateDraftSchema = Type.Object({
  publicPurpose: nonempty,
  after: Type.Union([nonempty, Type.Null()]),
  dependsOn: Type.Array(nonempty),
  considerWhen: nonempty,
  sources: Type.Array(nonempty),
  privateNote: nonempty,
}, { additionalProperties: false });

export const candidateChangeSchema = Type.Union([
  Type.Object({
    action: Type.Literal('add'),
    candidate: candidateDraftSchema,
  }, { additionalProperties: false }),
  Type.Object({
    action: Type.Literal('revise'),
    handle: nonempty,
    candidate: candidateDraftSchema,
  }, { additionalProperties: false }),
  Type.Object({
    action: Type.Literal('remove'),
    handle: nonempty,
  }, { additionalProperties: false }),
]);

export const candidateChangesSchema = Type.Array(candidateChangeSchema);

export type TreeMutationFileOps = {
  exists(path: string): boolean;
  read(path: string): string;
  write(path: string, source: string): void;
  rename(from: string, to: string): void;
  remove(path: string): void;
};

const defaultFileOps: TreeMutationFileOps = {
  exists: existsSync,
  read: (path) => readFileSync(path, 'utf8'),
  write: (path, source) => writeFileSync(path, source),
  rename: renameSync,
  remove: (path) => rmSync(path, { force: true }),
};

export type ParentDocumentUpdate = {
  parentId: string;
  parentPath: string;
  childKind: ChildKind;
  candidateChanges: CandidateChange[];
  sections: Record<string, string>;
  appendMissingSections?: string[];
  frontmatter: Record<string, string>;
};

export type MaterializationResult = {
  handle: string;
  childId: string;
  childPath: string;
};

export type MaterializeChildInput = {
  parentId: string;
  parentPath: string;
  childKind: ChildKind;
  candidateHandle: string;
  title: string;
  render(identity: {
    childId: string;
    childPath: string;
  }): string;
  validate(childPath: string, source: string): void;
  fileOps?: TreeMutationFileOps;
};

function normalized(source: string): string {
  return source.endsWith('\n') ? source : `${source}\n`;
}

function lexicalWorkspacePath(root: string, path: string): string {
  resolveInsideRoot(root, path);
  return resolve(root, path);
}

function expectedParentKind(childKind: ChildKind): 'roadmap' | 'plan' {
  return childKind === 'plan' ? 'roadmap' : 'plan';
}

function treeHeading(childKind: ChildKind): 'Plan Tree' | 'Lesson Tree' {
  return childKind === 'plan' ? 'Plan Tree' : 'Lesson Tree';
}

function assertParent(
  root: string,
  parentId: string,
  parentPath: string,
  childKind: ChildKind,
): ReturnType<typeof readMarkdownFile> {
  const parent = readMarkdownFile(root, parentPath);
  if (
    parent.id !== parentId
    || parent.frontmatter.kind !== expectedParentKind(childKind)
  ) {
    throw new Error(`NODE_PARENT_MISMATCH: ${parentPath}`);
  }
  if (
    childKind === 'plan'
      ? parentPath !== 'ROADMAP.md'
      : parentPath !== `plans/${parentId}.md`
  ) {
    throw new Error(`NODE_PARENT_PATH_MISMATCH: ${parentPath}`);
  }
  return parent;
}

function sectionRange(
  source: string,
  heading: string,
): { start: number; end: number; lines: string[] } {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  let start = -1;
  let fence: { marker: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
    if (marker !== null) {
      if (fence === null) {
        fence = { marker: marker[0]!, length: marker.length };
      } else if (
        marker[0] === fence.marker
        && marker.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    if (line.trimEnd() === `## ${heading}`) {
      if (start >= 0) throw new Error(`SECTION_DUPLICATE: ${heading}`);
      start = index;
    }
  }
  if (start < 0) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  let end = start + 1;
  fence = null;
  while (end < lines.length) {
    const line = lines[end]!;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
    if (marker !== null) {
      if (fence === null) {
        fence = { marker: marker[0]!, length: marker.length };
      } else if (
        marker[0] === fence.marker
        && marker.length >= fence.length
      ) {
        fence = null;
      }
      end += 1;
      continue;
    }
    if (fence === null && /^#{1,2}\s/.test(line)) break;
    end += 1;
  }
  return { start, end, lines };
}

function replaceSection(
  source: string,
  heading: string,
  value: string,
  includesHeading = false,
): string {
  const range = sectionRange(source, heading);
  const replacement = includesHeading
    ? value.trimEnd().split('\n')
    : [`## ${heading}`, '', value.trim(), ''];
  const lines = [
    ...range.lines.slice(0, range.start),
    ...replacement,
    ...range.lines.slice(range.end),
  ];
  return normalized(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
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

function bodyFromSource(source: string): string {
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    source,
  );
  return match ? source.slice(match[0].length) : source;
}

function validateCandidateSources(changes: CandidateChange[]): void {
  for (const change of changes) {
    if (change.action === 'remove') continue;
    for (const source of change.candidate.sources) parseSourceHandle(source);
  }
}

function renderUpdatedParent(
  source: string,
  parentPath: string,
  childKind: ChildKind,
  tree: ChildTree,
  sections: Record<string, string>,
  appendMissingSections: ReadonlySet<string>,
  frontmatter: Record<string, string>,
): string {
  const heading = treeHeading(childKind);
  let next = replaceSection(
    source,
    heading,
    renderChildTree(heading, tree, parentPath),
    true,
  );
  for (const [section, value] of Object.entries(sections)) {
    try {
      next = replaceSection(next, section, value);
    } catch (error) {
      if (
        !(error instanceof Error)
        || error.message !== `SECTION_NOT_FOUND: ${section}`
        || !appendMissingSections.has(section)
      ) {
        throw error;
      }
      next = normalized(
        `${next.trimEnd()}\n\n## ${section}\n\n${value.trim()}\n`,
      );
    }
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    next = replaceFrontmatterField(next, parentPath, key, value);
  }
  parseChildTree(bodyFromSource(next), heading, childKind, parentPath);
  return normalized(next);
}

export function updateParentDocument(
  root: string,
  input: ParentDocumentUpdate,
): ChildTree {
  const parent = assertParent(
    root,
    input.parentId,
    input.parentPath,
    input.childKind,
  );
  validateCandidateSources(input.candidateChanges);
  const heading = treeHeading(input.childKind);
  const current = parseChildTree(
    parent.body,
    heading,
    input.childKind,
    input.parentPath,
  );
  const tree = applyCandidateChanges(current, input.candidateChanges);
  const absolute = resolveInsideRoot(root, input.parentPath);
  const source = readFileSync(absolute, 'utf8');
  const next = renderUpdatedParent(
    source,
    input.parentPath,
    input.childKind,
    tree,
    input.sections,
    new Set(input.appendMissingSections ?? []),
    input.frontmatter,
  );
  writeFileSync(absolute, next);
  return tree;
}

function childIdentity(source: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    source,
  );
  if (!match?.[1]) throw new Error('CHILD_FRONTMATTER_REQUIRED');
  const value: unknown = parse(match[1]);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CHILD_FRONTMATTER_INVALID');
  }
  return {
    frontmatter: value as Record<string, unknown>,
    body: source.slice(match[0].length),
  };
}

function validateChildIdentity(
  input: MaterializeChildInput,
  childId: string,
  childPath: string,
  source: string,
): void {
  const child = childIdentity(source);
  if (
    child.frontmatter.id !== childId
    || child.frontmatter.kind !== input.childKind
    || child.frontmatter.status !== 'prepared'
    || child.frontmatter.parent_id !== input.parentId
    || child.frontmatter.parent_path !== input.parentPath
  ) {
    throw new Error(`CHILD_IDENTITY_INVALID: ${childPath}`);
  }
  const title = /^#\s+(.+?)\s*$/m.exec(child.body)?.[1]?.trim();
  if (!title) throw new Error(`CHILD_TITLE_REQUIRED: ${childPath}`);
}

function allocateChild(
  root: string,
  kind: ChildKind,
): { childId: string; childPath: string } {
  const directory = kind === 'plan' ? 'plans' : 'lessons';
  for (let value = 1; value <= 999_999; value += 1) {
    const childId = `${kind}-${String(value).padStart(3, '0')}`;
    const childPath = `${directory}/${childId}.md`;
    if (!existsSync(resolveInsideRoot(root, childPath))) {
      return { childId, childPath };
    }
  }
  throw new Error(`NODE_ID_EXHAUSTED: ${kind}`);
}

function existingMaterializedIdentity(
  root: string,
  input: MaterializeChildInput,
  entry: MaterializedEntry,
): { childId: string; childPath: string } {
  const document = readMarkdownFile(root, entry.childPath);
  if (
    document.id !== entry.childId
    || document.frontmatter.kind !== input.childKind
    || document.frontmatter.parent_id !== input.parentId
    || document.frontmatter.parent_path !== input.parentPath
  ) {
    throw new Error(`NODE_CHILD_OWNERSHIP_CONFLICT: ${entry.childPath}`);
  }
  if (document.frontmatter.status !== 'prepared') {
    throw new Error(`NODE_REPREPARE_REQUIRES_PREPARED: ${entry.childId}`);
  }
  return { childId: entry.childId, childPath: entry.childPath };
}

function installPair(
  parentAbsolute: string,
  parentSource: string,
  childAbsolute: string,
  childSource: string,
  fileOps: TreeMutationFileOps,
): void {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parentTemporary = `${parentAbsolute}.studyforge-materialize-${nonce}`;
  const childTemporary = `${childAbsolute}.studyforge-materialize-${nonce}`;
  const parentBackup = `${parentAbsolute}.studyforge-backup-${nonce}`;
  const childBackup = `${childAbsolute}.studyforge-backup-${nonce}`;
  const childExisted = fileOps.exists(childAbsolute);
  let parentBackedUp = false;
  let childBackedUp = false;
  let childInstalled = false;
  let parentInstalled = false;

  try {
    fileOps.write(parentTemporary, normalized(parentSource));
    fileOps.write(childTemporary, normalized(childSource));
    fileOps.rename(parentAbsolute, parentBackup);
    parentBackedUp = true;
    if (childExisted) {
      fileOps.rename(childAbsolute, childBackup);
      childBackedUp = true;
    }
    fileOps.rename(childTemporary, childAbsolute);
    childInstalled = true;
    fileOps.rename(parentTemporary, parentAbsolute);
    parentInstalled = true;
    fileOps.remove(parentBackup);
    parentBackedUp = false;
    if (childBackedUp) {
      fileOps.remove(childBackup);
      childBackedUp = false;
    }
  } catch (error) {
    if (parentInstalled && fileOps.exists(parentAbsolute)) {
      fileOps.remove(parentAbsolute);
    }
    if (parentBackedUp && fileOps.exists(parentBackup)) {
      fileOps.rename(parentBackup, parentAbsolute);
      parentBackedUp = false;
    }
    if (childInstalled && fileOps.exists(childAbsolute)) {
      fileOps.remove(childAbsolute);
    }
    if (childBackedUp && fileOps.exists(childBackup)) {
      fileOps.rename(childBackup, childAbsolute);
      childBackedUp = false;
    }
    throw error;
  } finally {
    for (const path of [
      parentTemporary,
      childTemporary,
      parentBackup,
      childBackup,
    ]) {
      if (fileOps.exists(path)) fileOps.remove(path);
    }
  }
}

export function materializeChild(
  root: string,
  input: MaterializeChildInput,
): MaterializationResult {
  const parent = assertParent(
    root,
    input.parentId,
    input.parentPath,
    input.childKind,
  );
  const heading = treeHeading(input.childKind);
  const tree = parseChildTree(
    parent.body,
    heading,
    input.childKind,
    input.parentPath,
  );
  const index = tree.entries.findIndex(
    (entry) => entry.handle === input.candidateHandle,
  );
  if (index < 0) throw new Error('NODE_TREE_CANDIDATE_REQUIRED');
  const entry = tree.entries[index]!;
  const identity = entry.state === 'materialized'
    ? existingMaterializedIdentity(root, input, entry)
    : allocateChild(root, input.childKind);
  const childSource = normalized(input.render(identity));
  validateChildIdentity(
    input,
    identity.childId,
    identity.childPath,
    childSource,
  );
  input.validate(identity.childPath, childSource);

  const materialized: MaterializedEntry = {
    ...entry,
    state: 'materialized',
    childId: identity.childId,
    childPath: identity.childPath,
    title: input.title.trim(),
  };
  if (!materialized.title) throw new Error('NODE_CHILD_TITLE_REQUIRED');
  const nextTree: ChildTree = {
    kind: input.childKind,
    entries: tree.entries.map((current, currentIndex) => (
      currentIndex === index ? materialized : current
    )),
  };
  const parentAbsolute = lexicalWorkspacePath(root, input.parentPath);
  const parentSource = readFileSync(parentAbsolute, 'utf8');
  const nextParent = renderUpdatedParent(
    parentSource,
    input.parentPath,
    input.childKind,
    nextTree,
    {},
    new Set(),
    {},
  );
  const childAbsolute = lexicalWorkspacePath(root, identity.childPath);
  if (dirname(childAbsolute) === childAbsolute) {
    throw new Error(`NODE_CHILD_PATH_INVALID: ${identity.childPath}`);
  }
  installPair(
    parentAbsolute,
    nextParent,
    childAbsolute,
    childSource,
    input.fileOps ?? defaultFileOps,
  );
  return {
    handle: input.candidateHandle,
    childId: identity.childId,
    childPath: identity.childPath,
  };
}

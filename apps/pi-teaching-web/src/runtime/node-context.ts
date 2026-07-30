import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseChildTree,
  parseHandoff,
  readMarkdownFile,
  resolveInsideRoot,
  type Handoff,
  type MaterializedEntry,
} from 'highschool-study-markdown/study-domain';
import {
  parseProfileDocument,
  type ProfileEntry,
  type ProfileOwner,
} from '../memory-review/profile-document';
import { parseActivationSnapshot } from '../study/activation-snapshot';
import {
  formatSessionOwnerContext,
  isRoadmapCoachScope,
  roleForNode,
  scopeToolNames,
  type NodeSessionScope,
} from './session-scope';

export type ContextPageKind = 'resident' | 'frozen' | 'local' | 'index';

export type ContextPage = {
  kind: ContextPageKind;
  label: string;
  source: string;
  content: string | null;
};

export type CompiledNodeContext = {
  scope: NodeSessionScope;
  pages: ContextPage[];
  allowlist: string[];
  resolvableSources: string[];
};

export type CompileNodeContextOptions = {
  sessionId?: string | null;
};

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function rawNode(root: string, path: string): string {
  return readFileSync(resolveInsideRoot(root, path), 'utf8');
}

function sectionRange(
  source: string,
  heading: string,
): { start: number; end: number; content: string } | null {
  const normalized = source.replaceAll('\r\n', '\n');
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^## ${escaped}[ \\t]*$`, 'm').exec(normalized);
  if (!match) return null;
  const tailStart = match.index + match[0].length;
  const tail = normalized.slice(tailStart);
  const next = /^#{1,2} [^\n]+$/m.exec(tail);
  const end = next === null ? normalized.length : tailStart + next.index;
  return {
    start: match.index,
    end,
    content: normalized.slice(match.index, end).trim(),
  };
}

function withoutSection(source: string, heading: string): string {
  const range = sectionRange(source, heading);
  if (range === null) return source.trim();
  return `${source.slice(0, range.start)}${source.slice(range.end)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function profilePage(
  owner: ProfileOwner,
  entry: ProfileEntry,
): ContextPage {
  return {
    kind: 'resident',
    label: `${owner === 'student' ? 'Student' : 'Teaching'} preference ${entry.id}`,
    source: `memory:${owner}/${entry.id}`,
    content: [
      `- Content: ${entry.content}`,
      `- Scope: ${entry.scope}`,
      `- Sources: ${entry.sources.join(', ')}`,
      `- Rationale: ${entry.rationale}`,
      `- Counter-evidence: ${entry.counterEvidence}`,
    ].join('\n'),
  };
}

function readProfiles(
  root: string,
): Record<ProfileOwner, ProfileEntry[]> {
  return {
    student: parseProfileDocument(
      readFileSync(resolveInsideRoot(root, 'memory/student-profile.md'), 'utf8'),
      'student',
    ),
    teaching: parseProfileDocument(
      readFileSync(resolveInsideRoot(root, 'memory/teaching-profile.md'), 'utf8'),
      'teaching',
    ),
  };
}

function selectedProfilePages(
  root: string,
  sources: string[],
): ContextPage[] {
  const profiles = readProfiles(root);
  return sources.flatMap((source) => {
    const match = /^memory:(student|teaching)\/(.+)$/.exec(source);
    if (!match) return [];
    const owner = match[1] as ProfileOwner;
    const entry = profiles[owner].find((candidate) => candidate.id === match[2]);
    if (!entry) throw new Error(`NODE_CONTEXT_MEMORY_MISSING: ${source}`);
    return [profilePage(owner, entry)];
  });
}

function allProfilePages(root: string): ContextPage[] {
  const profiles = readProfiles(root);
  return [
    ...profiles.student.map((entry) => profilePage('student', entry)),
    ...profiles.teaching.map((entry) => profilePage('teaching', entry)),
  ];
}

function materializedChildren(
  root: string,
  scope: NodeSessionScope,
): MaterializedEntry[] {
  if (scope.nodeKind === 'lesson') return [];
  const document = readMarkdownFile(root, scope.nodePath);
  const tree = scope.nodeKind === 'roadmap'
    ? parseChildTree(document.body, 'Plan Tree', 'plan', scope.nodePath)
    : parseChildTree(document.body, 'Lesson Tree', 'lesson', scope.nodePath);
  return tree.entries.filter(
    (entry): entry is MaterializedEntry => entry.state === 'materialized',
  );
}

function childHandoffs(
  root: string,
  scope: NodeSessionScope,
): Handoff[] {
  const expectedTo = `${scope.nodeKind}:${scope.nodeId}`;
  return materializedChildren(root, scope).flatMap((entry) => {
    const absolute = resolveInsideRoot(root, entry.childPath);
    if (!existsSync(absolute)) return [];
    const source = readFileSync(absolute, 'utf8');
    if (!/^## Handoff[ \t]*$/m.test(source)) return [];
    try {
      const handoff = parseHandoff(source);
      return handoff.identity.to === expectedTo ? [handoff] : [];
    } catch {
      return [];
    }
  });
}

function handoffPages(handoffs: Handoff[]): ContextPage[] {
  return handoffs.flatMap((handoff) => [
    {
      kind: 'index' as const,
      label: `Sealed ${handoff.identity.from} Handoff`,
      source: `handoff:${handoff.identity.id}`,
      content: null,
    },
    ...handoff.learnerClaims.map((claim) => ({
      kind: 'index' as const,
      label: claim.statement,
      source: claim.sourceRef,
      content: null,
    })),
    ...handoff.teachingClaims.map((claim) => ({
      kind: 'index' as const,
      label: claim.statement,
      source: claim.sourceRef,
      content: null,
    })),
  ]);
}

function sessionIdFromNode(
  root: string,
  scope: NodeSessionScope,
): string | null {
  const document = readMarkdownFile(root, scope.nodePath);
  const field = scope.nodeKind === 'roadmap'
    ? 'roadmap_coach_session'
    : scope.nodeKind === 'plan'
      ? 'coach_session'
      : 'tutor_session';
  const value = document.frontmatter[field];
  return typeof value === 'string' && value ? value : null;
}

function rolePromptPath(scope: NodeSessionScope): string {
  return join(
    resourceRoot,
    'agents',
    `${isRoadmapCoachScope(scope) ? 'roadmap-coach' : roleForNode(scope.nodeKind)}.md`,
  );
}

export function compileNodeContext(
  root: string,
  scope: NodeSessionScope,
  options: CompileNodeContextOptions = {},
): CompiledNodeContext {
  const source = rawNode(root, scope.nodePath);
  const snapshot = scope.nodeKind === 'roadmap'
    ? null
    : parseActivationSnapshot(source);
  const handoffs = childHandoffs(root, scope);
  const selectedMemory = snapshot?.draft.selectedMemory ?? [];
  const currentSessionId = options.sessionId ?? sessionIdFromNode(root, scope);
  const profilePages = scope.nodeKind === 'roadmap'
    ? allProfilePages(root)
    : selectedProfilePages(root, selectedMemory);
  const allowlist = unique([
    scope.nodePath,
    'LEARNING_GUIDE.md',
    'cards/**',
    'graph/**',
    'materials/**',
    ...(scope.nodeKind === 'roadmap'
      ? ['memory/student-profile.md', 'memory/teaching-profile.md']
      : []),
  ]);
  const handoffSources = handoffs.flatMap((handoff) => [
    `handoff:${handoff.identity.id}`,
    ...handoff.learnerClaims.map((claim) => claim.sourceRef),
    ...handoff.teachingClaims.map((claim) => claim.sourceRef),
    ...handoff.sourceIndex,
  ]);
  const resolvableSources = unique([
    ...(snapshot === null
      ? []
      : [
        ...snapshot.draft.parentSources,
        ...snapshot.draft.selectedMemory,
      ]),
    ...handoffSources,
    ...(currentSessionId ? [`session:${currentSessionId}`] : []),
  ]);
  const pages: ContextPage[] = [
    {
      kind: 'resident',
      label: 'Shared Math Teaching Core',
      source: 'resource:teaching-core',
      content: readFileSync(
        join(resourceRoot, 'teaching', 'math-teaching-core.md'),
        'utf8',
      ).trim(),
    },
    {
      kind: 'resident',
      label: `${scope.nodeKind} role prompt`,
      source: `resource:agent/${scope.nodeKind}`,
      content: readFileSync(rolePromptPath(scope), 'utf8').trim(),
    },
    {
      kind: 'resident',
      label: 'Learning-set principles',
      source: 'LEARNING_GUIDE.md',
      content: readFileSync(
        resolveInsideRoot(root, 'LEARNING_GUIDE.md'),
        'utf8',
      ).trim(),
    },
    ...profilePages,
    {
      kind: 'resident',
      label: 'Node identity and capabilities',
      source: 'runtime:node-scope',
      content: [
        formatSessionOwnerContext(root, scope),
        `Allowed files: ${allowlist.join(', ')}`,
        `Available tools: ${scopeToolNames(scope).join(', ')}`,
      ].join('\n'),
    },
    ...(snapshot === null
      ? []
      : [{
        kind: 'frozen' as const,
        label: 'Activation Snapshot',
        source: `${scope.nodePath}#activation-snapshot`,
        content: sectionRange(source, 'Activation Snapshot')?.content ?? null,
      }]),
    {
      kind: 'local',
      label: `Current ${scope.nodeKind} node`,
      source: scope.nodePath,
      content: snapshot === null
        ? source.trim()
        : withoutSection(source, 'Activation Snapshot'),
    },
    ...(currentSessionId
      ? [{
        kind: 'local' as const,
        label: 'Current node Session',
        source: `session:${currentSessionId}`,
        content: null,
      }]
      : []),
    ...handoffPages(handoffs),
    {
      kind: 'index',
      label: scope.nodeKind === 'roadmap'
        ? 'Learning-set Trace query'
        : `${scope.nodeKind}:${scope.nodeId} Trace query`,
      source: 'tool:trace_search',
      content: null,
    },
    {
      kind: 'index',
      label: 'Public cards, graph and materials',
      source: 'tool:card_search',
      content: null,
    },
  ];
  return {
    scope: { ...scope },
    pages,
    allowlist,
    resolvableSources,
  };
}

export function renderCompiledNodeContext(
  context: CompiledNodeContext,
): string {
  const pages = context.pages.map((page) => [
    `## ${page.kind.toUpperCase()} · ${page.label}`,
    '',
    `Source: ${page.source}`,
    '',
    page.content ?? '(indexed; resolve only when needed)',
  ].join('\n'));
  return [
    '# StudyForge Node Context Frame',
    '',
    ...pages,
  ].join('\n\n');
}

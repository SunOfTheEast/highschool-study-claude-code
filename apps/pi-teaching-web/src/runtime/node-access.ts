import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, posix } from 'node:path';
import {
  parseHandoff,
  parseSourceHandle,
  readActiveTraces,
  readMarkdownFile,
  resolveInsideRoot,
  sourceResolve,
  type Handoff,
  type SourceHandle,
} from 'highschool-study-markdown/study-domain';
import { parseProfileDocument } from '../memory-review/profile-document';
import type { CompiledNodeContext } from './node-context';

export type NodeSourceResolution = {
  valid: boolean;
  source: string;
  kind: string | null;
  path: string | null;
  excerpt: string | null;
  error: 'SOURCE_NOT_ALLOWED' | 'SOURCE_NOT_FOUND' | 'SOURCE_INVALID' | null;
};

export type NodeAccessPolicyOptions = {
  sessionId?: string | null;
  sessionEntries?: () => readonly unknown[];
};

function invalid(
  source: string,
  error: Exclude<NodeSourceResolution['error'], null>,
): NodeSourceResolution {
  return {
    valid: false,
    source,
    kind: null,
    path: null,
    excerpt: null,
    error,
  };
}

function valid(
  source: string,
  kind: string,
  path: string | null,
  excerpt: string | null,
): NodeSourceResolution {
  return { valid: true, source, kind, path, excerpt, error: null };
}

function plainPath(source: string): { path: string; fragment: string | null } | null {
  if (
    !source
    || source !== source.trim()
    || isAbsolute(source)
    || source.includes('\\')
    || source.includes('?')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(source)
  ) {
    return null;
  }
  const index = source.indexOf('#');
  const path = index < 0 ? source : source.slice(0, index);
  const fragment = index < 0 ? null : source.slice(index + 1);
  if (!path || (index >= 0 && !fragment)) return null;
  const normalized = posix.normalize(path);
  if (
    normalized !== path
    || normalized === '..'
    || normalized.startsWith('../')
    || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }
  return { path, fragment };
}

function handoffId(source: string): string | null {
  return /^handoff:([A-Za-z0-9@][A-Za-z0-9@._-]*\/handoff)$/.exec(source)?.[1]
    ?? null;
}

function documentForHandoff(root: string, id: string): {
  path: string;
  handoff: Handoff;
} | null {
  const nodeId = id.replace(/\/handoff$/, '');
  const paths = nodeId === 'roadmap'
    ? ['ROADMAP.md']
    : [`lessons/${nodeId}.md`, `plans/${nodeId}.md`];
  for (const path of paths) {
    try {
      const absolute = resolveInsideRoot(root, path);
      if (!existsSync(absolute)) continue;
      const handoff = parseHandoff(readFileSync(absolute, 'utf8'));
      if (handoff.identity.id === id) return { path, handoff };
    } catch {
      continue;
    }
  }
  return null;
}

function blockExcerpt(source: string, blockId: string): string | null {
  const escaped = blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(
    `^## Block ${escaped}(?:（[^）]+）)?[ \\t]*$`,
    'm',
  ).exec(source);
  if (!heading) return null;
  const start = heading.index;
  const tail = source.slice(start + heading[0].length);
  const next = /^## [^\n]+$/m.exec(tail);
  const end = next === null
    ? source.length
    : start + heading[0].length + next.index;
  return source.slice(start, end).trim();
}

function sessionEntryId(entry: unknown): string | null {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = (entry as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

export class NodeAccessPolicy {
  private readonly granted = new Set<string>();
  private readonly initial: Set<string>;
  private readonly sessionId: string | null;

  constructor(
    private readonly root: string,
    readonly context: CompiledNodeContext,
    private readonly options: NodeAccessPolicyOptions = {},
  ) {
    this.initial = new Set(context.resolvableSources);
    this.sessionId = options.sessionId
      ?? context.pages.find((page) => (
        page.kind === 'local' && page.source.startsWith('session:')
      ))?.source.slice('session:'.length)
      ?? null;
  }

  grant(sources: string[]): void {
    for (const source of sources) {
      if (this.isSafeSource(source)) this.granted.add(source);
    }
  }

  wasGranted(source: string): boolean {
    return this.granted.has(source);
  }

  allowedSources(): string[] {
    const sources = new Set([
      ...this.initial,
      ...this.granted,
      ...(this.sessionId === null ? [] : [`session:${this.sessionId}`]),
    ]);
    const priority = (source: string): number => {
      if (source.startsWith('claim:')) return 0;
      if (source.startsWith('handoff:')) return 1;
      if (source.startsWith('trace:')) return 2;
      if (source.startsWith('memory:')) return 3;
      if (source.startsWith('session:')) return 4;
      return 5;
    };
    return [...sources]
      .filter((source) => this.allows(source))
      .sort((left, right) => (
        priority(left) - priority(right)
        || left.localeCompare(right)
      ));
  }

  private isPublicPath(path: string): boolean {
    return path === 'LEARNING_GUIDE.md'
      || path.startsWith('cards/')
      || path.startsWith('graph/')
      || path.startsWith('materials/');
  }

  private scopedTrace(source: string): boolean {
    const traceId = /^trace:(.+)$/.exec(source)?.[1];
    if (!traceId) return false;
    return readActiveTraces(this.root).some((trace) => (
      trace.traceId === traceId
      && (
        this.context.scope.nodeKind === 'roadmap'
        || (
          this.context.scope.nodeKind === 'plan'
          && trace.planId === this.context.scope.nodeId
        )
        || (
          this.context.scope.nodeKind === 'lesson'
          && trace.lessonId === this.context.scope.nodeId
        )
      )
    ));
  }

  private isSafeSource(source: string): boolean {
    if (handoffId(source) !== null) return true;
    if (plainPath(source) !== null) return true;
    try {
      parseSourceHandle(source);
      return true;
    } catch {
      return false;
    }
  }

  allows(source: string): boolean {
    if (!this.isSafeSource(source)) return false;
    const path = plainPath(source);
    if (path !== null) {
      if (path.path === this.context.scope.nodePath) return true;
      if (this.isPublicPath(path.path)) return true;
      return this.context.scope.nodeKind === 'roadmap'
        && (
          path.path === 'memory/student-profile.md'
          || path.path === 'memory/teaching-profile.md'
        );
    }
    const customHandoff = handoffId(source);
    if (customHandoff !== null) {
      return this.initial.has(source) || this.granted.has(source);
    }
    let handle: SourceHandle;
    try {
      handle = parseSourceHandle(source);
    } catch {
      return false;
    }
    if (handle.kind === 'session') {
      return handle.sessionId === this.sessionId;
    }
    if (handle.kind === 'memory') {
      return this.context.scope.nodeKind === 'roadmap'
        || this.initial.has(source)
        || this.granted.has(source);
    }
    if (handle.kind === 'card') {
      return existsSync(resolveInsideRoot(this.root, handle.cardPath));
    }
    if (handle.kind === 'trace') {
      return this.initial.has(source)
        || this.granted.has(source)
        || this.scopedTrace(source);
    }
    if (handle.kind === 'block') {
      return (
        this.context.scope.nodeKind === 'lesson'
        && handle.lessonId === this.context.scope.nodeId
      ) || this.initial.has(source) || this.granted.has(source);
    }
    return this.initial.has(source) || this.granted.has(source);
  }

  resolve(source: string): NodeSourceResolution {
    if (!this.allows(source)) return invalid(source, 'SOURCE_NOT_ALLOWED');

    const path = plainPath(source);
    if (path !== null) {
      const resolved = sourceResolve(this.root, {
        fromPath: 'ROADMAP.md',
        target: source,
      });
      return resolved.valid
        ? valid(source, 'file', resolved.path, resolved.excerpt)
        : invalid(source, 'SOURCE_NOT_FOUND');
    }

    const customHandoff = handoffId(source);
    if (customHandoff !== null) {
      const document = documentForHandoff(this.root, customHandoff);
      return document === null
        ? invalid(source, 'SOURCE_NOT_FOUND')
        : valid(
          source,
          'handoff',
          document.path,
          JSON.stringify(document.handoff),
        );
    }

    let handle: SourceHandle;
    try {
      handle = parseSourceHandle(source);
    } catch {
      return invalid(source, 'SOURCE_INVALID');
    }
    if (handle.kind === 'card') {
      const resolved = sourceResolve(this.root, {
        fromPath: 'ROADMAP.md',
        target: handle.cardPath,
      });
      return resolved.valid
        ? valid(source, 'card', resolved.path, resolved.excerpt)
        : invalid(source, 'SOURCE_NOT_FOUND');
    }
    if (handle.kind === 'trace') {
      const trace = readActiveTraces(this.root)
        .find((candidate) => candidate.traceId === handle.traceId);
      return trace === undefined
        ? invalid(source, 'SOURCE_NOT_FOUND')
        : valid(source, 'trace', `traces/${trace.traceId}.md`, JSON.stringify(trace));
    }
    if (handle.kind === 'memory') {
      const profilePath = handle.owner === 'student'
        ? 'memory/student-profile.md'
        : 'memory/teaching-profile.md';
      const profile = parseProfileDocument(
        readFileSync(resolveInsideRoot(this.root, profilePath), 'utf8'),
        handle.owner,
      );
      const entry = profile.find((candidate) => candidate.id === handle.entryId);
      return entry === undefined
        ? invalid(source, 'SOURCE_NOT_FOUND')
        : valid(source, 'memory', profilePath, JSON.stringify(entry));
    }
    if (handle.kind === 'block') {
      const lessonPath = `lessons/${handle.lessonId}.md`;
      try {
        const lesson = readFileSync(resolveInsideRoot(this.root, lessonPath), 'utf8');
        const excerpt = blockExcerpt(lesson, handle.blockId);
        return excerpt === null
          ? invalid(source, 'SOURCE_NOT_FOUND')
          : valid(source, 'block', lessonPath, excerpt);
      } catch {
        return invalid(source, 'SOURCE_NOT_FOUND');
      }
    }
    if (handle.kind === 'session') {
      const entries = this.options.sessionEntries?.() ?? [];
      if (handle.messageId === null) {
        return valid(
          source,
          'session',
          null,
          JSON.stringify(entries.map(sessionEntryId).filter(Boolean)),
        );
      }
      const entry = entries.find(
        (candidate) => sessionEntryId(candidate) === handle.messageId,
      );
      return entry === undefined
        ? invalid(source, 'SOURCE_NOT_FOUND')
        : valid(source, 'session-message', null, JSON.stringify(entry));
    }
    if (handle.kind === 'claim') {
      const document = documentForHandoff(this.root, handle.handoffId);
      if (document === null) return invalid(source, 'SOURCE_NOT_FOUND');
      const claims = handle.claimKind === 'learner'
        ? document.handoff.learnerClaims
        : document.handoff.teachingClaims;
      const claim = claims.find((candidate) => candidate.id === handle.claimId);
      return claim === undefined
        ? invalid(source, 'SOURCE_NOT_FOUND')
        : valid(source, 'claim', document.path, JSON.stringify(claim));
    }
    return invalid(source, 'SOURCE_INVALID');
  }
}

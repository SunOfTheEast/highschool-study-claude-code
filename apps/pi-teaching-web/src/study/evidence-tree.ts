import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseHandoff,
  parseSourceHandle,
  readActiveTraces,
  readTraceRecords,
  resolveInsideRoot,
  type Handoff,
  type SourceHandle,
} from 'highschool-study-markdown/study-domain';
import { parse } from 'yaml';
import { parseProfileDocument } from '../memory-review/profile-document';
import { readRoadmapCheckpoints } from './roadmap-checkpoints';

export type NodeSessionScope = {
  nodeKind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};

export type SessionEvidenceReader = {
  readSession(source: `session:${string}`): {
    sessionId: string;
    ownerId: string;
    ownerPath: string;
  } | null;
  readMessage(source: `session:${string}#message:${string}`): {
    role: 'student' | 'coach' | 'tutor';
    text: string;
  } | null;
};

export type EvidenceState = 'active' | 'invalidated' | 'missing' | 'forbidden';

export type EvidenceNode = {
  source: string;
  label: string;
  state: EvidenceState;
  children: EvidenceNode[];
};

type NodeDocument = {
  scope: NodeSessionScope;
  source: string;
  handoff: Handoff | null;
};

function frontmatter(source: string): Record<string, unknown> {
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    source,
  );
  if (!match?.[1]) return {};
  const value: unknown = parse(match[1]);
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(
  value: Record<string, unknown>,
  field: string,
): string | null {
  return typeof value[field] === 'string' && value[field]
    ? value[field] as string
    : null;
}

function nodeDocumentAt(root: string, nodePath: string): NodeDocument | null {
  const absolute = resolveInsideRoot(root, nodePath);
  if (!existsSync(absolute)) return null;
  const source = readFileSync(absolute, 'utf8');
  const fields = frontmatter(source);
  const nodeId = stringField(fields, 'id');
  const nodeKind = stringField(fields, 'kind');
  if (
    nodeId === null
    || (
      nodeKind !== 'roadmap'
      && nodeKind !== 'plan'
      && nodeKind !== 'lesson'
    )
  ) {
    return null;
  }
  let handoff: Handoff | null = null;
  if (/^## Handoff[ \t]*$/m.test(source)) {
    try {
      handoff = parseHandoff(source);
    } catch {
      handoff = null;
    }
  }
  return {
    scope: {
      nodeKind,
      nodeId,
      nodePath,
      parentId: nodeKind === 'roadmap'
        ? null
        : stringField(fields, 'parent_id'),
      parentPath: nodeKind === 'roadmap'
        ? null
        : stringField(fields, 'parent_path'),
    },
    source,
    handoff,
  };
}

function nodePaths(
  root: string,
  kind: NodeSessionScope['nodeKind'],
): string[] {
  if (kind === 'roadmap') return ['ROADMAP.md'];
  const rootPath = resolveInsideRoot(root, '.');
  const paths: string[] = [];
  const absolute = resolveInsideRoot(root, kind === 'plan' ? 'plans' : 'lessons');
  if (existsSync(absolute)) {
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (entry.isFile() && entry.name.endsWith('.md')) {
          paths.push(relative(rootPath, path).replaceAll('\\', '/'));
        }
      }
    };
    visit(absolute);
  }
  return paths.sort();
}

function findNodeDocument(
  root: string,
  kind: NodeSessionScope['nodeKind'],
  nodeId: string,
): NodeDocument | null {
  for (const path of nodePaths(root, kind)) {
    const document = nodeDocumentAt(root, path);
    if (
      document?.scope.nodeKind === kind
      && document.scope.nodeId === nodeId
    ) {
      return document;
    }
  }
  return null;
}

function handoffDocument(root: string, handoffId: string): NodeDocument | null {
  const checkpoint = readRoadmapCheckpoints(root).find((handoff) => (
    handoff.identity.id === handoffId
  ));
  if (checkpoint !== undefined) {
    const roadmap = nodeDocumentAt(root, 'ROADMAP.md');
    return roadmap === null ? null : { ...roadmap, handoff: checkpoint };
  }
  const nodeId = handoffId.replace(/\/handoff$/, '');
  for (const kind of ['lesson', 'plan', 'roadmap'] as const) {
    const document = findNodeDocument(root, kind, nodeId);
    if (document?.handoff?.identity.id === handoffId) return document;
  }
  return null;
}

function sameScope(left: NodeSessionScope, right: NodeSessionScope): boolean {
  return left.nodeKind === right.nodeKind
    && left.nodeId === right.nodeId
    && left.nodePath === right.nodePath;
}

function canAccess(
  requester: NodeSessionScope,
  target: NodeSessionScope,
): boolean {
  if (requester.nodeKind === 'roadmap') {
    return target.nodeKind !== 'roadmap' || sameScope(requester, target);
  }
  if (sameScope(requester, target)) return true;
  return requester.nodeKind === 'plan'
    && target.nodeKind === 'lesson'
    && target.parentId === requester.nodeId
    && target.parentPath === requester.nodePath;
}

function traceAllowed(
  scope: NodeSessionScope,
  trace: { planId: string; lessonId: string },
): boolean {
  return scope.nodeKind === 'roadmap'
    || (scope.nodeKind === 'plan' && trace.planId === scope.nodeId)
    || (scope.nodeKind === 'lesson' && trace.lessonId === scope.nodeId);
}

function combine(children: EvidenceNode[]): EvidenceState {
  if (children.some((child) => child.state === 'forbidden')) return 'forbidden';
  if (children.some((child) => child.state === 'missing')) return 'missing';
  if (children.some((child) => child.state === 'invalidated')) return 'invalidated';
  return 'active';
}

function result(
  source: string,
  label: string,
  state: EvidenceState,
  children: EvidenceNode[] = [],
): EvidenceNode {
  return { source, label, state, children };
}

function exactBlock(source: string, blockId: string): boolean {
  const escaped = blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^## Block ${escaped}(?:（[^）]+）)?[ \\t]*$`,
    'm',
  ).test(source);
}

function memoryLabel(
  root: string,
  owner: 'student' | 'teaching',
  entryId: string,
): string | null {
  const path = owner === 'student'
    ? 'memory/student-profile.md'
    : 'memory/teaching-profile.md';
  const absolute = resolveInsideRoot(root, path);
  if (!existsSync(absolute)) return null;
  const source = readFileSync(absolute, 'utf8');
  const escaped = entryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^### ${escaped}[ \\t]*$`, 'm').exec(source);
  if (!heading) return null;
  const tail = source.slice(heading.index + heading[0].length);
  const end = /^#{1,3} /m.exec(tail)?.index ?? tail.length;
  const body = tail.slice(0, end);
  return /^- Content: (.+)$/m.exec(body)?.[1]?.trim() ?? entryId;
}

function memoryEntry(
  root: string,
  owner: 'student' | 'teaching',
  entryId: string,
) {
  const path = owner === 'student'
    ? 'memory/student-profile.md'
    : 'memory/teaching-profile.md';
  const absolute = resolveInsideRoot(root, path);
  if (!existsSync(absolute)) return null;
  try {
    return parseProfileDocument(readFileSync(absolute, 'utf8'), owner)
      .find((entry) => entry.id === entryId) ?? null;
  } catch {
    return null;
  }
}

function documentSource(
  root: string,
  source: string,
  requester: NodeSessionScope,
): EvidenceNode | null {
  const match = /^((?:plans|lessons)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.md)(?:#[A-Za-z0-9][A-Za-z0-9._=-]*)?$/
    .exec(source);
  if (!match?.[1]) return null;
  const document = nodeDocumentAt(root, match[1]);
  if (!document) return result(source, '来源文档不存在', 'missing');
  return canAccess(requester, document.scope)
    ? result(source, document.scope.nodeId, 'active')
    : result(source, '来源文档不属于当前学习分支', 'forbidden');
}

function resolveHandle(
  root: string,
  source: string,
  handle: SourceHandle,
  requester: NodeSessionScope,
  sessions: SessionEvidenceReader,
  stack: Set<string>,
  expectedOwner: NodeSessionScope | null,
): EvidenceNode {
  if (handle.kind === 'trace') {
    let all;
    let active;
    try {
      all = readTraceRecords(root);
      active = new Set(readActiveTraces(root).map((trace) => trace.sourceRef));
    } catch {
      return result(source, '课堂记录不可读取', 'missing');
    }
    const trace = all.find((entry) => entry.traceId === handle.traceId);
    if (!trace) return result(source, '课堂记录不存在', 'missing');
    if (
      !traceAllowed(requester, trace)
      || (expectedOwner !== null && !traceAllowed(expectedOwner, trace))
    ) {
      return result(source, '课堂记录不属于当前学习分支', 'forbidden');
    }
    return result(
      source,
      trace.note,
      active.has(trace.sourceRef) ? 'active' : 'invalidated',
    );
  }

  if (handle.kind === 'session') {
    const sessionSource = `session:${handle.sessionId}` as const;
    const session = sessions.readSession(sessionSource);
    if (!session) return result(source, '课堂会话不存在', 'missing');
    const ownerDocument = nodeDocumentAt(root, session.ownerPath);
    if (
      ownerDocument === null
      || ownerDocument.scope.nodeId !== session.ownerId
    ) {
      return result(source, '课堂会话归属不可验证', 'missing');
    }
    if (
      !canAccess(requester, ownerDocument.scope)
      || (
        expectedOwner !== null
        && !sameScope(expectedOwner, ownerDocument.scope)
      )
    ) {
      return result(source, '课堂会话不属于当前节点', 'forbidden');
    }
    if (handle.messageId !== null) {
      const message = sessions.readMessage(
        `${sessionSource}#message:${handle.messageId}`,
      );
      return message === null
        ? result(source, '课堂消息不存在', 'missing')
        : result(source, message.text, 'active');
    }
    return result(source, `${session.ownerId} 会话`, 'active');
  }

  if (handle.kind === 'card') {
    const absolute = resolveInsideRoot(root, handle.cardPath);
    return existsSync(absolute)
      ? result(source, handle.cardPath, 'active')
      : result(source, '题卡不存在', 'missing');
  }

  if (handle.kind === 'block') {
    const document = findNodeDocument(root, 'lesson', handle.lessonId);
    if (!document) return result(source, '课堂节点不存在', 'missing');
    if (
      !canAccess(requester, document.scope)
      || (expectedOwner !== null && !canAccess(expectedOwner, document.scope))
    ) {
      return result(source, '课堂节点不属于当前学习分支', 'forbidden');
    }
    return exactBlock(document.source, handle.blockId)
      ? result(source, `${handle.lessonId} / ${handle.blockId}`, 'active')
      : result(source, '课堂步骤不存在', 'missing');
  }

  if (handle.kind === 'memory') {
    const entry = memoryEntry(root, handle.owner, handle.entryId);
    const label = entry?.content
      ?? memoryLabel(root, handle.owner, handle.entryId);
    if (label === null) return result(source, '长期记忆不存在', 'missing');
    if (stack.has(source)) return result(source, '长期记忆存在循环引用', 'forbidden');
    if (entry === null) return result(source, label, 'active');
    const nextStack = new Set(stack);
    nextStack.add(source);
    const children = entry.sources.map((childSource) => resolveSource(
      root,
      childSource,
      requester,
      sessions,
      nextStack,
      null,
    ));
    return result(source, label, combine(children), children);
  }

  const document = handoffDocument(root, handle.handoffId);
  if (!document?.handoff) return result(source, '阶段结论不存在', 'missing');
  if (!canAccess(requester, document.scope)) {
    return result(source, '阶段结论不属于当前学习分支', 'forbidden');
  }
  if (stack.has(source)) return result(source, '阶段结论存在循环引用', 'forbidden');
  const claims = handle.claimKind === 'learner'
    ? document.handoff.learnerClaims
    : document.handoff.teachingClaims;
  const claim = claims.find((entry) => entry.id === handle.claimId);
  if (!claim) return result(source, '阶段结论不存在', 'missing');

  const nextStack = new Set(stack);
  nextStack.add(source);
  const children = claim.sources.map((childSource) => resolveSource(
    root,
    childSource,
    requester,
    sessions,
    nextStack,
    document.scope,
  ));
  return result(source, claim.statement, combine(children), children);
}

function resolveSource(
  root: string,
  source: string,
  requester: NodeSessionScope,
  sessions: SessionEvidenceReader,
  stack: Set<string>,
  expectedOwner: NodeSessionScope | null,
): EvidenceNode {
  const file = documentSource(root, source, requester);
  if (file !== null) return file;
  let handle: SourceHandle;
  try {
    handle = parseSourceHandle(source);
  } catch {
    return result(source, '来源句柄格式无效', 'missing');
  }
  return resolveHandle(
    root,
    source,
    handle,
    requester,
    sessions,
    stack,
    expectedOwner,
  );
}

export function resolveEvidenceTree(
  root: string,
  source: string,
  scope: NodeSessionScope,
  sessions: SessionEvidenceReader,
): EvidenceNode {
  return resolveSource(root, source, scope, sessions, new Set(), null);
}

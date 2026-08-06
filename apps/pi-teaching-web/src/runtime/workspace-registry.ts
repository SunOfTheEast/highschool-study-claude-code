import type { ImageContent } from '@earendil-works/pi-ai';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import type {
  CourseTreeNode,
  LessonDocument,
  PlanDocument,
  RoadmapDocument,
  SessionKey,
} from '../shared/contracts';
import { readCourseTree, readLesson, readPlan, readRoadmap } from '../study/markdown';
import { setFrontmatterField } from './frontmatter';
import {
  sessionFactoryInput,
  type StudySession,
  type StudySessionFactory,
} from './session-factory';
import { findOwnedPiSessionFile, readPiSessionBranch } from './session-owner';
import { type NodeSessionScope } from './session-scope';

export type SessionFileLookup = (
  root: string,
  sessionId: string,
  scope: NodeSessionScope,
) => Promise<string | null>;

export type SessionBranchReader = (
  root: string,
  sessionFile: string,
) => Promise<readonly SessionEntry[]>;

type OwnedNode = {
  tree: CourseTreeNode;
  parent: CourseTreeNode | null;
  document: RoadmapDocument | PlanDocument | LessonDocument;
  scope: NodeSessionScope;
};

function findNode(
  node: CourseTreeNode,
  key: SessionKey,
  parent: CourseTreeNode | null = null,
): { tree: CourseTreeNode; parent: CourseTreeNode | null } | null {
  if (node.sessionKey === key) return { tree: node, parent };
  for (const child of node.children) {
    const found = findNode(child, key, node);
    if (found) return found;
  }
  return null;
}

export class WorkspaceRegistry {
  private readonly sessions = new Map<SessionKey, StudySession>();
  private readonly opening = new Map<SessionKey, Promise<StudySession>>();
  private readonly turnTails = new Map<SessionKey, Promise<void>>();

  constructor(
    private readonly root: string,
    private readonly factory: StudySessionFactory,
    private readonly lookup: SessionFileLookup = findOwnedPiSessionFile,
    private readonly readBranch: SessionBranchReader = readPiSessionBranch,
  ) {}

  private owner(key: SessionKey): OwnedNode {
    const course = readCourseTree(this.root);
    const located = findNode(course.tree, key);
    if (!located) throw new Error(`SESSION_NODE_NOT_FOUND: ${key}`);
    const kind = located.tree.kind;
    const id = located.tree.id;
    const document = kind === 'roadmap'
      ? readRoadmap(this.root)
      : kind === 'plan'
        ? readPlan(this.root, located.tree.path)
        : readLesson(this.root, located.tree.path);
    return {
      ...located,
      document,
      scope: {
        nodeKind: kind,
        nodeId: id,
        nodePath: located.tree.path,
        parentId: located.parent?.id ?? null,
        parentPath: located.parent?.path ?? null,
      },
    };
  }

  async open(key: SessionKey): Promise<StudySession> {
    const cached = this.sessions.get(key);
    if (cached) return cached;
    const underway = this.opening.get(key);
    if (underway) return underway;
    const opening = this.openNew(key);
    this.opening.set(key, opening);
    try {
      return await opening;
    } finally {
      this.opening.delete(key);
    }
  }

  private async openNew(key: SessionKey): Promise<StudySession> {
    const owner = this.owner(key);
    if (owner.document.status !== 'active') {
      throw new Error(`SESSION_NODE_NOT_ACTIVE: ${key}:${owner.document.status}`);
    }
    const sessionFile = owner.document.sessionId === null
      ? null
      : await this.lookup(this.root, owner.document.sessionId, owner.scope);
    if (owner.document.sessionId !== null && sessionFile === null) {
      throw new Error(`SESSION_FILE_NOT_FOUND: ${owner.document.sessionId}`);
    }
    const session = await this.factory(sessionFactoryInput(owner.scope, sessionFile));
    if (owner.document.sessionId === null) {
      setFrontmatterField(this.root, owner.document.path, 'session_id', session.sessionId, null);
    }
    this.sessions.set(key, session);
    return session;
  }

  async send(key: SessionKey, text: string, images: ImageContent[] = []): Promise<void> {
    const previous = this.turnTails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const session = await this.open(key);
      await session.prompt(text, images);
    });
    this.turnTails.set(key, next);
    try {
      await next;
    } finally {
      if (this.turnTails.get(key) === next) this.turnTails.delete(key);
    }
  }

  async readHistory(key: SessionKey): Promise<readonly SessionEntry[]> {
    const cached = this.sessions.get(key);
    if (cached) return cached.entries;
    const owner = this.owner(key);
    if (owner.document.sessionId === null) return [];
    const sessionFile = await this.lookup(this.root, owner.document.sessionId, owner.scope);
    if (!sessionFile) throw new Error(`SESSION_FILE_NOT_FOUND: ${owner.document.sessionId}`);
    return this.readBranch(this.root, sessionFile);
  }

  async subscribe(
    key: SessionKey,
    listener: (event: AgentSessionEvent) => void,
  ): Promise<() => void> {
    return (await this.open(key)).subscribe(listener);
  }

  async abort(key: SessionKey): Promise<void> {
    const session = this.sessions.get(key);
    if (session?.isStreaming) await session.abort();
  }

  async release(key: SessionKey): Promise<void> {
    await this.abort(key);
    this.sessions.get(key)?.dispose();
    this.sessions.delete(key);
    this.opening.delete(key);
    this.turnTails.delete(key);
  }

  dispose(): void {
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.opening.clear();
    this.turnTails.clear();
  }
}

import type { ImageContent } from '@earendil-works/pi-ai';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import type {
  CourseTreeNode,
  FreeLearningSessionSummary,
  LearningContextReference,
  LessonDocument,
  MetaSessionSummary,
  PlanDocument,
  RoadmapDocument,
  SessionKey,
} from '../shared/contracts';
import { readCourseTree, readLesson, readPlan, readRoadmap } from '../study/markdown';
import { readMaterialLocator } from '../study/materials';
import { isProblemCardId } from '../study/problem-card-id';
import { setFrontmatterField } from './frontmatter';
import {
  sessionFactoryInput,
  type StudySession,
  type StudySessionFactory,
} from './session-factory';
import {
  findFreeLearningPiSession,
  findMetaPiSession,
  findOwnedPiSessionFile,
  FREE_LEARNING_ENDED_TYPE,
  isFreeLearningEnded,
  listFreeLearningPiSessions,
  listMetaPiSessions,
  listPiSessionFacts,
  readPiSessionBranch,
  sessionOwnerMatches,
  type PiSessionFact,
} from './session-owner';
import {
  freeLearningSessionId,
  freeLearningSessionKey,
  isFreeLearningScope,
  isMetaScope,
  metaSessionId,
  metaSessionKey,
  type FreeLearningSessionRecord,
  type FreeLearningSessionScope,
  type MetaSessionRecord,
  type MetaSessionScope,
  type NodeSessionScope,
} from './session-scope';
import type { OwnedLearningSessionFact } from '../study/learning-footprint';
import { projectConversationEntries } from '../projection/conversation';
import { deriveFreeLearningTitle } from '../study/display-projections';
import {
  createFocusCycleRepository,
  type FocusCycleRepository,
  type FocusCycleSnapshot,
  type FocusEnded,
  type FocusTargetSeconds,
} from '../time/focus-cycle';
import {
  ensureFocusEndedMessage,
  ensureFocusStartedMessage,
  hasFocusEndedMessage,
} from './session-custom-messages';

export type SessionFileLookup = (
  root: string,
  sessionId: string,
  scope: NodeSessionScope,
) => Promise<string | null>;

export type SessionBranchReader = (
  root: string,
  sessionFile: string,
) => Promise<readonly SessionEntry[]>;

export type FreeLearningSessionLookup = (
  root: string,
  sessionId: string,
) => Promise<FreeLearningSessionRecord | null>;

export type FreeLearningSessionList = (
  root: string,
) => Promise<FreeLearningSessionRecord[]>;

export type MetaSessionLookup = (
  root: string,
  sessionId: string,
) => Promise<MetaSessionRecord | null>;

export type MetaSessionList = (root: string) => Promise<MetaSessionRecord[]>;

export type PiSessionFactList = (root: string) => Promise<PiSessionFact[]>;

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

function checkedSelectedAssets(
  root: string,
  selectedAssets: readonly LearningContextReference[],
): LearningContextReference[] {
  if (selectedAssets.length > 12) throw new Error('SELECTED_CONTEXT_LIMIT_EXCEEDED');
  const seen = new Set<string>();
  return selectedAssets.map((asset) => {
    if (asset.kind === 'material') {
      if (
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(asset.id)
        || !Number.isSafeInteger(asset.revision)
        || asset.revision < 1
        || (asset.locator !== null && (!asset.locator.trim() || /[\r\n\t]/.test(asset.locator)))
      ) throw new Error('SELECTED_CONTEXT_INVALID');
      readMaterialLocator(root, asset);
      const key = `material:${asset.id}@${asset.revision}#${asset.locator ?? ''}`;
      if (seen.has(key)) throw new Error(`SELECTED_CONTEXT_DUPLICATE: ${key}`);
      seen.add(key);
      return { ...asset };
    }
    if (
      (asset.kind !== 'note' && asset.kind !== 'problem-card')
      || (asset.kind === 'note'
        ? !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(asset.id)
        : !isProblemCardId(asset.id))
    ) {
      throw new Error('SELECTED_CONTEXT_INVALID');
    }
    const key = `${asset.kind}:${asset.id}`;
    if (seen.has(key)) throw new Error(`SELECTED_CONTEXT_DUPLICATE: ${key}`);
    seen.add(key);
    return { kind: asset.kind, id: asset.id };
  });
}

function publicSummary(record: FreeLearningSessionRecord): FreeLearningSessionSummary {
  const { sessionFile: _sessionFile, scope: _scope, ...summary } = record;
  return {
    ...summary,
    selectedAssets: record.scope.selectedAssets.map((asset) => ({ ...asset })),
  };
}

function publicMetaSummary(record: MetaSessionRecord): MetaSessionSummary {
  const { sessionFile: _sessionFile, scope: _scope, ...summary } = record;
  return summary;
}

export class WorkspaceRegistry {
  private readonly sessions = new Map<SessionKey, StudySession>();
  private readonly opening = new Map<SessionKey, Promise<StudySession>>();
  private readonly turnTails = new Map<SessionKey, Promise<void>>();
  private readonly freeRecords = new Map<string, FreeLearningSessionRecord>();
  private readonly metaRecords = new Map<string, MetaSessionRecord>();
  private readonly focusCycles: FocusCycleRepository;
  private endingFocus: FocusEnded | null = null;

  constructor(
    private readonly root: string,
    private readonly factory: StudySessionFactory,
    private readonly lookup: SessionFileLookup = findOwnedPiSessionFile,
    private readonly readBranch: SessionBranchReader = readPiSessionBranch,
    private readonly lookupFree: FreeLearningSessionLookup = findFreeLearningPiSession,
    private readonly listFree: FreeLearningSessionList = listFreeLearningPiSessions,
    private readonly lookupMeta: MetaSessionLookup = findMetaPiSession,
    private readonly listMetaSessions: MetaSessionList = listMetaPiSessions,
    private readonly listSessionFacts: PiSessionFactList = listPiSessionFacts,
    focusCycles?: FocusCycleRepository,
  ) {
    this.focusCycles = focusCycles ?? createFocusCycleRepository(root);
  }

  private async displayFreeSummary(
    record: FreeLearningSessionRecord,
  ): Promise<FreeLearningSessionSummary> {
    const entries = this.sessions.get(record.sessionKey)?.entries
      ?? await this.readBranch(this.root, record.sessionFile);
    return {
      ...publicSummary(record),
      title: deriveFreeLearningTitle(projectConversationEntries(record.sessionKey, entries)),
    };
  }

  private nodeOwner(key: SessionKey): OwnedNode {
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

  async createFreeLearning(
    selectedAssets: readonly LearningContextReference[],
  ): Promise<FreeLearningSessionSummary> {
    const createdAt = new Date().toISOString();
    const scope: FreeLearningSessionScope = {
      sessionKind: 'free-learning',
      title: '自由学习',
      createdAt,
      selectedAssets: checkedSelectedAssets(this.root, selectedAssets),
    };
    const session = await this.factory(sessionFactoryInput(scope, null));
    if (!session.sessionFile) {
      session.dispose();
      throw new Error('FREE_LEARNING_SESSION_NOT_PERSISTED');
    }
    const sessionKey = freeLearningSessionKey(session.sessionId);
    const record: FreeLearningSessionRecord = {
      id: session.sessionId,
      sessionKey,
      title: scope.title,
      createdAt,
      updatedAt: createdAt,
      status: 'active',
      selectedAssets: scope.selectedAssets.map((asset) => ({ ...asset })),
      sessionFile: session.sessionFile,
      scope,
    };
    this.sessions.set(sessionKey, session);
    this.freeRecords.set(session.sessionId, record);
    return publicSummary(record);
  }

  async listFreeLearning(): Promise<FreeLearningSessionSummary[]> {
    const records = new Map<string, FreeLearningSessionRecord>();
    for (const record of await this.listFree(this.root)) records.set(record.id, record);
    for (const record of this.freeRecords.values()) records.set(record.id, record);
    const ordered = [...records.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.all(ordered.map((record) => this.displayFreeSummary(record)));
  }

  async createMeta(
    selectedAssets: readonly LearningContextReference[],
  ): Promise<MetaSessionSummary> {
    const createdAt = new Date().toISOString();
    const scope: MetaSessionScope = {
      sessionKind: 'meta',
      title: '长期学习规划',
      createdAt,
      selectedAssets: checkedSelectedAssets(this.root, selectedAssets),
    };
    const session = await this.factory(sessionFactoryInput(scope, null));
    if (!session.sessionFile) {
      session.dispose();
      throw new Error('META_SESSION_NOT_PERSISTED');
    }
    const sessionKey = metaSessionKey(session.sessionId);
    const record: MetaSessionRecord = {
      id: session.sessionId,
      sessionKey,
      title: scope.title,
      createdAt,
      updatedAt: createdAt,
      sessionFile: session.sessionFile,
      scope,
    };
    this.sessions.set(sessionKey, session);
    this.metaRecords.set(session.sessionId, record);
    return publicMetaSummary(record);
  }

  async listMeta(): Promise<MetaSessionSummary[]> {
    const records = new Map<string, MetaSessionRecord>();
    for (const record of await this.listMetaSessions(this.root)) records.set(record.id, record);
    for (const record of this.metaRecords.values()) records.set(record.id, record);
    return [...records.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(publicMetaSummary);
  }

  async listOwnedSessionFacts(): Promise<OwnedLearningSessionFact[]> {
    const verified: OwnedLearningSessionFact[] = [];
    for (const fact of await this.listSessionFacts(this.root)) {
      if (isFreeLearningScope(fact.owner)) {
        verified.push({
          id: fact.id,
          createdAt: fact.createdAt,
          entryTimes: fact.entryTimes,
          owner: fact.owner,
          title: fact.owner.title,
          status: fact.endedAt === null ? 'active' : 'ended',
        });
        continue;
      }
      if (isMetaScope(fact.owner)) {
        verified.push({
          id: fact.id,
          createdAt: fact.createdAt,
          entryTimes: fact.entryTimes,
          owner: fact.owner,
          title: fact.owner.title,
          status: 'active',
        });
        continue;
      }
      let current: OwnedNode;
      try {
        current = this.nodeOwner(`${fact.owner.nodeKind}:${fact.owner.nodeId}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('SESSION_NODE_NOT_FOUND:')) continue;
        throw error;
      }
      if (
        current.document.sessionId !== fact.id
        || !sessionOwnerMatches(fact.owner, current.scope)
      ) continue;
      verified.push({
        id: fact.id,
        createdAt: fact.createdAt,
        entryTimes: fact.entryTimes,
        title: current.document.title,
        owner: current.scope,
        status: current.document.status,
      });
    }
    return verified;
  }

  async open(key: SessionKey): Promise<StudySession> {
    const cached = this.sessions.get(key);
    if (cached) {
      if (freeLearningSessionId(key) === null && metaSessionId(key) === null) {
        const owner = this.nodeOwner(key);
        if (owner.document.status !== 'active') {
          throw new Error(`SESSION_NODE_NOT_ACTIVE: ${key}:${owner.document.status}`);
        }
      }
      return cached;
    }
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

  private async freeRecord(sessionId: string): Promise<FreeLearningSessionRecord> {
    const local = this.freeRecords.get(sessionId);
    if (local) return local;
    const persisted = await this.lookupFree(this.root, sessionId);
    if (!persisted) throw new Error(`FREE_LEARNING_SESSION_NOT_FOUND: ${sessionId}`);
    this.freeRecords.set(sessionId, persisted);
    return persisted;
  }

  private async metaRecord(sessionId: string): Promise<MetaSessionRecord> {
    const local = this.metaRecords.get(sessionId);
    if (local) return local;
    const persisted = await this.lookupMeta(this.root, sessionId);
    if (!persisted) throw new Error(`META_SESSION_NOT_FOUND: ${sessionId}`);
    this.metaRecords.set(sessionId, persisted);
    return persisted;
  }

  private async openNew(key: SessionKey): Promise<StudySession> {
    const metaId = metaSessionId(key);
    if (metaId !== null) {
      const record = await this.metaRecord(metaId);
      const session = await this.factory(sessionFactoryInput(record.scope, record.sessionFile));
      if (session.sessionId !== record.id) {
        session.dispose();
        throw new Error(`META_SESSION_OWNER_MISMATCH: ${record.id}`);
      }
      this.sessions.set(key, session);
      return session;
    }
    const freeId = freeLearningSessionId(key);
    if (freeId !== null) {
      const record = await this.freeRecord(freeId);
      const session = await this.factory(sessionFactoryInput(record.scope, record.sessionFile));
      if (session.sessionId !== record.id) {
        session.dispose();
        throw new Error(`FREE_LEARNING_SESSION_OWNER_MISMATCH: ${record.id}`);
      }
      this.sessions.set(key, session);
      return session;
    }

    const owner = this.nodeOwner(key);
    if (owner.document.status !== 'active') {
      throw new Error(`SESSION_NODE_NOT_ACTIVE: ${key}:${owner.document.status}`);
    }
    const previousSessionId = owner.document.sessionId;
    const sessionFile = previousSessionId === null
      ? null
      : await this.lookup(this.root, previousSessionId, owner.scope);
    const session = await this.factory(sessionFactoryInput(owner.scope, sessionFile));
    if (previousSessionId === null || sessionFile === null) {
      setFrontmatterField(
        this.root,
        owner.document.path,
        'session_id',
        session.sessionId,
        previousSessionId,
      );
    }
    this.sessions.set(key, session);
    return session;
  }

  async send(key: SessionKey, text: string, images: ImageContent[] = []): Promise<void> {
    const previous = this.turnTails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const session = await this.open(key);
      if (freeLearningSessionId(key) !== null && isFreeLearningEnded(session.entries)) {
        throw new Error(`FREE_LEARNING_SESSION_ENDED: ${key}`);
      }
      await session.prompt(text, images);
      const freeId = freeLearningSessionId(key);
      if (freeId !== null) {
        const record = await this.freeRecord(freeId);
        this.freeRecords.set(freeId, { ...record, updatedAt: new Date().toISOString() });
      }
      const metaId = metaSessionId(key);
      if (metaId !== null) {
        const record = await this.metaRecord(metaId);
        this.metaRecords.set(metaId, { ...record, updatedAt: new Date().toISOString() });
      }
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
    const metaId = metaSessionId(key);
    if (metaId !== null) {
      const record = await this.metaRecord(metaId);
      return this.readBranch(this.root, record.sessionFile);
    }
    const freeId = freeLearningSessionId(key);
    if (freeId !== null) {
      const record = await this.freeRecord(freeId);
      return this.readBranch(this.root, record.sessionFile);
    }
    const owner = this.nodeOwner(key);
    if (owner.document.sessionId === null) return [];
    const sessionFile = await this.lookup(this.root, owner.document.sessionId, owner.scope);
    if (!sessionFile) return [];
    return this.readBranch(this.root, sessionFile);
  }

  private async activeFocusSession(key: SessionKey): Promise<StudySession> {
    const freeId = freeLearningSessionId(key);
    if (freeId !== null) {
      const record = await this.freeRecord(freeId);
      if (record.status !== 'active') throw new Error('FOCUS_SESSION_INELIGIBLE');
      const session = await this.open(key);
      if (isFreeLearningEnded(session.entries)) throw new Error('FOCUS_SESSION_INELIGIBLE');
      return session;
    }
    if (!key.startsWith('lesson:')) throw new Error('FOCUS_SESSION_INELIGIBLE');
    let owner: OwnedNode;
    try {
      owner = this.nodeOwner(key);
    } catch {
      throw new Error('FOCUS_SESSION_INELIGIBLE');
    }
    if (owner.scope.nodeKind !== 'lesson' || owner.document.status !== 'active') {
      throw new Error('FOCUS_SESSION_INELIGIBLE');
    }
    return this.open(key);
  }

  async startFocus(
    key: SessionKey,
    targetSeconds: FocusTargetSeconds,
  ): Promise<FocusCycleSnapshot> {
    if (this.focusCycles.read()) throw new Error('FOCUS_CYCLE_ALREADY_ACTIVE');
    const session = await this.activeFocusSession(key);
    const state = this.focusCycles.start(key, session.sessionId, targetSeconds);
    try {
      await ensureFocusStartedMessage(session, state);
    } catch (error) {
      this.focusCycles.remove(state.cycleId);
      throw error;
    }
    return this.focusCycles.snapshot()!;
  }

  async readFocus(): Promise<FocusCycleSnapshot | null> {
    if (this.endingFocus) return null;
    const state = this.focusCycles.read();
    if (!state) return null;
    const session = await this.activeFocusSession(state.sessionKey);
    if (session.sessionId !== state.sessionId) throw new Error('FOCUS_SESSION_OWNER_MISMATCH');
    if (hasFocusEndedMessage(session.entries, state.cycleId)) {
      this.focusCycles.remove(state.cycleId);
      return null;
    }
    await ensureFocusStartedMessage(session, state);
    const snapshot = this.focusCycles.snapshot();
    if (snapshot?.expired) {
      await this.endFocus('elapsed');
      return null;
    }
    return snapshot;
  }

  pauseFocus(): FocusCycleSnapshot {
    this.focusCycles.pause();
    return this.focusCycles.snapshot()!;
  }

  resumeFocus(): FocusCycleSnapshot {
    this.focusCycles.resume();
    return this.focusCycles.snapshot()!;
  }

  async endFocus(
    reason: 'elapsed' | 'manual' = 'manual',
    triggerTurn = true,
  ): Promise<FocusEnded> {
    if (this.endingFocus) return this.endingFocus;
    const state = this.focusCycles.read();
    if (!state) throw new Error('FOCUS_CYCLE_NOT_ACTIVE');
    const session = await this.activeFocusSession(state.sessionKey);
    if (session.sessionId !== state.sessionId) throw new Error('FOCUS_SESSION_OWNER_MISMATCH');
    await ensureFocusStartedMessage(session, state);
    const event = this.focusCycles.terminal(reason);
    this.endingFocus = event;
    void ensureFocusEndedMessage(session, event, triggerTurn).then(() => {
      if (hasFocusEndedMessage(session.entries, state.cycleId)) {
        this.focusCycles.remove(state.cycleId);
      }
      this.endingFocus = null;
    }, () => {
      this.endingFocus = null;
    });
    return event;
  }

  async endFocusForSession(key: SessionKey): Promise<FocusEnded | null> {
    const state = this.focusCycles.read();
    if (!state || state.sessionKey !== key) return null;
    const session = this.sessions.get(key) ?? await this.activeFocusSession(key);
    if (session.sessionId !== state.sessionId) throw new Error('FOCUS_SESSION_OWNER_MISMATCH');
    await ensureFocusStartedMessage(session, state);
    const event = this.focusCycles.terminal('session-ended');
    await ensureFocusEndedMessage(session, event, false);
    if (hasFocusEndedMessage(session.entries, event.cycleId)) {
      this.focusCycles.remove(event.cycleId);
    }
    return event;
  }

  async endFreeLearning(key: SessionKey): Promise<FreeLearningSessionSummary> {
    const id = freeLearningSessionId(key);
    if (id === null) throw new Error(`FREE_LEARNING_SESSION_KEY_INVALID: ${key}`);
    const session = await this.open(key);
    if (isFreeLearningEnded(session.entries)) {
      return this.displayFreeSummary({ ...await this.freeRecord(id), status: 'ended' });
    }
    if (session.isStreaming || this.turnTails.has(key)) {
      throw new Error(`FREE_LEARNING_SESSION_RUNNING: ${key}`);
    }
    const focus = this.focusCycles.read();
    if (focus?.sessionKey === key) {
      const event = this.focusCycles.terminal('session-ended');
      await ensureFocusEndedMessage(session, event, false);
      if (hasFocusEndedMessage(session.entries, event.cycleId)) {
        this.focusCycles.remove(event.cycleId);
      }
    }
    if (!session.appendCustomEntry) throw new Error('FREE_LEARNING_LIFECYCLE_UNAVAILABLE');
    const endedAt = new Date().toISOString();
    session.appendCustomEntry(FREE_LEARNING_ENDED_TYPE, { endedAt });
    const next: FreeLearningSessionRecord = {
      ...await this.freeRecord(id),
      status: 'ended',
      updatedAt: endedAt,
    };
    this.freeRecords.set(id, next);
    return this.displayFreeSummary(next);
  }

  async subscribe(
    key: SessionKey,
    listener: (event: AgentSessionEvent) => void,
  ): Promise<() => void> {
    return (await this.open(key)).subscribe(listener);
  }

  async abort(key: SessionKey): Promise<void> {
    const tail = this.turnTails.get(key);
    const session = this.sessions.get(key);
    if (session?.isStreaming) await session.abort();
    await tail?.catch(() => {});
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
    this.endingFocus = null;
    this.freeRecords.clear();
    this.metaRecords.clear();
  }
}

import {
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import type { SessionKey } from '../shared/contracts';
import {
  parseActivationSnapshot,
  sealActivationSnapshot,
} from '../study/activation-snapshot';
import {
  readLearningSet,
  readPlanWorkspace,
} from '../study/read-workspace';
import { validatePreparedLesson } from '../study/validate-prepared-lesson';
import type {
  StudySession,
  StudySessionFactory,
} from './session-factory';
import { sessionFactoryInput } from './session-factory';
import type { NodeSessionScope } from './session-scope';
import { sessionKeyForNode } from './session-scope';

export type ActivationReceipt = {
  nodeKind: 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  sessionKey: SessionKey;
  sessionId: string;
  shouldKickoff: boolean;
};

export type SessionFileLookup = (
  root: string,
  sessionId: string,
  expected: NodeSessionScope,
) => Promise<string | null>;

type NodeCommit = (nodePath: string, source: string) => void;

export type NodeActivationServiceOptions = {
  root: string;
  factory: StudySessionFactory;
  lookup: SessionFileLookup;
  sessions: Map<string, StudySession>;
  now?: () => Date;
  commitNode?: NodeCommit;
};

type ActivatableNode = {
  scope: NodeSessionScope & { nodeKind: 'plan' | 'lesson' };
  status: string;
  sessionId: string | null;
  sessionField: 'coach_session' | 'tutor_session';
  source: string;
};

function scalar(
  frontmatter: Record<string, unknown>,
  key: string,
): string | null {
  return typeof frontmatter[key] === 'string'
    ? frontmatter[key] as string
    : null;
}

function replaceFrontmatterField(
  source: string,
  nodePath: string,
  field: string,
  value: string,
): string {
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(source);
  if (!match?.[2]) throw new Error(`FRONTMATTER_REQUIRED: ${nodePath}`);
  const line = new RegExp(`^${field}:.*$`, 'm');
  const body = line.test(match[2])
    ? match[2].replace(line, `${field}: ${value}`)
    : `${match[2]}\n${field}: ${value}`;
  return source.replace(match[0], `${match[1]}${body}${match[3]}`);
}

function defaultNodeCommit(root: string): NodeCommit {
  return (nodePath, source) => {
    const absolute = resolveInsideRoot(root, nodePath);
    const temporary = `${absolute}.studyforge-activate-${process.pid}-${Date.now()}`;
    try {
      writeFileSync(temporary, source);
      renameSync(temporary, absolute);
    } finally {
      rmSync(temporary, { force: true });
    }
  };
}

function planTerminal(status: string): boolean {
  return status === 'completed' || status === 'abandoned';
}

function lessonTerminal(status: string): boolean {
  return status === 'closed' || status === 'abandoned';
}

function assertDependencies(
  handle: string,
  entries: ReturnType<typeof readLearningSet>['planTree'],
  terminal: (status: string) => boolean,
): void {
  const current = entries.find((entry) => entry.handle === handle);
  if (!current) throw new Error(`NODE_TREE_ENTRY_NOT_FOUND: ${handle}`);
  for (const dependency of current.dependsOn) {
    const entry = entries.find((candidate) => candidate.handle === dependency);
    if (!entry || !terminal(entry.status)) {
      throw new Error(`NODE_DEPENDENCY_UNMET: ${dependency}`);
    }
  }
}

function validateSnapshot(
  node: ActivatableNode,
  expectedParent: string,
): void {
  const snapshot = parseActivationSnapshot(node.source);
  if (snapshot.parent !== expectedParent) {
    throw new Error(`ACTIVATION_PARENT_MISMATCH: ${node.scope.nodePath}`);
  }
  if (node.status === 'prepared' && snapshot.activatedAt !== 'pending') {
    throw new Error(`PREPARED_ACTIVATION_ALREADY_SEALED: ${node.scope.nodeId}`);
  }
  if (node.status !== 'prepared' && snapshot.activatedAt === 'pending') {
    throw new Error(`ACTIVE_ACTIVATION_NOT_SEALED: ${node.scope.nodeId}`);
  }
}

export class NodeActivationService {
  private readonly pending = new Map<string, Promise<ActivationReceipt>>();
  private readonly planSlots = new Map<string, Promise<void>>();
  private readonly now: () => Date;
  private readonly commitNode: NodeCommit;

  constructor(private readonly options: NodeActivationServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.commitNode = options.commitNode ?? defaultNodeCommit(options.root);
  }

  activatePlan(planId: string): Promise<ActivationReceipt> {
    return this.coalesce(`plan:${planId}`, () => {
      const learningSet = readLearningSet(this.options.root);
      const candidate = learningSet.planTree.find(
        (entry) => entry.handle === planId && entry.nodeId === null,
      );
      if (candidate) throw new Error(`NODE_CANDIDATE_NOT_ACTIVATABLE: ${planId}`);
      const entry = learningSet.planTree.find(
        (item) => item.nodeId === planId,
      );
      if (!entry?.path) throw new Error(`PLAN_NOT_FOUND: ${planId}`);
      if (
        !['prepared', 'active', 'paused'].includes(entry.status)
      ) {
        throw new Error(`PLAN_NOT_ACTIVATABLE: ${entry.status}`);
      }
      if (entry.status === 'prepared') {
        assertDependencies(entry.handle, learningSet.planTree, planTerminal);
      }
      const document = readMarkdownFile(this.options.root, entry.path);
      const source = readFileSync(
        resolveInsideRoot(this.options.root, entry.path),
        'utf8',
      );
      const node: ActivatableNode = {
        scope: {
          nodeKind: 'plan',
          nodeId: planId,
          nodePath: entry.path,
          parentId: 'roadmap',
          parentPath: 'ROADMAP.md',
        },
        status: entry.status,
        sessionId: scalar(document.frontmatter, 'coach_session'),
        sessionField: 'coach_session',
        source,
      };
      validateSnapshot(node, 'roadmap:roadmap');
      return this.activate(node);
    });
  }

  activateLesson(lessonId: string): Promise<ActivationReceipt> {
    return this.coalesce(`lesson:${lessonId}`, async () => {
      const learningSet = readLearningSet(this.options.root);
      for (const plan of learningSet.plans) {
        const workspace = readPlanWorkspace(this.options.root, plan.id);
        const candidate = workspace.lessonTree.find(
          (entry) => entry.handle === lessonId && entry.nodeId === null,
        );
        if (candidate) {
          throw new Error(`NODE_CANDIDATE_NOT_ACTIVATABLE: ${lessonId}`);
        }
        const entry = workspace.lessonTree.find(
          (item) => item.nodeId === lessonId,
        );
        if (!entry?.path) continue;
        return this.withPlanSlot(plan.id, () => (
          this.activateLessonWithinPlan(plan.id, lessonId)
        ));
      }
      throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    });
  }

  private async activateLessonWithinPlan(
    planId: string,
    lessonId: string,
  ): Promise<ActivationReceipt> {
    const workspace = readPlanWorkspace(this.options.root, planId);
    const entry = workspace.lessonTree.find(
      (item) => item.nodeId === lessonId,
    );
    if (!entry?.path) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
    if (workspace.plan.status !== 'active') {
      throw new Error(`PARENT_PLAN_NOT_ACTIVE: ${workspace.plan.status}`);
    }
    if (!['prepared', 'active', 'paused'].includes(entry.status)) {
      throw new Error(`LESSON_NOT_ACTIVATABLE: ${entry.status}`);
    }
    const occupied = workspace.lessons.find(
      (lesson) => lesson.id !== lessonId
        && (lesson.status === 'active' || lesson.status === 'paused'),
    );
    if (occupied) {
      throw new Error(`PLAN_LESSON_SLOT_OCCUPIED: ${occupied.id}`);
    }
    if (entry.status === 'prepared') {
      assertDependencies(entry.handle, workspace.lessonTree, lessonTerminal);
      validatePreparedLesson(this.options.root, entry.path);
    }
    const document = readMarkdownFile(this.options.root, entry.path);
    const source = readFileSync(
      resolveInsideRoot(this.options.root, entry.path),
      'utf8',
    );
    const node: ActivatableNode = {
      scope: {
        nodeKind: 'lesson',
        nodeId: lessonId,
        nodePath: entry.path,
        parentId: planId,
        parentPath: workspace.plan.path,
      },
      status: entry.status,
      sessionId: scalar(document.frontmatter, 'tutor_session'),
      sessionField: 'tutor_session',
      source,
    };
    validateSnapshot(node, `plan:${planId}`);
    return this.activate(node);
  }

  private async coalesce(
    key: string,
    start: () => Promise<ActivationReceipt>,
  ): Promise<ActivationReceipt> {
    const active = this.pending.get(key);
    if (active) {
      const receipt = await active;
      return { ...receipt, shouldKickoff: false };
    }
    const operation = start();
    this.pending.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.pending.get(key) === operation) this.pending.delete(key);
    }
  }

  private async withPlanSlot<T>(
    planId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.planSlots.get(planId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => gate);
    this.planSlots.set(planId, tail);
    await previous.catch(() => {});
    try {
      return await task();
    } finally {
      release();
      if (this.planSlots.get(planId) === tail) {
        this.planSlots.delete(planId);
      }
    }
  }

  private async activate(node: ActivatableNode): Promise<ActivationReceipt> {
    const sessionKey = sessionKeyForNode(node.scope);
    const cached = this.options.sessions.get(sessionKey);
    if (cached && node.status === 'active') {
      return {
        nodeKind: node.scope.nodeKind,
        nodeId: node.scope.nodeId,
        nodePath: node.scope.nodePath,
        sessionKey,
        sessionId: cached.sessionId,
        shouldKickoff: false,
      };
    }
    if (cached && node.status === 'prepared') {
      throw new Error(
        `PREPARED_NODE_HAS_LIVE_SESSION: ${node.scope.nodeId}`,
      );
    }

    const reusingLivePaused = cached !== undefined && node.status === 'paused';
    const sessionFile = reusingLivePaused
      ? null
      : node.status === 'prepared' || node.sessionId === null
        ? null
        : await this.options.lookup(
          this.options.root,
          node.sessionId,
          node.scope,
        );
    const session = reusingLivePaused
      ? cached
      : await this.options.factory(
        sessionFactoryInput(node.scope, sessionFile),
      );
    if (!session) throw new Error(`NODE_SESSION_REQUIRED: ${node.scope.nodeId}`);
    const createdSession = !reusingLivePaused;
    const shouldKickoff = node.status !== 'active';
    let next = node.source;
    if (node.status === 'prepared') {
      next = sealActivationSnapshot(next, this.now());
    }
    next = replaceFrontmatterField(
      next,
      node.scope.nodePath,
      node.sessionField,
      session.sessionId,
    );
    next = replaceFrontmatterField(
      next,
      node.scope.nodePath,
      'status',
      'active',
    );

    let committed = false;
    try {
      if (next !== node.source) {
        this.commitNode(node.scope.nodePath, next);
        committed = true;
      }
      const stored = readMarkdownFile(
        this.options.root,
        node.scope.nodePath,
      );
      const snapshot = parseActivationSnapshot(
        readFileSync(
          resolveInsideRoot(this.options.root, node.scope.nodePath),
          'utf8',
        ),
      );
      if (
        stored.frontmatter.status !== 'active'
        || stored.frontmatter[node.sessionField] !== session.sessionId
        || snapshot.activatedAt === 'pending'
      ) {
        throw new Error(`NODE_ACTIVATION_COMMIT_FAILED: ${node.scope.nodeId}`);
      }
    } catch (error) {
      if (committed) {
        try {
          this.commitNode(node.scope.nodePath, node.source);
        } catch {
          // The original activation error remains the useful failure.
        }
      }
      if (createdSession) session.dispose();
      throw error;
    }

    this.options.sessions.set(sessionKey, session);
    const receipt: ActivationReceipt = {
      nodeKind: node.scope.nodeKind,
      nodeId: node.scope.nodeId,
      nodePath: node.scope.nodePath,
      sessionKey,
      sessionId: session.sessionId,
      shouldKickoff,
    };
    return receipt;
  }
}

import type { CourseTreeNode, SessionKey } from '../shared/contracts';
import { readCourseTree, readLesson, readPlan, StudyDocumentError } from '../study/markdown';
import { isLessonNodePath, isPlanNodePath } from '../study/node-paths';
import { setFrontmatterField } from './frontmatter';

type LifecycleStatus = 'prepared' | 'active' | 'closed' | 'completed';

const transitions = new Set([
  'plan:prepared>active',
  'plan:active>completed',
  'lesson:prepared>active',
  'lesson:active>closed',
]);

export function transitionNode(
  root: string,
  path: string,
  expected: LifecycleStatus,
  next: LifecycleStatus,
): void {
  const kind = isPlanNodePath(path)
    ? 'plan'
    : isLessonNodePath(path)
      ? 'lesson'
      : null;
  if (!kind) throw new StudyDocumentError(path, 'only Plan and Lesson nodes have lifecycle transitions');
  const document = kind === 'plan' ? readPlan(root, path) : readLesson(root, path);
  if (document.status !== expected) {
    throw new StudyDocumentError(path, `expected status ${expected}, found ${document.status}`);
  }
  if (!transitions.has(`${kind}:${expected}>${next}`)) {
    throw new StudyDocumentError(path, `transition ${expected} → ${next} is not allowed for ${kind}`);
  }
  setFrontmatterField(root, path, 'status', next, expected);
}

type SessionLifecyclePort = {
  open(key: SessionKey): Promise<unknown>;
  abort(key: SessionKey): Promise<void>;
  release(key: SessionKey): Promise<void> | void;
};

function findNode(
  node: CourseTreeNode,
  kind: 'plan' | 'lesson',
  id: string,
  parent: CourseTreeNode | null = null,
): { node: CourseTreeNode; parent: CourseTreeNode | null } | null {
  if (node.kind === kind && node.id === id) return { node, parent };
  for (const child of node.children) {
    const found = findNode(child, kind, id, node);
    if (found) return found;
  }
  return null;
}

export class NodeLifecycleService {
  constructor(
    private readonly root: string,
    private readonly sessions: SessionLifecyclePort,
  ) {}

  private node(
    kind: 'plan' | 'lesson',
    id: string,
  ): { node: CourseTreeNode; parent: CourseTreeNode | null } {
    const located = findNode(readCourseTree(this.root).tree, kind, id);
    if (!located) throw new StudyDocumentError(id, `${kind} is not linked from ROADMAP.md`);
    return located;
  }

  private lesson(
    planId: string,
    lessonId: string,
  ): { node: CourseTreeNode; parent: CourseTreeNode } {
    const { node: plan } = this.node('plan', planId);
    const lesson = plan.children.find((candidate) => (
      candidate.kind === 'lesson' && candidate.id === lessonId
    ));
    if (!lesson) {
      throw new StudyDocumentError(
        `${planId}/${lessonId}`,
        'lesson is not linked from the specified Plan',
      );
    }
    return { node: lesson, parent: plan };
  }

  async startPlan(planId: string): Promise<{ route: string; sessionKey: SessionKey }> {
    const { node } = this.node('plan', planId);
    transitionNode(this.root, node.path, 'prepared', 'active');
    const sessionKey = `plan:${planId}` as const;
    await this.sessions.open(sessionKey);
    return { route: `/course/plan/${encodeURIComponent(planId)}`, sessionKey };
  }

  async completePlan(planId: string): Promise<{ route: '/course' }> {
    const { node } = this.node('plan', planId);
    const sessionKey = `plan:${planId}` as const;
    await this.sessions.abort(sessionKey);
    transitionNode(this.root, node.path, 'active', 'completed');
    await this.sessions.release(sessionKey);
    return { route: '/course' };
  }

  async startLesson(
    planId: string,
    lessonId: string,
  ): Promise<{ route: string; sessionKey: SessionKey }> {
    const { node } = this.lesson(planId, lessonId);
    transitionNode(this.root, node.path, 'prepared', 'active');
    const sessionKey = node.sessionKey;
    await this.sessions.open(sessionKey);
    return {
      route: `/course/plan/${encodeURIComponent(planId)}/lesson/${encodeURIComponent(lessonId)}`,
      sessionKey,
    };
  }

  async closeLesson(planId: string, lessonId: string): Promise<{ route: string }> {
    const { node } = this.lesson(planId, lessonId);
    const sessionKey = node.sessionKey;
    await this.sessions.abort(sessionKey);
    transitionNode(this.root, node.path, 'active', 'closed');
    await this.sessions.release(sessionKey);
    return { route: `/course/plan/${encodeURIComponent(planId)}` };
  }
}

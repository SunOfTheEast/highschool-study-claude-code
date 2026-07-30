import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseChildTree,
  readMarkdownFile,
  type ChildKind,
  type ChildTree,
  type MaterializedEntry,
} from 'highschool-study-markdown/study-domain';
import type {
  ActivityBlock,
  ActivityKind,
  BlockStatus,
  LearningSetSnapshot,
  LessonNode,
  LessonStatus,
  NodeLifecycleStatus,
  PlanSummary,
  PlanWorkspaceSnapshot,
  PublicTreeEntry,
  RoadmapWorkspaceSnapshot,
} from '../shared/contracts';
import { ROADMAP_COACH_SESSION_KEY } from '../shared/contracts';
import { parseLearningReview } from './learning-review';

function section(body: string, heading: string, level = 2): string {
  const lines = body.split(/\r?\n/);
  const marker = `${'#'.repeat(level)} ${heading}`;
  const start = lines.findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return '';
  const boundary = new RegExp(`^#{1,${level}}\\s`);
  let end = start + 1;
  while (end < lines.length && !boundary.test(lines[end]!)) end += 1;
  return lines.slice(start + 1, end).join('\n').trim();
}

function title(body: string): string {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? '';
}

function publicPurpose(body: string): string | null {
  const heading = /^#\s+.+$/m.exec(body);
  if (!heading || heading.index === undefined) return null;
  const firstContentLine = body
    .slice(heading.index + heading[0].length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstContentLine?.startsWith('>')) return null;
  const value = firstContentLine.replace(/^>\s*/, '').trim();
  return value || null;
}

function studentLearningPrinciples(root: string): string {
  if (!existsSync(resolve(root, 'LEARNING_GUIDE.md'))) return '';
  const guide = readMarkdownFile(root, 'LEARNING_GUIDE.md');
  return section(guide.body, 'Student Learning Principles');
}

function scalar(
  frontmatter: Record<string, unknown>,
  key: string,
): string | null {
  return typeof frontmatter[key] === 'string'
    ? frontmatter[key] as string
    : null;
}

const planStatuses = new Set<NodeLifecycleStatus>([
  'prepared',
  'active',
  'paused',
  'completed',
  'abandoned',
]);
const lessonStatuses = new Set<NodeLifecycleStatus>([
  'prepared',
  'active',
  'paused',
  'closed',
  'abandoned',
]);

function childDocument(
  root: string,
  kind: ChildKind,
  entry: MaterializedEntry,
  parentId: string,
  parentPath: string,
) {
  const document = readMarkdownFile(root, entry.childPath);
  const expectedKind = kind;
  const statuses = kind === 'plan' ? planStatuses : lessonStatuses;
  const status = scalar(document.frontmatter, 'status');
  if (
    document.id !== entry.childId
    || scalar(document.frontmatter, 'kind') !== expectedKind
    || scalar(document.frontmatter, 'parent_id') !== parentId
    || scalar(document.frontmatter, 'parent_path') !== parentPath
    || status === null
    || !statuses.has(status as NodeLifecycleStatus)
  ) {
    throw new Error(`INVALID_${kind.toUpperCase()}_CHILD: ${entry.childPath}`);
  }
  const childTitle = title(document.body);
  if (!childTitle) {
    throw new Error(`${kind.toUpperCase()}_TITLE_REQUIRED: ${entry.childPath}`);
  }
  return {
    document,
    status: status as NodeLifecycleStatus,
    title: childTitle,
    publicPurpose: publicPurpose(document.body),
  };
}

function projectTree(
  root: string,
  tree: ChildTree,
  parentId: string,
  parentPath: string,
): PublicTreeEntry[] {
  return tree.entries.map((entry) => {
    if (entry.state === 'candidate') {
      return {
        handle: entry.handle,
        kind: tree.kind,
        nodeId: null,
        path: null,
        title: null,
        publicPurpose: entry.publicPurpose,
        after: entry.after,
        dependsOn: [...entry.dependsOn],
        status: 'candidate',
      };
    }
    const child = childDocument(
      root,
      tree.kind,
      entry,
      parentId,
      parentPath,
    );
    return {
      handle: entry.handle,
      kind: tree.kind,
      nodeId: entry.childId,
      path: entry.childPath,
      title: child.title.replace(/^Plan[:：]\s*/, ''),
      publicPurpose: child.publicPurpose ?? entry.publicPurpose,
      after: entry.after,
      dependsOn: [...entry.dependsOn],
      status: child.status,
    };
  });
}

function planSummary(root: string, planPath: string): PlanSummary {
  const document = readMarkdownFile(root, planPath);
  const summary = section(document.body, 'Plan Summary');
  return {
    id: document.id,
    title: title(document.body).replace(/^Plan[:：]\s*/, ''),
    path: planPath,
    status: scalar(document.frontmatter, 'status')!,
    goal: section(document.body, 'Goal'),
    capabilityStandard: section(
      document.body,
      'Observable Capability Standard',
    ),
    planningBasis: section(document.body, 'Planning Basis'),
    currentPosition: section(document.body, 'Current Position'),
    planSummary: summary,
    learningReview: parseLearningReview(summary),
  };
}

function nodeState(source: string): {
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
} {
  const field = (name: string) => (
    new RegExp(`^- ${name}:[ \\t]*(.*?)[ \\t]*$`, 'm')
      .exec(source)?.[1]?.trim()
  );
  const kind = field('Kind');
  const status = field('Status');
  return {
    kind: ['dialogue', 'problem', 'material', 'reflection'].includes(kind ?? '')
      ? kind as ActivityKind
      : 'dialogue',
    required: field('Required') !== 'false',
    status: ['pending', 'active', 'completed', 'skipped'].includes(status ?? '')
      ? status as BlockStatus
      : 'pending',
    dependsOn: (field('Depends on') ?? '')
      .split(',').map((value) => value.trim()).filter(Boolean),
    uses: (field('Uses') ?? '')
      .split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function projectedStudentView(blockStatus: BlockStatus, value: string): string {
  return blockStatus === 'active' || blockStatus === 'completed' ? value : '';
}

function lessonBlocks(body: string): ActivityBlock[] {
  const matches = [
    ...body.matchAll(/^## Block ([^（\s]+)(?:（([^）]+)）)?\s*$/gm),
  ];
  return matches.map((match, index) => {
    const source = body.slice(
      match.index! + match[0].length,
      matches[index + 1]?.index,
    );
    const state = nodeState(section(`# x\n${source}`, 'Node State', 3));
    const studentView = section(`# x\n${source}`, 'Student View', 3);
    return {
      id: match[1]!,
      title: match[2]?.trim() || match[1]!,
      ...state,
      studentView: projectedStudentView(state.status, studentView),
      evidence: [
        ...section(`# x\n${source}`, 'Evidence', 3)
          .matchAll(/\[[^\]]+\]\(([^)]+)\)/g),
      ].map((item) => item[1]!),
    };
  });
}

function lessonNode(
  root: string,
  planId: string,
  planPath: string,
  treeEntry: PublicTreeEntry,
): LessonNode {
  if (
    treeEntry.nodeId === null
    || treeEntry.path === null
    || treeEntry.kind !== 'lesson'
  ) {
    throw new Error('LESSON_TREE_ENTRY_NOT_MATERIALIZED');
  }
  const document = readMarkdownFile(root, treeEntry.path);
  return {
    id: document.id,
    title: title(document.body),
    path: treeEntry.path,
    planId,
    status: treeEntry.status as LessonStatus,
    sessionKey: `tutor:${document.id}`,
    tutorSessionId: scalar(document.frontmatter, 'tutor_session'),
    blocks: lessonBlocks(document.body),
  };
}

export function readLearningSet(root: string): LearningSetSnapshot {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  const tree = parseChildTree(
    roadmap.body,
    'Plan Tree',
    'plan',
    'ROADMAP.md',
  );
  const planTree = projectTree(root, tree, roadmap.id, 'ROADMAP.md');
  return {
    title: title(roadmap.body),
    overview: section(roadmap.body, 'Learning Set Overview'),
    learningPrinciples: studentLearningPrinciples(root),
    goal: section(roadmap.body, 'Goal'),
    planTree,
    plans: planTree.flatMap((entry) => (
      entry.path === null ? [] : [planSummary(root, entry.path)]
    )),
  };
}

export function readRoadmapWorkspace(root: string): RoadmapWorkspaceSnapshot {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  return {
    learningSet: readLearningSet(root),
    coach: {
      sessionKey: ROADMAP_COACH_SESSION_KEY,
      sessionId: scalar(roadmap.frontmatter, 'roadmap_coach_session'),
    },
  };
}

export function readPlanWorkspace(
  root: string,
  planId: string,
): PlanWorkspaceSnapshot {
  const learningSet = readLearningSet(root);
  const plan = learningSet.plans.find((candidate) => candidate.id === planId);
  if (!plan) throw new Error(`PLAN_NOT_FOUND: ${planId}`);
  const document = readMarkdownFile(root, plan.path);
  const tree = parseChildTree(
    document.body,
    'Lesson Tree',
    'lesson',
    plan.path,
  );
  const lessonTree = projectTree(root, tree, plan.id, plan.path);
  return {
    learningSet,
    plan,
    lessonTree,
    coach: {
      sessionKey: `coach:${plan.id}`,
      sessionId: scalar(document.frontmatter, 'coach_session'),
    },
    lessons: lessonTree.flatMap((entry) => (
      entry.path === null
        ? []
        : [lessonNode(root, plan.id, plan.path, entry)]
    )),
  };
}

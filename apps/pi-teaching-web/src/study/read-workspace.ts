import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type {
  ActivityBlock,
  ActivityKind,
  BlockStatus,
  LearningSetSnapshot,
  LessonNode,
  LessonStatus,
  PlanSummary,
  PlanWorkspaceSnapshot,
  RoadmapWorkspaceSnapshot,
} from '../shared/contracts';
import { ROADMAP_COACH_SESSION_KEY } from '../shared/contracts';

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

function studentLearningPrinciples(root: string): string {
  if (!existsSync(resolve(root, 'LEARNING_GUIDE.md'))) return '';
  const guide = readMarkdownFile(root, 'LEARNING_GUIDE.md');
  return section(guide.body, 'Student Learning Principles');
}

function canonical(root: string, absolute: string): string {
  return relative(resolve(root), absolute).replaceAll('\\', '/');
}

function scalar(frontmatter: Record<string, unknown>, key: string): string | null {
  return typeof frontmatter[key] === 'string' ? frontmatter[key] as string : null;
}

function planSummary(root: string, planPath: string): PlanSummary {
  const document = readMarkdownFile(root, planPath);
  return {
    id: document.id,
    title: title(document.body).replace(/^Plan[:：]\s*/, ''),
    path: planPath,
    status: scalar(document.frontmatter, 'status') ?? 'unknown',
    goal: section(document.body, 'Goal'),
    capabilityStandard: section(document.body, 'Observable Capability Standard'),
    planningBasis: section(document.body, 'Planning Basis'),
  };
}

function nodeState(source: string): {
  kind: ActivityKind;
  required: boolean;
  status: BlockStatus;
  dependsOn: string[];
  uses: string[];
} {
  const field = (name: string) => new RegExp(`^- ${name}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(source)?.[1]?.trim();
  const kind = field('Kind');
  const status = field('Status');
  return {
    kind: ['dialogue', 'problem', 'material', 'reflection'].includes(kind ?? '')
      ? kind as ActivityKind : 'dialogue',
    required: field('Required') !== 'false',
    status: ['pending', 'active', 'completed', 'skipped'].includes(status ?? '')
      ? status as BlockStatus : 'pending',
    dependsOn: (field('Depends on') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    uses: (field('Uses') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function lessonTemplate(body: string): string | null {
  return /^-\s+Primary template:\s*`?([^`\n]+)`?\s*$/m
    .exec(section(body, 'Lesson Configuration'))?.[1]?.trim() ?? null;
}

function projectedStudentView(
  template: string | null,
  lessonStatus: LessonStatus,
  blockStatus: BlockStatus,
  value: string,
): string {
  if (template !== 'assessment' || lessonStatus === 'closed') return value;
  return blockStatus === 'active' || blockStatus === 'completed' ? value : '';
}

function lessonBlocks(body: string, lessonStatus: LessonStatus): ActivityBlock[] {
  const template = lessonTemplate(body);
  const matches = [...body.matchAll(/^## Block ([^（\s]+)(?:（([^）]+)）)?\s*$/gm)];
  return matches.map((match, index) => {
    const source = body.slice(match.index! + match[0].length, matches[index + 1]?.index);
    const state = nodeState(section(`# x\n${source}`, 'Node State', 3));
    const inferredKind: ActivityKind = match[1] === 'reflection' ? 'reflection' : state.kind;
    const studentView = section(`# x\n${source}`, 'Student View', 3);
    return {
      id: match[1]!,
      title: match[1]!,
      ...state,
      kind: inferredKind,
      required: match[2]?.includes('可选') ? false : state.required,
      studentView: projectedStudentView(template, lessonStatus, state.status, studentView),
      evidence: [...section(`# x\n${source}`, 'Evidence', 3).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
        .map((item) => item[1]!),
    };
  });
}

function lessonNode(root: string, planPath: string, linkedPath: string): LessonNode {
  const lessonPath = canonical(root, resolve(dirname(resolve(root, planPath)), linkedPath));
  const document = readMarkdownFile(root, lessonPath);
  const status = scalar(document.frontmatter, 'status');
  if (!['prepared', 'active', 'paused', 'closed', 'abandoned'].includes(status ?? '')) {
    throw new Error(`INVALID_LESSON_STATUS: ${lessonPath}`);
  }
  const lessonStatus = status as LessonStatus;
  return {
    id: document.id,
    title: title(document.body),
    path: lessonPath,
    planId: scalar(document.frontmatter, 'plan_id') ?? '',
    status: lessonStatus,
    sessionKey: `tutor:${document.id}`,
    tutorSessionId: scalar(document.frontmatter, 'tutor_session'),
    blocks: lessonBlocks(document.body, lessonStatus),
  };
}

export function readLearningSet(root: string): LearningSetSnapshot {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  const planPaths = [...section(roadmap.body, 'Plan Graph').matchAll(/\[[^\]]+\]\((plans\/[^)#]+\.md)\)/g)]
    .map((match) => match[1]!);
  return {
    title: title(roadmap.body),
    overview: section(roadmap.body, 'Learning Set Overview'),
    learningPrinciples: studentLearningPrinciples(root),
    goal: section(roadmap.body, 'Goal'),
    plans: planPaths.map((path) => planSummary(root, path)),
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

export function readPlanWorkspace(root: string, planId: string): PlanWorkspaceSnapshot {
  const learningSet = readLearningSet(root);
  const plan = learningSet.plans.find((candidate) => candidate.id === planId);
  if (!plan) throw new Error(`PLAN_NOT_FOUND: ${planId}`);
  const document = readMarkdownFile(root, plan.path);
  const lessonPaths = [...section(document.body, 'Lesson Index').matchAll(/\[[^\]]+\]\(([^)#]+\.md)\)/g)]
    .map((match) => match[1]!);
  return {
    learningSet,
    plan,
    coach: {
      sessionKey: `coach:${plan.id}`,
      sessionId: scalar(document.frontmatter, 'coach_session'),
    },
    lessons: lessonPaths.map((path) => lessonNode(root, plan.path, path)),
  };
}

import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  parseChildTree,
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import type { LearningReview } from '../shared/contracts';
import {
  renderLearningReview,
  validateLearningReviewSources,
} from './learning-review';
import {
  appendRouteChangeSource,
  transitionClassroomSource,
  type ClassroomTransitionInput,
} from './classroom-transition';

export type RouteChangeInput = {
  action: 'insert' | 'skip' | 'move' | 'repeat';
  blockId: string;
  reason: string;
  source: string;
  before?: string;
  after?: string;
};

export type PlanDecision = 'active' | 'complete' | 'replan';

type PlanProgressUpdate = {
  decision: Exclude<PlanDecision, 'complete'>;
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};

type PlanCompleteUpdate = {
  decision: 'complete';
  currentPosition: string;
  nextLessonCandidate: string;
  learningReview: LearningReview;
};

export type PlanUpdateInput = PlanProgressUpdate | PlanCompleteUpdate;

export type RegisteredPlan = {
  id: string;
  title: string;
  path: string;
  coachSessionId: string | null;
};

export type PreparedLessonWrite = {
  lessonId: string;
  lessonPath: string;
  lessonTitle: string;
  source: string;
};

export type RegisteredLesson = {
  id: string;
  title: string;
  path: string;
  status: 'prepared';
};

function read(root: string, path: string): { absolute: string; source: string } {
  const absolute = resolveInsideRoot(root, path);
  return { absolute, source: readFileSync(absolute, 'utf8') };
}

function write(absolute: string, source: string): void {
  writeFileSync(absolute, source.endsWith('\n') ? source : `${source}\n`);
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

export function setFrontmatterField(
  root: string,
  path: string,
  key: string,
  value: string,
): void {
  const document = read(root, path);
  write(
    document.absolute,
    replaceFrontmatterField(document.source, path, key, value),
  );
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): string {
  const escaped = blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(
    `^## Block ${escaped}(?:（[^）]+）)?\\s*$`,
    'm',
  );
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  if (!state) throw new Error(`BLOCK_STATE_REQUIRED: ${blockId}`);
  const replacement = block.replace(
    state[0],
    state[0].replace(/^- Status:.*$/m, `- Status: ${status}`),
  );
  return source.slice(0, match.index) + replacement + source.slice(end);
}

export function setBlockStatus(
  root: string,
  lessonPath: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): void {
  const document = read(root, lessonPath);
  write(
    document.absolute,
    replaceBlockStatus(document.source, blockId, status),
  );
}

export function appendRouteChange(
  root: string,
  lessonPath: string,
  input: RouteChangeInput,
): void {
  const document = read(root, lessonPath);
  if (!document.source.includes(`## Block ${input.blockId}`)) {
    throw new Error(`BLOCK_NOT_FOUND: ${input.blockId}`);
  }
  write(
    document.absolute,
    appendRouteChangeSource(document.source, input),
  );
}

export function applyClassroomTransition(
  root: string,
  lessonPath: string,
  input: ClassroomTransitionInput,
): void {
  const document = read(root, lessonPath);
  write(
    document.absolute,
    transitionClassroomSource(document.source, input),
  );
}

function replaceSection(
  source: string,
  heading: string,
  value: string,
): string {
  const pattern = new RegExp(
    `(^## ${heading}\\s*$\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`,
    'm',
  );
  if (!pattern.test(source)) throw new Error(`SECTION_NOT_FOUND: ${heading}`);
  return source.replace(
    pattern,
    (_match, sectionHeading: string) => (
      `${sectionHeading}\n${value.trim()}\n\n`
    ),
  );
}

function planTitle(body: string): string {
  const heading = /^#\s+(.+?)\s*$/m.exec(body)?.[1]?.trim() ?? '';
  const value = heading.replace(/^Plan[:：]\s*/, '');
  if (!value) throw new Error('PLAN_TITLE_REQUIRED');
  return value;
}

export function writePreparedLesson(
  root: string,
  planPath: string,
  input: PreparedLessonWrite,
): RegisteredLesson {
  const owner = readMarkdownFile(root, planPath);
  if (owner.frontmatter.status === 'completed') {
    throw new Error(`PLAN_PREPARATION_REQUIRES_REACTIVATION: ${owner.id}`);
  }
  const tree = parseChildTree(
    owner.body,
    'Lesson Tree',
    'lesson',
    planPath,
  );
  const child = tree.entries.find((entry) => (
    entry.state === 'materialized'
    && entry.childId === input.lessonId
    && entry.childPath === input.lessonPath
  ));
  if (!child) throw new Error(`LESSON_CANDIDATE_REQUIRED: ${input.lessonId}`);

  const absolute = resolveInsideRoot(root, input.lessonPath);
  if (existsSync(absolute)) {
    const current = readMarkdownFile(root, input.lessonPath);
    if (
      current.frontmatter.parent_id !== owner.id
      || current.frontmatter.parent_path !== planPath
    ) {
      throw new Error(`LESSON_PLAN_OWNERSHIP_CONFLICT: ${input.lessonId}`);
    }
    if (current.frontmatter.status !== 'prepared') {
      throw new Error(`LESSON_REPREPARE_REQUIRES_PREPARED: ${input.lessonId}`);
    }
  }
  write(absolute, input.source);
  return {
    id: input.lessonId,
    title: input.lessonTitle,
    path: input.lessonPath,
    status: 'prepared',
  };
}

export function registerPlan(root: string, planId: string): RegisteredPlan {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  const tree = parseChildTree(
    roadmap.body,
    'Plan Tree',
    'plan',
    'ROADMAP.md',
  );
  const child = tree.entries.find((entry) => (
    entry.state === 'materialized' && entry.childId === planId
  ));
  if (!child || child.state !== 'materialized') {
    throw new Error(`PLAN_CANDIDATE_REQUIRED: ${planId}`);
  }
  const plan = readMarkdownFile(root, child.childPath);
  return {
    id: plan.id,
    title: planTitle(plan.body),
    path: child.childPath,
    coachSessionId: typeof plan.frontmatter.coach_session === 'string'
      ? plan.frontmatter.coach_session
      : null,
  };
}

export type LessonCloseInput = {
  summary: string;
};

export function closeLesson(
  root: string,
  lessonPath: string,
  input: LessonCloseInput,
): void {
  const document = read(root, lessonPath);
  const status = readMarkdownFile(root, lessonPath).frontmatter.status;
  if (status === 'closed' || status === 'abandoned') {
    throw new Error(`LESSON_ALREADY_TERMINAL: ${status}`);
  }
  let source = replaceSection(document.source, 'Lesson Summary', input.summary);
  source = replaceFrontmatterField(source, lessonPath, 'status', 'closed');
  write(document.absolute, source);
}

export function updatePlan(
  root: string,
  planPath: string,
  input: PlanUpdateInput,
): void {
  const document = read(root, planPath);
  const status = input.decision === 'complete' ? 'completed' : 'active';
  if (input.decision === 'complete') {
    validateLearningReviewSources(root, planPath, input.learningReview);
  }
  const summary = input.decision === 'complete'
    ? renderLearningReview(input.learningReview)
    : input.planSummary;
  let source = replaceSection(
    document.source,
    'Current Position',
    input.currentPosition,
  );
  source = replaceSection(source, 'Plan Summary', summary);
  source = replaceFrontmatterField(source, planPath, 'status', status);
  write(document.absolute, source);
}

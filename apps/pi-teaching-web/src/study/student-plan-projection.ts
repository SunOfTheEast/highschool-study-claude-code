import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import {
  readLessonAliases,
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import { parse } from 'yaml';
import type {
  LessonNode,
  PlanWorkspaceSnapshot,
  StudentLessonPreview,
  StudentPlanProjection,
  StudentPlanState,
} from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';

const lessonPriority = ['active', 'paused', 'prepared'] as const;

function section(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `## ${heading}`);
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end]!)) end += 1;
  return lines.slice(start + 1, end).join('\n').trim();
}

function primaryTemplate(body: string): string {
  return /^- Primary template:\s*`?([^`\n]+)`?\s*$/m
    .exec(section(body, 'Lesson Configuration'))?.[1]?.trim() ?? '';
}

function publicPurpose(template: string, capabilityTarget: string): string | null {
  if (template === 'assessment') return '完成一次独立能力检验';
  if (template === 'diagnostic') return '确认当前真实起点';
  return capabilityTarget || null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function contentItemId(root: string, lessonPath: string, target: string): string | null {
  const path = target.split('#', 1)[0]?.trim();
  if (!path || /^https?:\/\//.test(path) || posix.isAbsolute(path)) return null;
  const canonical = posix.normalize(posix.join(posix.dirname(lessonPath), path));
  if (canonical === '..' || canonical.startsWith('../')) return null;
  try {
    const raw = record(parse(readFileSync(resolveInsideRoot(root, canonical), 'utf8')));
    return typeof raw?.content_item_id === 'string' && raw.content_item_id.trim()
      ? raw.content_item_id.trim()
      : null;
  } catch {
    return null;
  }
}

function sourceNumbers(root: string, lessonPath: string, body: string): string[] {
  const result = new Set<string>();
  for (const target of readLessonAliases(body).values()) {
    const id = contentItemId(root, lessonPath, target);
    if (id) result.add(id);
  }
  return [...result].sort();
}

function fallbackPreview(lesson: LessonNode): StudentLessonPreview {
  return {
    lessonId: lesson.id,
    status: lesson.status as StudentLessonPreview['status'],
    publicTitle: lesson.status === 'prepared' ? '下一节课堂' : lesson.title,
    publicPurpose: null,
    blockCount: lesson.blocks.length,
    blockKinds: [...new Set(lesson.blocks.map((block) => block.kind))],
    sourceNumbers: [],
  };
}

export function readStudentLessonPreview(
  root: string,
  lesson: LessonNode,
): StudentLessonPreview {
  const fallback = fallbackPreview(lesson);
  try {
    const document = readMarkdownFile(root, lesson.path);
    const template = primaryTemplate(document.body);
    return {
      ...fallback,
      publicPurpose: publicPurpose(
        template,
        section(document.body, 'Capability Target'),
      ),
      sourceNumbers: sourceNumbers(root, lesson.path, document.body),
    };
  } catch {
    return fallback;
  }
}

function prioritizedLesson(workspace: PlanWorkspaceSnapshot): LessonNode | null {
  for (const status of lessonPriority) {
    const lesson = workspace.lessons.find((candidate) => candidate.status === status);
    if (lesson) return lesson;
  }
  return null;
}

function planState(
  completed: boolean,
  lesson: LessonNode | null,
): StudentPlanState {
  if (completed) return 'completed';
  if (
    lesson?.status === 'prepared'
    || lesson?.status === 'active'
    || lesson?.status === 'paused'
  ) {
    return lesson.status;
  }
  return 'discussing';
}

export function readStudentPlanProjection(
  root: string,
  planId: string,
): StudentPlanProjection {
  const workspace = readPlanWorkspace(root, planId);
  const registeredLessons = workspace.lessons
    .filter((lesson) => lesson.status !== 'abandoned');
  const completed = workspace.plan.status === 'completed';
  const lesson = completed ? null : prioritizedLesson(workspace);
  return {
    progress: {
      closedLessons: registeredLessons
        .filter((candidate) => candidate.status === 'closed').length,
      registeredLessons: registeredLessons.length,
      state: planState(completed, lesson),
    },
    currentPosition: workspace.plan.currentPosition,
    nextLesson: lesson ? readStudentLessonPreview(root, lesson) : null,
    learningReview: workspace.plan.learningReview,
  };
}

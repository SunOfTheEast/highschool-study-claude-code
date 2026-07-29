import { existsSync } from 'node:fs';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type { CoachContextView } from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';

function section(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `## ${heading}`);
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end]!)) end += 1;
  return lines.slice(start + 1, end).join('\n').trim();
}

export function readCoachContext(root: string, planId: string): CoachContextView {
  const workspace = readPlanWorkspace(root, planId);
  const plannerAttention = existsSync(`${root}/memory/planner-attention.md`)
    ? readMarkdownFile(root, 'memory/planner-attention.md').body.trim()
    : '';
  const priorLessons = workspace.lessons
    .filter((lesson) => lesson.status === 'closed')
    .flatMap((lesson) => {
      const document = readMarkdownFile(root, lesson.path);
      const summary = section(document.body, 'Lesson Summary');
      return summary ? [{
        lessonId: lesson.id,
        title: lesson.title,
        summary,
        source: `${lesson.path}#lesson-summary`,
      }] : [];
    });
  return {
    currentPosition: workspace.plan.currentPosition,
    nextLessonCandidate: workspace.plan.nextLessonCandidate,
    planSummary: workspace.plan.planSummary,
    learningReview: workspace.plan.learningReview,
    plannerAttention,
    priorLessons,
  };
}

import { existsSync } from 'node:fs';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type { CoachContextView } from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';
import { readStudentPlanProjection } from './student-plan-projection';

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
    plan: readStudentPlanProjection(root, planId),
    plannerAttention,
    priorLessons,
  };
}

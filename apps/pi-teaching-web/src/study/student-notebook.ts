import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import {
  readActiveTraces,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import { parse } from 'yaml';
import type { StudentNotebook, StudentProblemCard } from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';

function aliases(source: string): Map<string, string> {
  const section = /^## Aliases\s*$\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(source)?.[1] ?? '';
  return new Map(
    [...section.matchAll(/^[-*]\s*([^:]+):\s*(\S.*?)\s*$/gm)]
      .map((match) => [match[1]!.trim(), match[2]!.trim()]),
  );
}

export function readStudentProblemCard(
  root: string,
  cardPath: string,
): StudentProblemCard {
  const absolute = resolveInsideRoot(root, cardPath);
  const raw = parse(readFileSync(absolute, 'utf8')) as Record<string, unknown>;
  const original = raw.original_problem as Record<string, unknown> | undefined;
  const choices = Array.isArray(original?.choices)
    ? original.choices.flatMap((choice) => {
      if (!choice || typeof choice !== 'object') return [];
      const value = choice as Record<string, unknown>;
      return typeof value.label === 'string' && typeof value.text_raw === 'string'
        ? [{ label: value.label, text: value.text_raw }]
        : [];
    })
    : [];
  return {
    path: String(raw.storage_uri ?? cardPath),
    stem: String(raw.stem ?? original?.stem ?? ''),
    choices,
  };
}

function studentCard(root: string, lessonPath: string, target: string): StudentProblemCard {
  const relativePath = normalize(join(dirname(lessonPath), target)).replaceAll('\\', '/');
  return readStudentProblemCard(root, relativePath);
}

function lessonSummary(source: string): string {
  const heading = /^## Lesson Summary\s*$/m.exec(source);
  if (!heading) return '';
  const body = source.slice(heading.index + heading[0].length).replace(/^\r?\n/, '');
  const nextStructuralSection = /^## (?:Aliases|Traces)\s*$/m.exec(body);
  return body.slice(0, nextStructuralSection?.index ?? body.length).trim();
}

function blockIsVisible(status: string): boolean {
  return status === 'active' || status === 'completed';
}

export function readStudentNotebook(
  root: string,
  lessonId: string,
  authoring: boolean,
): StudentNotebook {
  const roadmap = readFileSync(resolveInsideRoot(root, 'ROADMAP.md'), 'utf8');
  const planId = [...roadmap.matchAll(/\(plans\/[^)]+\.md\)/g)]
    .map((match) => match[0].slice(1, -1).split('/').at(-1)!.replace(/\.md$/, ''))
    .find((id) => readPlanWorkspace(root, id).lessons.some((lesson) => lesson.id === lessonId));
  if (!planId) throw new Error(`LESSON_NOT_FOUND: ${lessonId}`);
  const lesson = readPlanWorkspace(root, planId).lessons.find((item) => item.id === lessonId)!;
  const source = readFileSync(resolveInsideRoot(root, lesson.path), 'utf8');
  const visibleAliases = new Set(
    lesson.blocks
      .filter((block) => blockIsVisible(block.status))
      .flatMap((block) => block.uses),
  );
  const cards: Record<string, StudentProblemCard> = {};
  for (const [alias, target] of aliases(source)) {
    if (!visibleAliases.has(alias)) continue;
    cards[alias] = studentCard(root, lesson.path, target);
  }
  const recentRecords = readActiveTraces(root, [lesson.path])
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .map((trace) => ({
      source: trace.sourceAnchor,
      lessonId: trace.lessonId,
      blockId: trace.blockId,
      assessment: trace.assessment,
      support: trace.support,
      note: trace.note,
    }));
  return {
    lesson,
    cards,
    recentRecords,
    lessonSummary: lesson.status === 'closed'
      ? lessonSummary(source) || null
      : null,
    ...(authoring ? { authoring: { source } } : {}),
  };
}

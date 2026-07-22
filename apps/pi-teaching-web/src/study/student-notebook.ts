import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
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

function studentCard(root: string, lessonPath: string, target: string): StudentProblemCard {
  const relativePath = normalize(join(dirname(lessonPath), target)).replaceAll('\\', '/');
  const absolute = resolveInsideRoot(root, relativePath);
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
    path: String(raw.storage_uri ?? target),
    stem: String(raw.stem ?? original?.stem ?? ''),
    choices,
  };
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
      .filter((block) => block.status === 'active' || block.status === 'completed')
      .flatMap((block) => block.uses),
  );
  const cards: Record<string, StudentProblemCard> = {};
  for (const [alias, target] of aliases(source)) {
    if (!visibleAliases.has(alias)) continue;
    cards[alias] = studentCard(root, lesson.path, target);
  }
  return {
    lesson,
    cards,
    ...(authoring ? { authoring: { source } } : {}),
  };
}

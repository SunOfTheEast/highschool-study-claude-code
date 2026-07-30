import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendTrace,
  readActiveTraces,
  readLessonAliases,
  readMarkdownFile,
} from 'highschool-study-markdown/study-domain';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from './fixture-paths';

const roots: string[] = [];

export function copyViewLearningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-view-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

export function removeViewLearningSets(): void {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
}

export function clearTracePool(root: string): void {
  rmSync(join(root, 'traces'), { recursive: true, force: true });
  mkdirSync(join(root, 'traces'), { recursive: true });
}

export function installObservedMethod(root: string): string {
  const methodName = '同构变形与换元法';
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: null,
    materialPath: null,
    assessment: 'partially_correct',
    support: 'tutor',
    note: '学生实际使用同构路线，仍需一次提示。',
    supersedes: 'trace-fixture-001',
    methods: { primary: methodName, secondary: [] },
  }, () => new Date('2026-07-30T07:58:00.000Z'), () => (
    '33333333-3333-4333-8333-333333333333'
  ));
  return methodName;
}

export function installInvalidatedOnlyMethod(root: string): string {
  const workspace = readPlanWorkspace(root, 'domain-integrity');
  const activeKeys = new Set(readActiveTraces(root).map((trace) => (
    `${trace.lessonId}:${trace.blockId}:${trace.cardPath ?? ''}`
  )));
  const candidate = workspace.lessons.flatMap((lesson) => {
    const source = readMarkdownFile(root, lesson.path).body;
    const aliases = readLessonAliases(source);
    return lesson.blocks.flatMap((block) => block.kind === 'problem'
      ? block.uses.flatMap((alias) => {
          const cardPath = aliases.get(alias) ?? null;
          const key = `${lesson.id}:${block.id}:${cardPath ?? ''}`;
          return cardPath && !activeKeys.has(key)
            ? [{ lesson, block, alias }]
            : [];
        })
      : []);
  })[0];
  if (!candidate) throw new Error('VIEW_FIXTURE_UNUSED_ATTEMPT_REQUIRED');
  const original = appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'incorrect',
    support: 'none',
    note: '最初错误地把这一作答绑定为递推转化。',
    supersedes: null,
    methods: { primary: '递推转化', secondary: [] },
  }, () => new Date('2026-07-30T08:00:00.000Z'), () => (
    '11111111-1111-4111-8111-111111111111'
  ));
  appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '复核后绑定到学生实际使用的同构方法。',
    supersedes: original.traceId,
    methods: { primary: '同构变形与换元法', secondary: [] },
  }, () => new Date('2026-07-30T08:01:00.000Z'), () => (
    '22222222-2222-4222-8222-222222222222'
  ));
  return '递推转化';
}

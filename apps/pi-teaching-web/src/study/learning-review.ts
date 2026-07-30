import {
  readActiveTraces,
  readMarkdownFile,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import type { LearningReview } from '../shared/contracts';
import { readPlanWorkspace } from './read-workspace';
import { readPreparedLessonBlocks } from './validate-prepared-lesson';

const headings = [
  '阶段结论',
  '适用范围',
  '下一步',
  '最能说明这一点',
  '可以作为参考',
  '还需要再看看',
] as const;

function paragraph(value: string, name: string): string {
  const result = value.trim();
  if (!result) throw new Error(`LEARNING_REVIEW_${name}_REQUIRED`);
  return result;
}

function line(value: string, name: string): string {
  const result = value.trim();
  if (!result || /[\r\n]/.test(result)) {
    throw new Error(`LEARNING_REVIEW_${name}_INVALID`);
  }
  return result;
}

function renderKeyEvidence(review: LearningReview): string {
  return review.keyEvidence.map((item) => [
    `- 判断：${line(item.claim, 'KEY_CLAIM')}`,
    `  - 来源：${line(item.source, 'KEY_SOURCE')}`,
  ].join('\n')).join('\n');
}

function renderSupportingEvidence(review: LearningReview): string {
  return review.supportingEvidence.map((item) => [
    `- 判断：${line(item.claim, 'SUPPORTING_CLAIM')}`,
    `  - 来源：${line(item.source, 'SUPPORTING_SOURCE')}`,
    `  - 局限：${line(item.limitation, 'SUPPORTING_LIMITATION')}`,
  ].join('\n')).join('\n');
}

function renderOpenQuestions(review: LearningReview): string {
  return review.openQuestions.map((item) => [
    `- 问题：${line(item.question, 'OPEN_QUESTION')}`,
    `  - 下次检查：${line(item.nextCheck, 'NEXT_CHECK')}`,
  ].join('\n')).join('\n');
}

export function renderLearningReview(review: LearningReview): string {
  return [
    '### 阶段结论',
    '',
    paragraph(review.conclusion, 'CONCLUSION'),
    '',
    '### 适用范围',
    '',
    paragraph(review.boundary, 'BOUNDARY'),
    '',
    '### 下一步',
    '',
    paragraph(review.nextStep, 'NEXT_STEP'),
    '',
    '### 最能说明这一点',
    '',
    renderKeyEvidence(review),
    '',
    '### 可以作为参考',
    '',
    renderSupportingEvidence(review),
    '',
    '### 还需要再看看',
    '',
    renderOpenQuestions(review),
    '',
  ].join('\n');
}

function sections(source: string): Map<string, string> | null {
  const matches = [...source.matchAll(/^### ([^\n]+)[ \t]*$/gm)];
  if (matches.length !== headings.length) return null;
  if (source.slice(0, matches[0]!.index).trim()) return null;
  const result = new Map<string, string>();
  for (const [index, match] of matches.entries()) {
    const heading = match[1]!.trim();
    if (heading !== headings[index]) return null;
    result.set(
      heading,
      source.slice(match.index! + match[0].length, matches[index + 1]?.index)
        .trim(),
    );
  }
  return result;
}

function parseRecords<T>(
  source: string,
  pattern: RegExp,
  project: (match: RegExpExecArray) => T,
  render: (records: T[]) => string,
): T[] | null {
  if (!source) return [];
  const records = [...source.matchAll(pattern)].map((match) => project(match));
  return render(records).trim() === source.trim() ? records : null;
}

export function parseLearningReview(source: string): LearningReview | null {
  const values = sections(source);
  if (values === null) return null;
  const conclusion = values.get('阶段结论') ?? '';
  const boundary = values.get('适用范围') ?? '';
  const nextStep = values.get('下一步') ?? '';
  if (!conclusion || !boundary || !nextStep) return null;

  const keyEvidence = parseRecords(
    values.get('最能说明这一点') ?? '',
    /^- 判断：([^\r\n]+)\r?\n  - 来源：([^\r\n]+)$/gm,
    (match) => ({ claim: match[1]!.trim(), source: match[2]!.trim() }),
    (records) => renderKeyEvidence({
      conclusion,
      boundary,
      nextStep,
      keyEvidence: records,
      supportingEvidence: [],
      openQuestions: [],
    }),
  );
  const supportingEvidence = parseRecords(
    values.get('可以作为参考') ?? '',
    /^- 判断：([^\r\n]+)\r?\n  - 来源：([^\r\n]+)\r?\n  - 局限：([^\r\n]+)$/gm,
    (match) => ({
      claim: match[1]!.trim(),
      source: match[2]!.trim(),
      limitation: match[3]!.trim(),
    }),
    (records) => renderSupportingEvidence({
      conclusion,
      boundary,
      nextStep,
      keyEvidence: [],
      supportingEvidence: records,
      openQuestions: [],
    }),
  );
  const openQuestions = parseRecords(
    values.get('还需要再看看') ?? '',
    /^- 问题：([^\r\n]+)\r?\n  - 下次检查：([^\r\n]+)$/gm,
    (match) => ({ question: match[1]!.trim(), nextCheck: match[2]!.trim() }),
    (records) => renderOpenQuestions({
      conclusion,
      boundary,
      nextStep,
      keyEvidence: [],
      supportingEvidence: [],
      openQuestions: records,
    }),
  );
  if (keyEvidence === null || supportingEvidence === null || openQuestions === null) {
    return null;
  }
  return {
    conclusion,
    boundary,
    nextStep,
    keyEvidence,
    supportingEvidence,
    openQuestions,
  };
}

function sourcePath(source: string): string | null {
  const match = /^(lessons\/[^#]+\.md)#trace-(event-\d+)$/.exec(source);
  return match?.[1] ?? null;
}

function primaryTemplate(body: string): string | null {
  return /^- Primary template:[ \t]*`?([^`\r\n]+)`?[ \t]*$/m
    .exec(body)?.[1]?.trim() ?? null;
}

export function listEligibleKeyEvidence(
  root: string,
  planPath: string,
): string[] {
  const plan = readMarkdownFile(root, planPath);
  const workspace = readPlanWorkspace(root, plan.id);
  if (plan.frontmatter.kind !== 'plan' || workspace.plan.path !== planPath) {
    throw new Error('LEARNING_REVIEW_OWNER_MISMATCH');
  }
  const lessons = new Map(workspace.lessons.map((lesson) => [
    lesson.path,
    readMarkdownFile(root, lesson.path),
  ]));
  return readActiveTraces(root, workspace.lessons.map((lesson) => lesson.path))
    .filter((trace) => {
      if (trace.support !== 'none' || trace.assessment !== 'correct') return false;
      const lesson = lessons.get(trace.lessonPath);
      if (!lesson || primaryTemplate(lesson.body) !== 'assessment') return false;
      return readPreparedLessonBlocks(lesson.body)
        .some((block) => block.id === trace.blockId && block.kind === 'problem');
    })
    .map((trace) => trace.sourceAnchor)
    .sort();
}

function keyEvidenceError(
  code: string,
  source: string | null,
  reason: string,
  eligible: string[],
): never {
  const candidates = eligible.slice(0, 5).join(',') || '(none)';
  throw new Error(
    `${code}: source=${source ?? '(none)'}; reason=${reason}; eligible=${candidates}`,
  );
}

export function validateLearningReviewSources(
  root: string,
  planPath: string,
  review: LearningReview,
): void {
  const plan = readMarkdownFile(root, planPath);
  const workspace = readPlanWorkspace(root, plan.id);
  if (plan.frontmatter.kind !== 'plan' || workspace.plan.path !== planPath) {
    throw new Error('LEARNING_REVIEW_OWNER_MISMATCH');
  }
  const eligible = listEligibleKeyEvidence(root, planPath);
  const eligibleSet = new Set(eligible);
  if (review.keyEvidence.length === 0) {
    keyEvidenceError(
      'LEARNING_REVIEW_KEY_EVIDENCE_REQUIRED',
      null,
      'at-least-one-key-source-required',
      eligible,
    );
  }

  const allowedLessonPaths = new Set(workspace.lessons.map((lesson) => lesson.path));
  const activeTraces = new Map(
    readActiveTraces(root, workspace.lessons.map((lesson) => lesson.path))
      .map((trace) => [trace.sourceAnchor, trace]),
  );
  const keySources = new Set(review.keyEvidence.map((item) => item.source));
  for (const item of review.supportingEvidence) {
    if (keySources.has(item.source)) {
      throw new Error(`LEARNING_REVIEW_SOURCE_TIER_DUPLICATE: ${item.source}`);
    }
  }

  for (const [tier, items] of [
    ['key', review.keyEvidence],
    ['supporting', review.supportingEvidence],
  ] as const) {
    for (const item of items) {
      const path = sourcePath(item.source);
      if (path === null) {
        if (tier === 'key') {
          keyEvidenceError(
            'LEARNING_REVIEW_SOURCE_INVALID',
            item.source,
            'invalid-format',
            eligible,
          );
        }
        throw new Error(`LEARNING_REVIEW_SOURCE_INVALID: ${item.source}`);
      }
      if (!allowedLessonPaths.has(path)) {
        if (tier === 'key') {
          keyEvidenceError(
            'LEARNING_REVIEW_SOURCE_OUTSIDE_PLAN',
            item.source,
            'outside-plan',
            eligible,
          );
        }
        throw new Error(`LEARNING_REVIEW_SOURCE_OUTSIDE_PLAN: ${item.source}`);
      }
      const trace = activeTraces.get(item.source);
      if (trace === undefined) {
        if (tier === 'key') {
          keyEvidenceError(
            'LEARNING_REVIEW_SOURCE_NOT_ACTIVE',
            item.source,
            'not-active',
            eligible,
          );
        }
        throw new Error(`LEARNING_REVIEW_SOURCE_NOT_ACTIVE: ${item.source}`);
      }
      const resolved = sourceResolve(root, {
        fromPath: 'ROADMAP.md',
        target: item.source,
      });
      if (!resolved.valid || resolved.path !== path) {
        if (tier === 'key') {
          keyEvidenceError(
            'LEARNING_REVIEW_SOURCE_INVALID',
            item.source,
            `source-resolution:${resolved.error ?? 'path-mismatch'}`,
            eligible,
          );
        }
        throw new Error(`LEARNING_REVIEW_SOURCE_INVALID: ${item.source}`);
      }
      if (tier === 'supporting') continue;
      if (eligibleSet.has(item.source)) continue;
      if (trace.support !== 'none') {
        keyEvidenceError(
          'LEARNING_REVIEW_KEY_SUPPORT_REQUIRED_NONE',
          item.source,
          `support:${trace.support}`,
          eligible,
        );
      }
      if (trace.assessment !== 'correct') {
        keyEvidenceError(
          'LEARNING_REVIEW_KEY_CORRECT_REQUIRED',
          item.source,
          `assessment:${trace.assessment}`,
          eligible,
        );
      }
      const lesson = readMarkdownFile(root, path);
      const block = readPreparedLessonBlocks(lesson.body)
        .find((candidate) => candidate.id === trace.blockId);
      keyEvidenceError(
        'LEARNING_REVIEW_KEY_NOT_ASSESSMENT',
        item.source,
        `template:${primaryTemplate(lesson.body) ?? '(missing)'},`
        + `block-kind:${block?.kind ?? '(missing)'}`,
        eligible,
      );
    }
  }
}

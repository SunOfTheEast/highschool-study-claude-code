import type { LearningReview } from '../shared/contracts';

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

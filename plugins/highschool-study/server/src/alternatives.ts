import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';
import { readActiveTraces, type TraceRecord } from './traces';

export type CardAlternative = {
  cardPath: string;
  sourceTrace: string;
  question: string;
  primaryMethod: string | null;
  secondaryMethods: string[];
  solution: string;
  recordedAt: string;
};

export type CardAlternativeInput = {
  sourceTraceId: string;
  question: string;
  solution: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cardAlternativePath(cardPath: string): string {
  const extension = extname(cardPath);
  return `${cardPath.slice(0, -extension.length)}.alternatives.md`;
}

function cardParts(root: string, cardPath: string): string[] {
  const raw = record(parse(readFileSync(resolveInsideRoot(root, cardPath), 'utf8')));
  if (raw?.schema !== 'highschool-study.problem-card.v1') return [];
  return (Array.isArray(raw.parts) ? raw.parts : [])
    .map((part) => record(part))
    .map((part) => text(part?.part_id))
    .filter(Boolean);
}

function cardMethods(root: string, cardPath: string): { primary: string | null; secondary: string[] } {
  const raw = record(parse(readFileSync(resolveInsideRoot(root, cardPath), 'utf8')));
  const graph = record(raw?.graph);
  const method = record(graph?.method);
  const primary = text(method?.primary);
  const secondary = Array.isArray(method?.secondary)
    ? method.secondary.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : [];
  return { primary: primary || null, secondary };
}

function normalizePart(value: string): string {
  return value.trim().replace(/^第\s*/, '').replace(/[问题]$/, '').trim();
}

function resolveQuestion(root: string, cardPath: string, question: string): string {
  const requested = question.trim();
  const parts = cardParts(root, cardPath);
  if (parts.length === 0) {
    if (requested !== '整题') throw new Error('INVALID_ALTERNATIVE: question must be 整题 for a card without parts');
    return '整题';
  }
  const normalized = normalizePart(requested);
  const match = parts.find((part) => normalizePart(part) === normalized);
  if (match === undefined) throw new Error('INVALID_ALTERNATIVE: question does not identify a card part');
  return match;
}

function attribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function unattribute(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
}

function renderAlternative(alternative: CardAlternative): string {
  const methods = alternative.primaryMethod === null
    ? '未归类方法'
    : alternative.primaryMethod;
  const lines = [
    `<!-- studyforge-alternative source="${attribute(alternative.sourceTrace)}" question="${attribute(alternative.question)}" -->`,
    `## 另解：${alternative.question}`,
    '',
    `- 来源 Trace: ${alternative.sourceTrace}`,
    `- 记录时间: ${alternative.recordedAt}`,
    `- 主方法: ${methods}`,
  ];
  if (alternative.secondaryMethods.length > 0) {
    lines.push(`- 次方法: ${alternative.secondaryMethods.join('、')}`);
  }
  lines.push('', '### 解法', '', alternative.solution.trim(), '');
  return lines.join('\n');
}

function replaceOrAppendSidecar(root: string, cardPath: string, alternative: CardAlternative): void {
  const sidecarPath = cardAlternativePath(cardPath);
  const absolute = resolveInsideRoot(root, sidecarPath);
  const existing = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '# 题卡另解\n\n';
  const marker = /^<!-- studyforge-alternative source="([^"]*)" question="([^"]*)" -->[ \t]*\n?/gm;
  const matches = [...existing.matchAll(marker)];
  const wantedSource = alternative.sourceTrace;
  const wantedQuestion = alternative.question;
  const wantedIndex = matches.findIndex((match) =>
    unattribute(match[1] ?? '') === wantedSource && unattribute(match[2] ?? '') === wantedQuestion);
  const section = renderAlternative(alternative);
  let output: string;
  if (wantedIndex >= 0) {
    const start = matches[wantedIndex]!.index!;
    const end = matches[wantedIndex + 1]?.index ?? existing.length;
    output = `${existing.slice(0, start)}${section}${existing.slice(end)}`;
  } else {
    output = `${existing.replace(/\s*$/, '')}\n\n${section}`;
  }
  writeFileSync(absolute, output, 'utf8');
}

function parseAlternatives(source: string, cardPath: string): CardAlternative[] {
  const marker = /^<!-- studyforge-alternative source="([^"]*)" question="([^"]*)" -->[ \t]*\n?/gm;
  const matches = [...source.matchAll(marker)];
  return matches.flatMap((match, index) => {
    const sectionStart = match.index!;
    const sectionEnd = matches[index + 1]?.index ?? source.length;
    const section = source.slice(sectionStart + match[0].length, sectionEnd);
    const solution = /^### 解法\s*\n([\s\S]*?)(?:\n\s*$|$)/m.exec(section)?.[1]?.trim() ?? '';
    const recordedAt = /^- 记录时间:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    const primary = /^- 主方法:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '未归类方法';
    const secondary = /^- 次方法:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    if (!solution || !recordedAt) return [];
    return [{
      cardPath,
      sourceTrace: unattribute(match[1] ?? ''),
      question: unattribute(match[2] ?? ''),
      primaryMethod: primary === '未归类方法' ? null : primary,
      secondaryMethods: secondary ? secondary.split('、').map((value) => value.trim()).filter(Boolean) : [],
      solution,
      recordedAt,
    }];
  });
}

function activeSourceTrace(root: string, lessonPath: string, sourceTraceId: string): TraceRecord {
  const active = readActiveTraces(root, [lessonPath]);
  const trace = active.find((item) => item.eventId === sourceTraceId);
  if (trace === undefined) throw new Error('INVALID_ALTERNATIVE: source Trace is not active in this Lesson');
  return trace;
}

export function appendCardAlternative(
  root: string,
  lessonPath: string,
  input: CardAlternativeInput,
  now: () => Date,
): CardAlternative {
  if (!input.solution.trim()) throw new Error('INVALID_ALTERNATIVE: solution is required');
  const trace = activeSourceTrace(root, lessonPath, input.sourceTraceId);
  if (trace.assessment !== 'correct') throw new Error('INVALID_ALTERNATIVE: source Trace must be correct');
  if (trace.cardPath === null) throw new Error('INVALID_ALTERNATIVE: source Trace must bind a card');
  const question = resolveQuestion(root, trace.cardPath, input.question);
  const methods = trace.methods ?? { primary: null, secondary: [] };
  const alternative: CardAlternative = {
    cardPath: trace.cardPath,
    sourceTrace: trace.sourceAnchor,
    question,
    primaryMethod: methods.primary,
    secondaryMethods: methods.secondary,
    solution: input.solution.trim(),
    recordedAt: now().toISOString(),
  };
  replaceOrAppendSidecar(root, trace.cardPath, alternative);
  return alternative;
}

export function readActiveCardAlternatives(
  root: string,
  cardPath: string,
  activeTraces: TraceRecord[] = readActiveTraces(root),
): CardAlternative[] {
  const activeSources = new Set(
    activeTraces.filter((trace) => trace.cardPath === cardPath).map((trace) => trace.sourceAnchor),
  );
  const absolute = resolveInsideRoot(root, cardAlternativePath(cardPath));
  if (!existsSync(absolute)) return [];
  return parseAlternatives(readFileSync(absolute, 'utf8'), cardPath)
    .filter((alternative) => activeSources.has(alternative.sourceTrace));
}

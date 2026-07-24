import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';
import { resolveTraceMethods } from './method-vocabulary';
import {
  readActiveTraces,
  type TraceRecord,
  type TraceSupport,
} from './traces';

export type CardAlternative = {
  id: string;
  cardPath: string;
  sourceTrace: string;
  question: string;
  method: string | null;
  support: TraceSupport;
  solution: string;
  recordedAt: string;
};

export type CardAlternativeInput = {
  sourceTraceId: string;
  question: string;
  solution: string;
  method: string | null;
  support: TraceSupport;
};

const supports = new Set<TraceSupport>(['none', 'tutor', 'external']);

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
  const lines = [
    `<!-- studyforge-alternative id="${attribute(alternative.id)}" question="${attribute(alternative.question)}" -->`,
    `## ${alternative.id} · ${alternative.question}`,
    '',
    `- 来源 Trace: ${alternative.sourceTrace}`,
    `- 记录时间: ${alternative.recordedAt}`,
    `- 支持: ${alternative.support}`,
    `- 方法: ${alternative.method ?? '未归类'}`,
  ];
  lines.push('', '### 解法', '', alternative.solution.trim(), '');
  return lines.join('\n');
}

function appendSidecar(root: string, cardPath: string, alternative: CardAlternative): void {
  const sidecarPath = cardAlternativePath(cardPath);
  const absolute = resolveInsideRoot(root, sidecarPath);
  const existing = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '# 题卡另解\n\n';
  const output = `${existing.replace(/\s*$/, '')}\n\n${renderAlternative(alternative)}`;
  writeFileSync(absolute, output, 'utf8');
}

function parseAlternatives(source: string, cardPath: string): CardAlternative[] {
  const marker = /^<!-- studyforge-alternative id="([^"]*)" question="([^"]*)" -->[ \t]*\n?/gm;
  const matches = [...source.matchAll(marker)];
  return matches.flatMap((match, index) => {
    const sectionStart = match.index!;
    const sectionEnd = matches[index + 1]?.index ?? source.length;
    const section = source.slice(sectionStart + match[0].length, sectionEnd);
    const solution = /^### 解法\s*\n([\s\S]*?)(?:\n\s*$|$)/m.exec(section)?.[1]?.trim() ?? '';
    const sourceTrace = /^- 来源 Trace:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    const recordedAt = /^- 记录时间:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    const support = /^- 支持:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    const method = /^- 方法:\s*(.+)$/m.exec(section)?.[1]?.trim() ?? '';
    const id = unattribute(match[1] ?? '');
    if (
      !/^alt-\d+$/.test(id)
      || !solution
      || !sourceTrace
      || !recordedAt
      || !supports.has(support as TraceSupport)
      || !method
    ) return [];
    return [{
      id,
      cardPath,
      sourceTrace,
      question: unattribute(match[2] ?? ''),
      method: method === '未归类' ? null : method,
      support: support as TraceSupport,
      solution,
      recordedAt,
    }];
  });
}

function nextAlternativeId(alternatives: CardAlternative[]): string {
  const max = alternatives.reduce((current, alternative) => {
    const value = /^alt-(\d+)$/.exec(alternative.id)?.[1];
    return value === undefined ? current : Math.max(current, Number(value));
  }, 0);
  return `alt-${String(max + 1).padStart(3, '0')}`;
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
  if (!supports.has(input.support)) throw new Error('INVALID_ALTERNATIVE: support is invalid');
  const trace = activeSourceTrace(root, lessonPath, input.sourceTraceId);
  if (trace.assessment !== 'correct') throw new Error('INVALID_ALTERNATIVE: source Trace must be correct');
  if (trace.cardPath === null) throw new Error('INVALID_ALTERNATIVE: source Trace must bind a card');
  const question = resolveQuestion(root, trace.cardPath, input.question);
  const methodResolution = input.method === null
    ? { methods: null, unresolved: [] }
    : resolveTraceMethods(root, { primary: input.method });
  if (input.method !== null && methodResolution.methods === null) {
    throw new Error('INVALID_ALTERNATIVE: method is not a canonical graph node');
  }
  const current = readCardAlternatives(root, trace.cardPath);
  const alternative: CardAlternative = {
    id: nextAlternativeId(current),
    cardPath: trace.cardPath,
    sourceTrace: trace.sourceAnchor,
    question,
    method: methodResolution.methods?.primary ?? null,
    support: input.support,
    solution: input.solution.trim(),
    recordedAt: now().toISOString(),
  };
  appendSidecar(root, trace.cardPath, alternative);
  return alternative;
}

export function readCardAlternatives(
  root: string,
  cardPath: string,
): CardAlternative[] {
  const absolute = resolveInsideRoot(root, cardAlternativePath(cardPath));
  if (!existsSync(absolute)) return [];
  return parseAlternatives(readFileSync(absolute, 'utf8'), cardPath);
}

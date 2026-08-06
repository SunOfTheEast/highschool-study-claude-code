#!/usr/bin/env bun

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

type JsonObject = Record<string, unknown>;

export type PiTurnExportOptions = {
  turn: number;
  source?: string;
  includeToolResults?: boolean;
  includeSubagents?: boolean;
  readChildSession?: (path: string) => string | undefined;
};

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function contentParts(message: JsonObject): JsonObject[] {
  const content = message.content;
  if (Array.isArray(content)) {
    return content.map(object).filter((part): part is JsonObject => part !== null);
  }
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return [];
}

function textParts(message: JsonObject): string[] {
  return contentParts(message).flatMap((part) => {
    if (part.type === 'text' && typeof part.text === 'string') return [part.text];
    return [];
  });
}

function parseJsonl(jsonl: string): JsonObject[] {
  return jsonl.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      const value = JSON.parse(line) as unknown;
      const entry = object(value);
      if (!entry) throw new Error('entry is not an object');
      return [entry];
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${String(error)}`);
    }
  });
}

function messageOf(entry: JsonObject): JsonObject | null {
  return entry.type === 'message' ? object(entry.message) : null;
}

function roleOf(entry: JsonObject): string | null {
  const role = messageOf(entry)?.role;
  return typeof role === 'string' ? role : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestampMs(entry: JsonObject): number | null {
  if (typeof entry.timestamp !== 'string') return null;
  const value = Date.parse(entry.timestamp);
  return Number.isFinite(value) ? value : null;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'not recorded';
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

function formatMetric(value: unknown): string {
  const number = finiteNumber(value);
  return number === null ? 'not recorded' : String(number);
}

function renderToolCall(part: JsonObject): string {
  const name = typeof part.name === 'string' ? part.name : 'unknown';
  const args = part.arguments === undefined ? {} : part.arguments;
  return `- ${name}\n\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
}

function renderToolResult(entry: JsonObject): string {
  const message = messageOf(entry)!;
  const name = typeof message.toolName === 'string' ? message.toolName : 'unknown';
  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : 'unknown';
  const body = textParts(message).join('\n') || JSON.stringify(message.content, null, 2);
  return `## Tool result · ${name}\n\nTimestamp: ${timestamp}\n\n${body}`;
}

type SubagentCall = {
  id: string;
  at: number | null;
  args: JsonObject;
};

function subagentCalls(entries: JsonObject[]): SubagentCall[] {
  return entries.flatMap((entry) => {
    const message = messageOf(entry);
    if (message?.role !== 'assistant') return [];
    return contentParts(message).flatMap((part) => {
      if (part.type !== 'toolCall' || part.name !== 'subagent' || typeof part.id !== 'string') {
        return [];
      }
      return [{
        id: part.id,
        at: timestampMs(entry),
        args: object(part.arguments) ?? {},
      }];
    });
  });
}

function requestedChildCount(args: JsonObject): number | null {
  if (Array.isArray(args.tasks)) return args.tasks.length;
  return typeof args.agent === 'string' ? 1 : null;
}

function subagentResult(entries: JsonObject[], toolCallId: string): JsonObject | null {
  for (const entry of entries) {
    const message = messageOf(entry);
    if (
      message?.role === 'toolResult'
      && message.toolName === 'subagent'
      && message.toolCallId === toolCallId
    ) return entry;
  }
  return null;
}

function childStatus(child: JsonObject): string {
  if (child.timedOut === true) return 'timed out';
  if (child.stopped === true) return 'stopped';
  const exitCode = finiteNumber(child.exitCode);
  if (typeof child.error === 'string' || (exitCode !== null && exitCode !== 0)) return 'failed';
  return exitCode === 0 ? 'completed' : 'not recorded';
}

function childUsage(child: JsonObject): string {
  const usage = object(child.usage);
  return [
    `input=${formatMetric(usage?.input)}`,
    `output=${formatMetric(usage?.output)}`,
    `reasoning=${formatMetric(usage?.reasoning)}`,
  ].join(', ');
}

function childToolDistribution(jsonl: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of parseJsonl(jsonl)) {
    const message = messageOf(entry);
    if (message?.role !== 'assistant') continue;
    for (const part of contentParts(message)) {
      if (part.type !== 'toolCall') continue;
      const name = typeof part.name === 'string' ? part.name : 'unknown';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

function addDistribution(target: Map<string, number>, source: Map<string, number>): void {
  for (const [name, count] of source) target.set(name, (target.get(name) ?? 0) + count);
}

function completeSum(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function renderSubagentLoad(
  entries: JsonObject[],
  readChildSession?: (path: string) => string | undefined,
): string[] {
  const sections: string[] = [];
  const taskCalls = subagentCalls(entries).filter((call) => requestedChildCount(call.args) !== null);

  for (const [callIndex, call] of taskCalls.entries()) {
    const resultEntry = subagentResult(entries, call.id);
    const resultMessage = resultEntry ? messageOf(resultEntry) : null;
    const details = object(resultMessage?.details);
    const children = Array.isArray(details?.results)
      ? details.results.map(object).filter((child): child is JsonObject => child !== null)
      : [];
    const requested = requestedChildCount(call.args);
    const parentEnd = resultEntry ? timestampMs(resultEntry) : null;
    const parentWall = call.at !== null && parentEnd !== null
      ? Math.max(0, parentEnd - call.at)
      : null;
    const durations = children.map((child) => finiteNumber(object(child.progressSummary)?.durationMs));
    const toolCounts = children.map((child) => finiteNumber(object(child.progressSummary)?.toolCount));
    const aggregateCompute = completeSum(durations);
    const aggregateTools = completeSum(toolCounts);
    const transcripts = new Map<number, { path: string; jsonl: string }>();
    const distribution = new Map<string, number>();

    for (const [childIndex, child] of children.entries()) {
      if (typeof child.sessionFile !== 'string' || !readChildSession) continue;
      try {
        const childJsonl = readChildSession(child.sessionFile);
        if (childJsonl === undefined) continue;
        addDistribution(distribution, childToolDistribution(childJsonl));
        transcripts.set(childIndex, { path: child.sessionFile, jsonl: childJsonl });
      } catch {
        // A missing or malformed child session is evidence that was not recorded here.
      }
    }

    sections.push(
      callIndex === 0 ? '## Subagent load' : `## Subagent load ${callIndex + 1}`,
      '',
      `Parent wall time: ${formatDuration(parentWall)}`,
      `Aggregate child compute: ${formatDuration(aggregateCompute)}`,
      `Returned children: ${children.length} / ${requested ?? 'not recorded'}`,
      `Tool calls: ${aggregateTools ?? 'not recorded'}`,
    );

    const totalUsage = object(details?.totalChildUsage);
    if (totalUsage) {
      sections.push(
        `Total child usage: input=${formatMetric(totalUsage.input)}, output=${formatMetric(totalUsage.output)}, reasoning=${formatMetric(totalUsage.reasoning)}`,
      );
    } else {
      sections.push('Total child usage: not recorded');
    }

    sections.push('', 'Observed tool distribution:');
    if (distribution.size === 0) {
      sections.push('- not recorded');
    } else {
      for (const [name, count] of [...distribution.entries()].sort(([left], [right]) => (
        left.localeCompare(right)
      ))) sections.push(`- ${name}: ${count}`);
    }

    for (const [childIndex, child] of children.entries()) {
      const summary = object(child.progressSummary);
      const agent = typeof child.agent === 'string' ? child.agent : 'unknown';
      sections.push(
        '',
        `### Child ${childIndex + 1} · ${agent} · ${childStatus(child)}`,
        '',
        `Duration: ${formatDuration(finiteNumber(summary?.durationMs))}`,
        `Tool calls: ${formatMetric(summary?.toolCount)}`,
        `Usage: ${childUsage(child)}`,
      );

      const transcript = transcripts.get(childIndex);
      if (!transcript) {
        sections.push('Transcript: unavailable');
        continue;
      }
      sections.push(
        `Transcript: ${transcript.path}`,
        '',
        renderPiTurn(transcript.jsonl, {
          turn: 1,
          source: transcript.path,
        }).trimEnd(),
      );
    }
  }

  return sections;
}

export function renderPiTurn(jsonl: string, options: PiTurnExportOptions): string {
  if (!Number.isInteger(options.turn) || options.turn < 1) {
    throw new Error('--turn must be a positive integer');
  }

  const entries = parseJsonl(jsonl);
  let sessionId = 'unknown';
  let cwd = 'unknown';
  let provider = 'unknown';
  let model = 'unknown';
  let thinkingLevel = 'unknown';
  let userTurn = 0;
  let collecting = false;
  let found = false;
  const selected: JsonObject[] = [];

  for (const entry of entries) {
    if (!collecting && entry.type === 'session') {
      if (typeof entry.id === 'string') sessionId = entry.id;
      if (typeof entry.cwd === 'string') cwd = entry.cwd;
    }
    if (!collecting && entry.type === 'model_change') {
      if (typeof entry.provider === 'string') provider = entry.provider;
      if (typeof entry.modelId === 'string') model = entry.modelId;
    }
    if (!collecting && entry.type === 'thinking_level_change' && typeof entry.thinkingLevel === 'string') {
      thinkingLevel = entry.thinkingLevel;
    }

    if (roleOf(entry) === 'user') {
      userTurn += 1;
      if (collecting) break;
      if (userTurn === options.turn) {
        collecting = true;
        found = true;
        selected.push(entry);
      }
      continue;
    }
    if (collecting) selected.push(entry);
  }

  if (!found) throw new Error(`User turn ${options.turn} was not found`);

  const userEntry = selected.find((entry) => roleOf(entry) === 'user')!;
  const userMessage = messageOf(userEntry)!;
  const userText = textParts(userMessage).join('\n');
  const userTimestamp = typeof userEntry.timestamp === 'string' ? userEntry.timestamp : 'unknown';
  const reasoningTokens = selected.reduce((total, entry) => {
    const message = messageOf(entry);
    if (message?.role !== 'assistant') return total;
    const usage = object(message.usage);
    return total + (typeof usage?.reasoning === 'number' ? usage.reasoning : 0);
  }, 0);

  const sections = [
    '# Pi Session CoT Export',
    '',
    `Source: ${options.source ?? 'stdin'}`,
    `Session: ${sessionId}`,
    `Working directory: ${cwd}`,
    `Turn: ${options.turn}`,
    `Model: ${provider}/${model}`,
    `Thinking level: ${thinkingLevel}`,
    `Reasoning tokens: ${reasoningTokens}`,
    '',
    '## User',
    '',
    `Timestamp: ${userTimestamp}`,
    '',
    userText,
  ];

  let assistantSegment = 0;
  for (const entry of selected) {
    const message = messageOf(entry);
    if (!message) continue;

    if (message.role === 'toolResult') {
      if (options.includeToolResults) sections.push('', renderToolResult(entry));
      continue;
    }
    if (message.role !== 'assistant') continue;

    assistantSegment += 1;
    const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : 'unknown';
    const stopReason = typeof message.stopReason === 'string' ? message.stopReason : 'unknown';
    const usage = object(message.usage);
    const segmentReasoning = typeof usage?.reasoning === 'number' ? usage.reasoning : 0;
    const parts = contentParts(message);
    const thinking = parts.flatMap((part) => (
      part.type === 'thinking' && typeof part.thinking === 'string' ? [part.thinking] : []
    ));
    const calls = parts.filter((part) => part.type === 'toolCall');
    const publicText = textParts(message);

    sections.push(
      '',
      `## Assistant segment ${assistantSegment}`,
      '',
      `Timestamp: ${timestamp}`,
      `Stop reason: ${stopReason}`,
      `Reasoning tokens: ${segmentReasoning}`,
    );
    if (thinking.length > 0) sections.push('', '### Thinking', '', thinking.join('\n\n'));
    if (calls.length > 0) sections.push('', '### Tool calls', '', calls.map(renderToolCall).join('\n\n'));
    if (publicText.length > 0) sections.push('', '### Public response', '', publicText.join('\n\n'));
  }

  if (options.includeSubagents) {
    const subagentSections = renderSubagentLoad(selected, options.readChildSession);
    if (subagentSections.length > 0) sections.push('', ...subagentSections);
  }

  return `${sections.join('\n').trimEnd()}\n`;
}

function usage(): string {
  return 'Usage: bun scripts/export-pi-cot.ts SESSION.jsonl [--turn N] [--output FILE] [--with-tool-results] [--with-subagents]';
}

function runCli(args: string[]): void {
  let source: string | undefined;
  let output: string | undefined;
  let turn = 1;
  let includeToolResults = false;
  let includeSubagents = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--turn') {
      turn = Number(args[++index]);
    } else if (arg === '--output') {
      output = args[++index];
    } else if (arg === '--with-tool-results') {
      includeToolResults = true;
    } else if (arg === '--with-subagents') {
      includeSubagents = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage()}\n`);
      return;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!source) {
      source = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!source) throw new Error(usage());
  const rendered = renderPiTurn(readFileSync(source, 'utf8'), {
    turn,
    source,
    includeToolResults,
    includeSubagents,
    ...(includeSubagents ? { readChildSession: (path: string) => readFileSync(path, 'utf8') } : {}),
  });
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, rendered);
    process.stdout.write(`${output}\n`);
  } else {
    process.stdout.write(rendered);
  }
}

if (import.meta.main) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

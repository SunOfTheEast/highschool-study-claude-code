import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import { defineTool, type SessionEntry } from '@earendil-works/pi-coding-agent';
import { parseRoadmapSource } from '../study/markdown';
import type { LearningAssetToolSession } from './learning-asset-tools';
import { commitDocumentCandidates } from './multi-document-transaction';

const roadmapParameters = Type.Object({
  title: Type.String({ minLength: 1 }),
  overview: Type.String({ minLength: 1 }),
  longTermGoal: Type.String({ minLength: 1 }),
  capabilityStandard: Type.String({ minLength: 1 }),
  test: Type.String({ minLength: 1 }),
  currentPosition: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    return value.type === 'text' && typeof value.text === 'string' ? [value.text] : [];
  }).join('');
}

function dialogue(entries: readonly SessionEntry[]): Array<{
  role: 'user' | 'assistant';
  text: string;
}> {
  return entries.flatMap((entry) => {
    if (entry.type !== 'message') return [];
    const message = entry.message as unknown as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const text = textContent(message.content).trim();
    return text ? [{ role: message.role as 'user' | 'assistant', text }] : [];
  });
}

function isRoadmapProposal(text: string): boolean {
  return /(Roadmap|长期学习路线|长期路线|学习规划|学习路线)/i.test(text)
    && /(方案|建议|创建|建立|按这份|按这个|制定)/i.test(text);
}

function approvedRoadmap(entries: readonly SessionEntry[]): boolean {
  const messages = dialogue(entries);
  const latestIndex = messages.findLastIndex((item) => item.role === 'user');
  if (latestIndex < 0) return false;
  const latest = messages[latestIndex]!.text;
  if (/(不要|不用|先不|暂不|拒绝|不想).{0,8}(创建|建立|制定|长期|Roadmap)/i.test(latest)) {
    return false;
  }
  if (isRoadmapProposal(latest) && /(确认|同意|可以|就按|创建|建立|开始)/i.test(latest)) {
    return true;
  }
  const acknowledgement = latest.replace(/[，。！？!?、,.\s]/g, '').toLowerCase();
  if (!/^(嗯+|可以|好|好的|行|确认|同意|就这样)$/.test(acknowledgement)) return false;
  const previousAssistant = [...messages.slice(0, latestIndex)]
    .reverse()
    .find((item) => item.role === 'assistant');
  return previousAssistant ? isRoadmapProposal(previousAssistant.text) : false;
}

function roadmapSource(input: {
  title: string;
  overview: string;
  longTermGoal: string;
  capabilityStandard: string;
  test: string;
  currentPosition: string;
}): string {
  return [
    '---',
    'id: roadmap',
    'kind: roadmap',
    'status: active',
    'session_id: null',
    '---',
    '',
    `# ${input.title.trim()}`,
    '',
    '## Overview',
    '',
    input.overview.trim(),
    '',
    '## Long-term Goal',
    '',
    input.longTermGoal.trim(),
    '',
    '## Observable Capability Standard',
    '',
    input.capabilityStandard.trim(),
    '',
    '## Test',
    '',
    input.test.trim(),
    '',
    '## Plan Tree',
    '',
    '## Current Position',
    '',
    input.currentPosition.trim(),
    '',
  ].join('\n');
}

export function createMetaTools(root: string, session: LearningAssetToolSession) {
  const result = (value: Record<string, unknown>) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind: 'roadmap-create' },
  });
  const successful = new Map<string, ReturnType<typeof result>>();
  return [defineTool({
    name: 'create_roadmap',
    label: '创建长期学习路线',
    description: 'Create only ROADMAP.md after the complete public Roadmap proposal has been explicitly approved by the student.',
    executionMode: 'sequential',
    parameters: roadmapParameters,
    execute: async (toolCallId, input) => {
      const replay = successful.get(toolCallId);
      if (replay) return replay;
      if (existsSync(join(root, 'ROADMAP.md'))) throw new Error('ROADMAP_ALREADY_EXISTS');
      if (!approvedRoadmap(session.getBranch())) throw new Error('ROADMAP_CREATE_NOT_CONFIRMED');
      const source = roadmapSource(input);
      const committed = commitDocumentCandidates(root, [{
        path: 'ROADMAP.md',
        before: null,
        after: source,
        validate: (candidate) => parseRoadmapSource('ROADMAP.md', candidate),
      }]);
      const receipt = result({
        ok: true,
        roadmap: { id: 'roadmap', path: 'ROADMAP.md', status: 'active', sessionId: null },
        commitId: committed.commitId,
        changedPaths: committed.changedPaths,
      });
      successful.set(toolCallId, receipt);
      return receipt;
    },
  })];
}

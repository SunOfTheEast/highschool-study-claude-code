import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { parseRoadmapSource } from '../study/markdown';
import { commitDocumentCandidates } from './multi-document-transaction';

const roadmapParameters = Type.Object({
  title: Type.String({ minLength: 1 }),
  overview: Type.String({ minLength: 1 }),
  longTermGoal: Type.String({ minLength: 1 }),
  capabilityStandard: Type.String({ minLength: 1 }),
  test: Type.String({ minLength: 1 }),
  currentPosition: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

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

export function createMetaTools(root: string) {
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

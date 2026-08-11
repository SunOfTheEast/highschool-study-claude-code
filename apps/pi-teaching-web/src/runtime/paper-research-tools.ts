import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type {
  PaperResearchResponder,
  PaperResearchResponse,
} from './paper-research-runner';

export const PAPER_RESEARCH_DETAILS = {
  kind: 'paper-research',
  version: 1,
} as const;

const parameters = Type.Object({
  anchor: Type.String({ minLength: 1, maxLength: 800 }),
  bridgeQuestion: Type.String({ minLength: 1, maxLength: 1_200 }),
  studentLevel: Type.String({ minLength: 1, maxLength: 240 }),
}, { additionalProperties: false });

function result(value: PaperResearchResponse) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: {
      ...PAPER_RESEARCH_DETAILS,
      phase: value.status === 'done' ? 'done' as const : 'unavailable' as const,
    },
  };
}

export function createPaperResearchTool(respond: PaperResearchResponder) {
  return defineTool({
    name: 'paper_research',
    label: '查找相关论文',
    description: 'Search a bounded academic-paper index only after the student explicitly asks for research or accepts the teacher\'s immediately preceding suggestion. Submit the current academic anchor, the student\'s actual bridge question, and only the minimum level information needed for explanation. This tool returns temporary discussion material; it never writes assets, memory, or course state.',
    executionMode: 'sequential',
    parameters,
    execute: async (_toolCallId, input, signal, onUpdate) => {
      const response = await respond(input, signal, (phase) => {
        onUpdate?.({
          content: [],
          details: { ...PAPER_RESEARCH_DETAILS, phase },
        });
      });
      return result(response);
    },
  });
}

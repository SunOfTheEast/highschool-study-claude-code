import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';

const stableId = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' });
const target = Type.Object({
  id: stableId,
  expectedRevision: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
const markdownBlock = Type.Object({
  kind: Type.Literal('markdown'),
  body: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
const recallBlock = Type.Object({
  kind: Type.Literal('recall'),
  prompt: Type.String({ minLength: 1 }),
  answer: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
const noteContent = {
  title: Type.String({ minLength: 1 }),
  blocks: Type.Array(Type.Union([markdownBlock, recallBlock]), { minItems: 1 }),
};
const cardContent = {
  stem: Type.String({ minLength: 1 }),
  studentNote: Type.String(),
  standardAnswer: Type.String({ minLength: 1 }),
  teacherRationale: Type.String({ minLength: 1 }),
};

function result(assetKind: 'note' | 'problem-card') {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, displayed: assetKind }),
    }],
    details: {
      kind: 'learning-asset-proposal' as const,
      version: 1 as const,
      assetKind,
    },
  };
}

export function createLearningAssetProposalTools() {
  return [
    defineTool({
      name: 'propose_note',
      label: '展示笔记草稿',
      description: 'Display one complete Note draft in the conversation before any persistent save. Use a new proposal after any student correction. This tool does not write files, assign an asset ID, save tags, or infer approval.',
      executionMode: 'sequential',
      parameters: Type.Union([
        Type.Object(noteContent, { additionalProperties: false }),
        Type.Object({ ...noteContent, target }, { additionalProperties: false }),
      ]),
      execute: async () => result('note'),
    }),
    defineTool({
      name: 'propose_problem_card',
      label: '展示题卡草稿',
      description: 'Display one complete Problem Card draft before any persistent save. The student projection shows the stem and student note but withholds the standard answer and teacher rationale. Use a new proposal after any correction. This tool does not write files or infer approval.',
      executionMode: 'sequential',
      parameters: Type.Union([
        Type.Object(cardContent, { additionalProperties: false }),
        Type.Object({ ...cardContent, target }, { additionalProperties: false }),
      ]),
      execute: async () => result('problem-card'),
    }),
  ];
}

export function createPlanProblemCardProposalTool() {
  return defineTool({
    name: 'propose_problem_card',
    label: '展示备课题卡草稿',
    description: 'After the prepared Lesson is delivered, display the teacher-authored Problem Card that could be attached to one exact problem Block. The student sees the stem and student note but not the answer or teacher rationale. This tool is non-writing and does not infer approval.',
    executionMode: 'sequential',
    parameters: Type.Object({
      lessonId: stableId,
      blockId: stableId,
      ...cardContent,
    }, { additionalProperties: false }),
    execute: async () => result('problem-card'),
  });
}

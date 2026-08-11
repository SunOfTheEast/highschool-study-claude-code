import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  appendClassroomLogSource,
  applyClassroomChange,
  type ClassroomChange,
} from '../study/lesson-mutations';
import {
  readLearningNote,
  readProblemCardAtPath,
} from '../study/learning-assets';
import { readMaterial, readMaterialLocator, readMaterialRevision } from '../study/materials';
import { parseLessonSource, readLesson } from '../study/markdown';
import type { LearningSourceReference } from '../shared/contracts';
import { mutateDocumentAtomically } from './atomic-document';
import {
  createLearningAssetTools,
  type LearningAssetToolSession,
} from './learning-asset-tools';
import { createLessonMemoryTool } from './memory-tools';
import { createNodeFinishTool } from './node-finish-tools';
import type { PaperResearchResponder } from './paper-research-runner';
import { createPaperResearchTool } from './paper-research-tools';
import { createLearningAssetProposalTools } from './learning-asset-proposal-tools';
import { createCalendarTools, type CalendarRepository } from './calendar-tools';

const blockId = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
  description: 'One Block ID already visible in the current Lesson.',
});

const placement = Type.Object({
  position: Type.Union([Type.Literal('before'), Type.Literal('after')]),
  anchorBlockId: blockId,
}, { additionalProperties: false });

const blockDraft = Type.Object({
  title: Type.String({ minLength: 1 }),
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ]),
  required: Type.Boolean(),
  dependsOn: Type.Array(blockId),
  uses: Type.Array(Type.String({
    pattern: '^(?:cards/.+\\.ya?ml|materials/.+)$',
    description: 'An exact source path already bound to the current evidence boundary.',
  })),
  studentView: Type.String({ minLength: 1 }),
  teacherControl: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

const classroomUpdateParameters = Type.Object({
  change: Type.Union([
    Type.Object({
      command: Type.Literal('start'),
      blockId,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('advance'),
      outcome: Type.Union([Type.Literal('completed'), Type.Literal('skipped')]),
      nextBlockId: Type.Union([blockId, Type.Null()]),
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('insert'),
      placement,
      block: blockDraft,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('revise'),
      blockId,
      block: blockDraft,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('move'),
      blockId,
      placement,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('skip_pending'),
      blockId,
    }, { additionalProperties: false }),
  ]),
}, { additionalProperties: false });

function toolResult(value: Record<string, unknown>, command: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind: 'lesson-write', command },
  };
}

type LessonSourceAlias = {
  alias: string;
  path: string;
  source: LearningSourceReference;
};

function sourceForLessonUse(root: string, path: string): LearningSourceReference | null {
  if (/^cards\/.+\.ya?ml$/i.test(path) && !path.includes('/.revisions/')) {
    const card = readProblemCardAtPath(root, path);
    return { kind: 'problem-card', id: card.id, revision: card.revision };
  }
  const note = /^notes\/([A-Za-z0-9][A-Za-z0-9._-]*)\.note\.yaml$/.exec(path);
  if (note) {
    const asset = readLearningNote(root, note[1]!);
    if (asset.path !== path) throw new Error(`LESSON_ASSET_PATH_MISMATCH: ${path}`);
    return { kind: 'note', id: asset.id, revision: asset.revision };
  }
  const manifest = /^materials\/([A-Za-z0-9][A-Za-z0-9._-]*)\/manifest\.yaml$/.exec(path);
  if (manifest) {
    const material = readMaterial(root, manifest[1]!);
    return { kind: 'material', id: material.id, revision: material.currentRevision, locator: null };
  }
  const original = /^materials\/([A-Za-z0-9][A-Za-z0-9._-]*)\/revisions\/([1-9][0-9]*)\/original(?:\..+)?$/.exec(path);
  if (original) {
    const revision = Number.parseInt(original[2]!, 10);
    const material = readMaterialRevision(root, original[1]!, revision);
    if (material.originalPath !== path) throw new Error(`LESSON_ASSET_PATH_MISMATCH: ${path}`);
    return { kind: 'material', id: original[1]!, revision, locator: null };
  }
  const page = /^materials\/([A-Za-z0-9][A-Za-z0-9._-]*)\/projections\/([1-9][0-9]*)\/pages\/(page-[0-9]{4})\.txt$/.exec(path);
  if (page) {
    const source = {
      kind: 'material' as const,
      id: page[1]!,
      revision: Number.parseInt(page[2]!, 10),
      locator: page[3]!,
    };
    readMaterialLocator(root, source);
    return source;
  }
  return null;
}

export function lessonSourceAliases(root: string, lessonPath: string): LessonSourceAlias[] {
  const uses = readLesson(root, lessonPath).blocks.flatMap((block) => block.uses);
  const unique = [...new Set(uses)];
  return unique.flatMap((path) => {
    const source = sourceForLessonUse(root, path);
    return source ? [{ path, source }] : [];
  }).map((item, index) => ({ ...item, alias: `source-${index + 1}` }));
}

export function renderLessonSourceAliases(root: string, lessonPath: string): string {
  const aliases = lessonSourceAliases(root, lessonPath);
  if (aliases.length === 0) return '';
  return [
    '# Current Lesson Source Aliases',
    '',
    ...aliases.map((item) => `- ${item.alias}: ${item.path}`),
    '',
    'These aliases are the only sources an asset saved in this Lesson may cite.',
  ].join('\n');
}

function resolveLessonSourceAliases(
  bound: readonly LessonSourceAlias[],
  requested: readonly string[],
): LearningSourceReference[] {
  const aliases = new Map(bound.map((item) => [item.alias, item.source]));
  const seen = new Set<string>();
  return requested.map((alias) => {
    if (seen.has(alias)) throw new Error(`ASSET_SOURCE_ALIAS_DUPLICATE: ${alias}`);
    seen.add(alias);
    const source = aliases.get(alias);
    if (!source) throw new Error(`ASSET_SOURCE_ALIAS_UNKNOWN: ${alias}`);
    return source;
  });
}

export function createLessonTools(
  root: string,
  lessonPath: string,
  session?: LearningAssetToolSession,
  paperResearchResponder?: PaperResearchResponder,
  calendar?: CalendarRepository,
  scope?: import('./session-scope').NodeSessionScope,
) {
  const boundSources = session ? lessonSourceAliases(root, lessonPath) : [];
  const validate = (source: string) => parseLessonSource(lessonPath, source);
  const logTool = defineTool({
    name: 'classroom_log_append',
    label: '记录课堂事实',
    description: 'Append one decision-relevant classroom fact to the current active Block.',
    executionMode: 'sequential',
    parameters: Type.Object({
      note: Type.String({
        minLength: 1,
        description: 'One natural-language classroom fact; multiple sentences are allowed.',
      }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, { note }) => {
      const receipt = mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => {
          const candidate = appendClassroomLogSource(lessonPath, source, note);
          const lesson = parseLessonSource(lessonPath, candidate);
          const active = lesson.blocks.find((block) => block.status === 'active')!;
          return {
            source: candidate,
            value: {
              ok: true,
              activeBlockId: active.id,
              classroomLogCount: active.classroomLog.length,
            },
          };
        },
        validate,
      );
      return toolResult(receipt, 'log_append');
    },
  });

  const updateTool = defineTool({
    name: 'classroom_update',
    label: '更新课堂活动',
    description: 'Apply one Block start, advance, or pending-route adaptation in the current Lesson.',
    executionMode: 'sequential',
    parameters: classroomUpdateParameters,
    execute: async (_toolCallId, { change }) => {
      const receipt = mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => {
          const result = applyClassroomChange(
            root,
            lessonPath,
            source,
            change as ClassroomChange,
          );
          const { source: candidate, ...cursor } = result;
          return {
            source: candidate,
            value: { ok: true, ...cursor },
          };
        },
        validate,
      );
      return toolResult(receipt, change.command);
    },
  });

  const assetTools = session
    ? createLearningAssetTools(root, {
      resolve: (aliases) => resolveLessonSourceAliases(boundSources, aliases),
    }, session)
    : [];
  const proposalTools = session ? createLearningAssetProposalTools() : [];
  const memoryTool = session ? createLessonMemoryTool(root, lessonPath, session) : null;
  const paperResearch = paperResearchResponder
    ? createPaperResearchTool(paperResearchResponder)
    : null;
  const finishTool = createNodeFinishTool(root, 'lesson', lessonPath);
  return memoryTool
    ? [
      logTool,
      updateTool,
      ...assetTools,
      ...proposalTools,
      memoryTool,
      ...(paperResearch ? [paperResearch] : []),
      ...(calendar && scope ? createCalendarTools(calendar, root, scope) : []),
      finishTool,
    ]
    : [
      logTool,
      updateTool,
      ...assetTools,
      ...proposalTools,
      ...(paperResearch ? [paperResearch] : []),
      ...(calendar && scope ? createCalendarTools(calendar, root, scope) : []),
      finishTool,
    ];
}

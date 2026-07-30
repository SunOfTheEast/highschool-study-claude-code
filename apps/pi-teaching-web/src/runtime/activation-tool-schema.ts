import { Type, type TSchema } from 'typebox';
import { parseSourceHandle } from 'highschool-study-markdown/study-domain';

const nonempty = Type.String({ minLength: 1 });

function canonicalHandles(values: readonly string[]): {
  evidence: string[];
  memory: string[];
} {
  const evidence: string[] = [];
  const memory: string[] = [];
  for (const value of [...new Set(values)]) {
    try {
      const parsed = parseSourceHandle(value);
      (parsed.kind === 'memory' ? memory : evidence).push(value);
    } catch {
      // Node Frames also contain file, runtime and tool pages. They are context,
      // but they are not canonical evidence handles for an Activation Snapshot.
    }
  }
  return { evidence, memory };
}

function literalChoice(values: string[], description: string): TSchema {
  if (values.length === 0) return Type.Never({ description });
  if (values.length === 1) return Type.Literal(values[0]!, { description });
  return Type.Union(
    values.map((value) => Type.Literal(value)),
    { description },
  );
}

export function createActivationInputSchema(
  availableSources?: readonly string[],
) {
  if (availableSources === undefined) {
    return Type.Object({
      parentSources: Type.Array(nonempty, { minItems: 1 }),
      selectedMemory: Type.Array(nonempty),
      contentBoundary: Type.Array(nonempty, { minItems: 1 }),
      adaptation: Type.Object({
        workingJudgment: nonempty,
        sources: Type.Array(nonempty, { minItems: 1 }),
        designConsequence: nonempty,
        reviseIf: nonempty,
      }, { additionalProperties: false }),
    }, { additionalProperties: false });
  }
  const handles = canonicalHandles(availableSources);
  const all = [...handles.evidence, ...handles.memory];
  return Type.Object({
    parentSources: Type.Array(literalChoice(
      handles.evidence,
      'Canonical non-memory evidence handles available to this Node Session.',
    ), {
      minItems: 1,
      description: 'Choose one or more exact handles offered by this schema. Do not write file paths, candidate handles or prose labels.',
    }),
    selectedMemory: handles.memory.length === 0
      ? Type.Array(Type.Never(), {
        maxItems: 0,
        description: 'No memory handle is available in this Node Frame; pass an empty array.',
      })
      : Type.Array(literalChoice(
        handles.memory,
        'Memory handles available to this Node Session.',
      ), {
        description: 'Choose only exact memory handles offered by this schema.',
      }),
    contentBoundary: Type.Array(nonempty, { minItems: 1 }),
    adaptation: Type.Object({
      workingJudgment: nonempty,
      sources: Type.Array(literalChoice(
        all,
        'Canonical evidence and memory handles available to this Node Session.',
      ), {
        minItems: 1,
        description: 'Copy a non-empty subset of the handles selected above. Do not write a new source.',
      }),
      designConsequence: nonempty,
      reviseIf: nonempty,
    }, { additionalProperties: false }),
  }, { additionalProperties: false });
}

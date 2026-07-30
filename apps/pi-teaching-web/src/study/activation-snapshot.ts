import { parseSourceHandle } from 'highschool-study-markdown/study-domain';

export type AdaptationBrief = {
  workingJudgment: string;
  sources: string[];
  designConsequence: string;
  reviseIf: string;
};

export type ActivationSnapshotDraft = {
  parentSources: string[];
  selectedMemory: string[];
  contentBoundary: string[];
  adaptation: AdaptationBrief;
};

export type ActivationSnapshot = {
  parent: string;
  activatedAt: 'pending' | string;
  draft: ActivationSnapshotDraft;
};

const parentPattern = /^(roadmap|plan):[A-Za-z0-9@][A-Za-z0-9@._-]*$/;

function invalidDraft(): never {
  throw new Error('ACTIVATION_SNAPSHOT_INVALID');
}

function invalidFormat(): never {
  throw new Error('ACTIVATION_SNAPSHOT_FORMAT_INVALID');
}

function oneLine(value: string): string {
  const result = value.trim();
  if (!result || /[\r\n]/.test(result)) invalidDraft();
  return result;
}

function canonicalSources(
  values: string[],
  expected: 'memory' | 'non-memory',
): string[] {
  if (values.length === 0 && expected === 'non-memory') invalidDraft();
  const result = values.map((source) => {
    let parsed;
    try {
      parsed = parseSourceHandle(source);
    } catch {
      return invalidDraft();
    }
    if (
      (expected === 'memory' && parsed.kind !== 'memory')
      || (expected === 'non-memory' && parsed.kind === 'memory')
    ) {
      invalidDraft();
    }
    return source;
  });
  if (new Set(result).size !== result.length) invalidDraft();
  return result;
}

export function validateActivationSnapshotDraft(
  draft: ActivationSnapshotDraft,
): ActivationSnapshotDraft {
  const parentSources = canonicalSources(draft.parentSources, 'non-memory');
  const selectedMemory = canonicalSources(draft.selectedMemory, 'memory');
  const contentBoundary = draft.contentBoundary.map(oneLine);
  if (
    contentBoundary.length === 0
    || new Set(contentBoundary).size !== contentBoundary.length
  ) {
    invalidDraft();
  }
  const adaptationSources = draft.adaptation.sources.map((source) => {
    try {
      parseSourceHandle(source);
    } catch {
      return invalidDraft();
    }
    return source;
  });
  const selected = new Set([...parentSources, ...selectedMemory]);
  if (
    adaptationSources.length === 0
    || new Set(adaptationSources).size !== adaptationSources.length
    || adaptationSources.some((source) => !selected.has(source))
  ) {
    invalidDraft();
  }
  return {
    parentSources,
    selectedMemory,
    contentBoundary,
    adaptation: {
      workingJudgment: oneLine(draft.adaptation.workingJudgment),
      sources: adaptationSources,
      designConsequence: oneLine(draft.adaptation.designConsequence),
      reviseIf: oneLine(draft.adaptation.reviseIf),
    },
  };
}

function validateParent(parent: string): string {
  if (!parentPattern.test(parent)) {
    throw new Error('ACTIVATION_PARENT_INVALID');
  }
  return parent;
}

function renderSnapshot(snapshot: ActivationSnapshot): string {
  const parent = validateParent(snapshot.parent);
  const draft = validateActivationSnapshotDraft(snapshot.draft);
  if (
    snapshot.activatedAt !== 'pending'
    && !Number.isFinite(Date.parse(snapshot.activatedAt))
  ) {
    invalidFormat();
  }
  return `## Activation Snapshot

- Parent: ${parent}
- Activated at: ${snapshot.activatedAt}

### Selected Context

${[...draft.parentSources, ...draft.selectedMemory]
  .map((source) => `- ${source}`).join('\n')}

### Content Boundary

${draft.contentBoundary.map((boundary) => `- ${boundary}`).join('\n')}

### Adaptation Brief

- Working judgment: ${draft.adaptation.workingJudgment}
- Sources:
${draft.adaptation.sources.map((source) => `  - ${source}`).join('\n')}
- Design consequence: ${draft.adaptation.designConsequence}
- Revise if: ${draft.adaptation.reviseIf}
`;
}

export function renderPreparedActivationSnapshot(
  parent: string,
  draft: ActivationSnapshotDraft,
): string {
  return renderSnapshot({ parent, activatedAt: 'pending', draft });
}

function snapshotSection(source: string): string {
  const normalized = source.replaceAll('\r\n', '\n');
  const matches = [...normalized.matchAll(/^## Activation Snapshot[ \t]*$/gm)];
  if (matches.length !== 1) invalidFormat();
  const start = matches[0]!.index!;
  const rest = normalized.slice(start + matches[0]![0].length);
  const boundary = /^#{1,2} [^\n]+$/m.exec(rest);
  return normalized.slice(
    start,
    boundary === null ? normalized.length : start + matches[0]![0].length + boundary.index,
  ).trim();
}

function listBetween(
  section: string,
  heading: string,
  nextHeading: string,
): string[] {
  const pattern = new RegExp(
    `^### ${heading}[ \\t]*\\n\\n([\\s\\S]*?)(?=^### ${nextHeading}[ \\t]*$)`,
    'm',
  );
  const body = pattern.exec(section)?.[1]?.trim();
  if (!body) invalidFormat();
  const lines = body.split('\n');
  if (lines.some((line) => !line.startsWith('- ') || !line.slice(2).trim())) {
    invalidFormat();
  }
  return lines.map((line) => line.slice(2));
}

export function parseActivationSnapshot(source: string): ActivationSnapshot {
  const section = snapshotSection(source);
  const parent = /^- Parent: (.+)$/m.exec(section)?.[1];
  const activatedAt = /^- Activated at: (.+)$/m.exec(section)?.[1];
  if (!parent || !activatedAt) invalidFormat();
  const selected = listBetween(
    section,
    'Selected Context',
    'Content Boundary',
  );
  const contentBoundary = listBetween(
    section,
    'Content Boundary',
    'Adaptation Brief',
  );
  const adaptation = /^### Adaptation Brief[ \t]*\n\n- Working judgment: ([^\n]+)\n- Sources:\n((?:  - [^\n]+\n)+)- Design consequence: ([^\n]+)\n- Revise if: ([^\n]+)$/m
    .exec(section);
  if (!adaptation) invalidFormat();
  const parentSources = selected.filter((value) => !value.startsWith('memory:'));
  const selectedMemory = selected.filter((value) => value.startsWith('memory:'));
  const draft: ActivationSnapshotDraft = {
    parentSources,
    selectedMemory,
    contentBoundary,
    adaptation: {
      workingJudgment: adaptation[1]!,
      sources: adaptation[2]!.trimEnd().split('\n').map((line) => line.slice(4)),
      designConsequence: adaptation[3]!,
      reviseIf: adaptation[4]!,
    },
  };
  let normalized: ActivationSnapshotDraft;
  try {
    validateParent(parent);
    normalized = validateActivationSnapshotDraft(draft);
  } catch {
    return invalidFormat();
  }
  if (
    activatedAt !== 'pending'
    && !Number.isFinite(Date.parse(activatedAt))
  ) {
    invalidFormat();
  }
  const snapshot: ActivationSnapshot = {
    parent,
    activatedAt,
    draft: normalized,
  };
  if (renderSnapshot(snapshot).trim() !== section) invalidFormat();
  return snapshot;
}

export function sealActivationSnapshot(source: string, now: Date): string {
  const snapshot = parseActivationSnapshot(source);
  if (snapshot.activatedAt !== 'pending') {
    throw new Error('ACTIVATION_SNAPSHOT_ALREADY_SEALED');
  }
  if (!Number.isFinite(now.getTime())) {
    throw new Error('ACTIVATION_TIME_INVALID');
  }
  const sealed = renderSnapshot({
    ...snapshot,
    activatedAt: now.toISOString(),
  }).trim();
  const prepared = renderSnapshot(snapshot).trim();
  const section = snapshotSection(source);
  if (section !== prepared) invalidFormat();
  return source.replace(section, sealed);
}

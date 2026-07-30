export type HandoffClaimDraft = {
  statement: string;
  scope: string;
  sources: string[];
  boundary: string;
  nextUse: string;
};

export type OpenQuestionDraft = {
  question: string;
  sources: string[];
  nextCheck: string;
};

export type HandoffDraft = {
  learnerClaims: HandoffClaimDraft[];
  teachingClaims: HandoffClaimDraft[];
  openQuestions: OpenQuestionDraft[];
};

export type HandoffIdentity = {
  id: string;
  from: string;
  to: string;
  sealedAt: string;
};

export type HandoffClaim = HandoffClaimDraft & {
  id: string;
  sourceRef: `claim:${string}`;
};

export type OpenQuestion = OpenQuestionDraft & {
  id: string;
};

export type Handoff = {
  identity: HandoffIdentity;
  mode: 'claims' | 'source-only';
  learnerClaims: HandoffClaim[];
  teachingClaims: HandoffClaim[];
  openQuestions: OpenQuestion[];
  sourceIndex: string[];
};

export type SourceHandle =
  | { kind: 'trace'; traceId: string }
  | { kind: 'session'; sessionId: string; messageId: string | null }
  | { kind: 'card'; cardPath: string }
  | { kind: 'block'; lessonId: string; blockId: string }
  | {
    kind: 'claim';
    handoffId: string;
    claimKind: 'learner' | 'teaching';
    claimId: string;
  }
  | {
    kind: 'memory';
    owner: 'student' | 'teaching';
    entryId: string;
  };

const safeId = '[A-Za-z0-9@][A-Za-z0-9@._-]*';
const tracePattern = new RegExp(`^trace:(trace-${safeId})$`);
const sessionPattern = new RegExp(
  `^session:(${safeId})(?:#message:(${safeId}))?$`,
);
const cardPattern = /^card:(cards\/[A-Za-z0-9][A-Za-z0-9._/-]*\.ya?ml)$/;
const blockPattern = new RegExp(`^block:(${safeId})/(${safeId})$`);
const claimPattern = new RegExp(
  `^claim:(${safeId}/handoff)#(learner-c([1-9]\\d*)|teaching-t([1-9]\\d*))$`,
);
const memoryPattern = new RegExp(
  `^memory:(student|teaching)/(${safeId})$`,
);
const nodeRefPattern = new RegExp(`^(roadmap|plan|lesson):(${safeId})$`);

function invalidSource(): never {
  throw new Error('INVALID_HANDOFF_SOURCE');
}

function invalidDraft(): never {
  throw new Error('INVALID_HANDOFF_DRAFT');
}

function invalidIdentity(): never {
  throw new Error('INVALID_HANDOFF_IDENTITY');
}

function invalidFormat(): never {
  throw new Error('INVALID_HANDOFF_FORMAT');
}

function hasSafeSegments(path: string): boolean {
  return !path.split('/').some((segment) => (
    !segment || segment === '.' || segment === '..'
  ));
}

export function parseSourceHandle(source: string): SourceHandle {
  if (source !== source.trim()) invalidSource();
  const trace = tracePattern.exec(source);
  if (trace) return { kind: 'trace', traceId: trace[1]! };
  const session = sessionPattern.exec(source);
  if (session) {
    return {
      kind: 'session',
      sessionId: session[1]!,
      messageId: session[2] ?? null,
    };
  }
  const card = cardPattern.exec(source);
  if (card && hasSafeSegments(card[1]!)) {
    return { kind: 'card', cardPath: card[1]! };
  }
  const block = blockPattern.exec(source);
  if (block) {
    return { kind: 'block', lessonId: block[1]!, blockId: block[2]! };
  }
  const claim = claimPattern.exec(source);
  if (claim) {
    const learnerNumber = claim[3];
    const teachingNumber = claim[4];
    return {
      kind: 'claim',
      handoffId: claim[1]!,
      claimKind: learnerNumber === undefined ? 'teaching' : 'learner',
      claimId: learnerNumber === undefined
        ? `T${teachingNumber!}`
        : `C${learnerNumber}`,
    };
  }
  const memory = memoryPattern.exec(source);
  if (memory) {
    return {
      kind: 'memory',
      owner: memory[1] as 'student' | 'teaching',
      entryId: memory[2]!,
    };
  }
  return invalidSource();
}

function validateIdentity(identity: HandoffIdentity): HandoffIdentity {
  const from = nodeRefPattern.exec(identity.from);
  const to = nodeRefPattern.exec(identity.to);
  if (
    !from
    || !to
    || identity.id !== `${from[2]}/handoff`
    || !Number.isFinite(Date.parse(identity.sealedAt))
  ) {
    invalidIdentity();
  }
  return { ...identity };
}

function text(value: string): string {
  const result = value.trim();
  if (!result) invalidDraft();
  return result;
}

function sources(values: string[]): string[] {
  if (values.length === 0) invalidDraft();
  const result = values.map((value) => {
    parseSourceHandle(value);
    return value;
  });
  if (new Set(result).size !== result.length) invalidDraft();
  return result;
}

function normalizeClaim(claim: HandoffClaimDraft): HandoffClaimDraft {
  return {
    statement: text(claim.statement),
    scope: text(claim.scope),
    sources: sources(claim.sources),
    boundary: text(claim.boundary),
    nextUse: text(claim.nextUse),
  };
}

function normalizeQuestion(question: OpenQuestionDraft): OpenQuestionDraft {
  return {
    question: text(question.question),
    sources: sources(question.sources),
    nextCheck: text(question.nextCheck),
  };
}

function normalizeDraft(draft: HandoffDraft): HandoffDraft {
  if (
    !Array.isArray(draft.learnerClaims)
    || !Array.isArray(draft.teachingClaims)
    || !Array.isArray(draft.openQuestions)
    || draft.learnerClaims.length + draft.teachingClaims.length === 0
  ) {
    invalidDraft();
  }
  return {
    learnerClaims: draft.learnerClaims.map(normalizeClaim),
    teachingClaims: draft.teachingClaims.map(normalizeClaim),
    openQuestions: draft.openQuestions.map(normalizeQuestion),
  };
}

function json(value: string): string {
  return JSON.stringify(value);
}

function renderIdentity(identity: HandoffIdentity): string[] {
  return [
    '## Handoff',
    '',
    `- ID: ${identity.id}`,
    `- From: ${identity.from}`,
    `- To: ${identity.to}`,
    `- Sealed at: ${identity.sealedAt}`,
  ];
}

function renderSources(values: string[]): string[] {
  return ['- Sources:', ...values.map((source) => `  - ${source}`)];
}

function uniqueSources(draft: HandoffDraft): string[] {
  const ordered = [
    ...draft.learnerClaims,
    ...draft.teachingClaims,
    ...draft.openQuestions,
  ].flatMap((entry) => entry.sources);
  return [...new Set(ordered)];
}

export function renderHandoff(
  identityInput: HandoffIdentity,
  draftInput: HandoffDraft,
): string {
  const identity = validateIdentity(identityInput);
  const draft = normalizeDraft(draftInput);
  const lines = renderIdentity(identity);

  for (const [index, claim] of draft.learnerClaims.entries()) {
    lines.push(
      '',
      `### Learner C${index + 1}`,
      '',
      `- Statement: ${json(claim.statement)}`,
      `- Scope: ${json(claim.scope)}`,
      ...renderSources(claim.sources),
      `- Boundary: ${json(claim.boundary)}`,
      `- Next use: ${json(claim.nextUse)}`,
    );
  }
  for (const [index, claim] of draft.teachingClaims.entries()) {
    lines.push(
      '',
      `### Teaching T${index + 1}`,
      '',
      `- Statement: ${json(claim.statement)}`,
      `- Scope: ${json(claim.scope)}`,
      ...renderSources(claim.sources),
      `- Boundary: ${json(claim.boundary)}`,
      `- Next use: ${json(claim.nextUse)}`,
    );
  }
  for (const [index, question] of draft.openQuestions.entries()) {
    lines.push(
      '',
      `### Open Question Q${index + 1}`,
      '',
      `- Question: ${json(question.question)}`,
      ...renderSources(question.sources),
      `- Next check: ${json(question.nextCheck)}`,
    );
  }
  lines.push(
    '',
    '### Source Index',
    '',
    ...uniqueSources(draft).map((source) => `- ${source}`),
  );
  return `${lines.join('\n')}\n`;
}

export function renderSourceOnlyHandoff(
  identityInput: HandoffIdentity,
  sourceInput: string[],
): string {
  const identity = validateIdentity(identityInput);
  const sourceIndex = sources(sourceInput);
  return `${[
    ...renderIdentity(identity),
    '',
    '### Source Index',
    '',
    ...sourceIndex.map((source) => `- ${source}`),
  ].join('\n')}\n`;
}

function parseJsonText(line: string, field: string): string {
  const match = new RegExp(`^- ${field}: (.+)$`).exec(line);
  if (!match) invalidFormat();
  try {
    const value: unknown = JSON.parse(match[1]!);
    if (typeof value !== 'string' || !value.trim()) invalidFormat();
    return value.trim();
  } catch {
    return invalidFormat();
  }
}

function parseSourceLines(lines: string[], start: number): {
  values: string[];
  next: number;
} {
  if (lines[start] !== '- Sources:') invalidFormat();
  const values: string[] = [];
  let index = start + 1;
  while (lines[index]?.startsWith('  - ')) {
    const source = lines[index]!.slice(4);
    try {
      parseSourceHandle(source);
    } catch {
      invalidFormat();
    }
    values.push(source);
    index += 1;
  }
  if (values.length === 0 || new Set(values).size !== values.length) {
    invalidFormat();
  }
  return { values, next: index };
}

function sectionFromSource(source: string): string {
  const normalized = source.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const matches = lines.flatMap((line, index) => (
    line === '## Handoff' ? [index] : []
  ));
  if (matches.length !== 1) invalidFormat();
  const start = matches[0]!;
  const next = lines.findIndex((line, index) => (
    index > start && /^#{1,2} /.test(line)
  ));
  return lines.slice(start, next < 0 ? undefined : next).join('\n').trim();
}

function envelope(lines: string[]): HandoffIdentity {
  if (
    lines[0] !== '## Handoff'
    || lines[1] !== ''
  ) {
    invalidFormat();
  }
  const id = /^- ID: (.+)$/.exec(lines[2] ?? '')?.[1];
  const from = /^- From: (.+)$/.exec(lines[3] ?? '')?.[1];
  const to = /^- To: (.+)$/.exec(lines[4] ?? '')?.[1];
  const sealedAt = /^- Sealed at: (.+)$/.exec(lines[5] ?? '')?.[1];
  if (!id || !from || !to || !sealedAt) invalidFormat();
  try {
    return validateIdentity({ id, from, to, sealedAt });
  } catch {
    return invalidFormat();
  }
}

export function parseHandoff(source: string): Handoff {
  const section = sectionFromSource(source);
  const lines = section.split('\n');
  const identity = envelope(lines);
  let index = 6;
  const learnerClaims: HandoffClaim[] = [];
  const teachingClaims: HandoffClaim[] = [];
  const openQuestions: OpenQuestion[] = [];
  let sourceIndex: string[] | null = null;

  while (index < lines.length) {
    if (lines[index] === '') index += 1;
    const heading = lines[index];
    if (heading === '### Source Index') {
      index += 1;
      if (lines[index] === '') index += 1;
      const values: string[] = [];
      while (index < lines.length && lines[index]!.startsWith('- ')) {
        const sourceValue = lines[index]!.slice(2);
        try {
          parseSourceHandle(sourceValue);
        } catch {
          invalidFormat();
        }
        values.push(sourceValue);
        index += 1;
      }
      if (values.length === 0 || new Set(values).size !== values.length) {
        invalidFormat();
      }
      sourceIndex = values;
      continue;
    }

    const learner = /^### Learner C([1-9]\d*)$/.exec(heading ?? '');
    const teaching = /^### Teaching T([1-9]\d*)$/.exec(heading ?? '');
    const question = /^### Open Question Q([1-9]\d*)$/.exec(heading ?? '');
    if (!learner && !teaching && !question) invalidFormat();
    index += 1;
    if (lines[index] === '') index += 1;

    if (question) {
      const id = `Q${question[1]}`;
      const questionText = parseJsonText(lines[index++] ?? '', 'Question');
      const parsedSources = parseSourceLines(lines, index);
      index = parsedSources.next;
      const nextCheck = parseJsonText(lines[index++] ?? '', 'Next check');
      openQuestions.push({
        id,
        question: questionText,
        sources: parsedSources.values,
        nextCheck,
      });
      continue;
    }

    const claimId = learner ? `C${learner[1]}` : `T${teaching![1]}`;
    const statement = parseJsonText(lines[index++] ?? '', 'Statement');
    const scope = parseJsonText(lines[index++] ?? '', 'Scope');
    const parsedSources = parseSourceLines(lines, index);
    index = parsedSources.next;
    const boundary = parseJsonText(lines[index++] ?? '', 'Boundary');
    const nextUse = parseJsonText(lines[index++] ?? '', 'Next use');
    const kind = learner ? 'learner' : 'teaching';
    const record: HandoffClaim = {
      id: claimId,
      sourceRef: `claim:${identity.id}#${kind}-${claimId.toLowerCase()}`,
      statement,
      scope,
      sources: parsedSources.values,
      boundary,
      nextUse,
    };
    (learner ? learnerClaims : teachingClaims).push(record);
  }

  if (sourceIndex === null) invalidFormat();
  const mode = learnerClaims.length + teachingClaims.length > 0
    ? 'claims' as const
    : 'source-only' as const;
  if (mode === 'source-only' && openQuestions.length > 0) invalidFormat();
  const handoff: Handoff = {
    identity,
    mode,
    learnerClaims,
    teachingClaims,
    openQuestions,
    sourceIndex,
  };

  try {
    const canonical = mode === 'source-only'
      ? renderSourceOnlyHandoff(identity, sourceIndex)
      : renderHandoff(identity, {
        learnerClaims: learnerClaims.map((claim) => ({
          statement: claim.statement,
          scope: claim.scope,
          sources: claim.sources,
          boundary: claim.boundary,
          nextUse: claim.nextUse,
        })),
        teachingClaims: teachingClaims.map((claim) => ({
          statement: claim.statement,
          scope: claim.scope,
          sources: claim.sources,
          boundary: claim.boundary,
          nextUse: claim.nextUse,
        })),
        openQuestions: openQuestions.map((entry) => ({
          question: entry.question,
          sources: entry.sources,
          nextCheck: entry.nextCheck,
        })),
      });
    if (canonical.trim() !== section) invalidFormat();
  } catch {
    invalidFormat();
  }
  return handoff;
}

export type ProfileOwner = 'student' | 'teaching';

export type ProfileEntry = {
  id: string;
  content: string;
  scope: string;
  sources: string[];
  rationale: string;
  counterEvidence: string;
};

const sectionHeading = /^## Active Preferences[ \t]*$/m;

function invalid(): never {
  throw new Error('MEMORY_PROFILE_FORMAT_INVALID');
}

function activeSection(source: string): {
  headingEnd: number;
  sectionEnd: number;
  content: string;
} {
  const normalized = source.replaceAll('\r\n', '\n');
  const heading = sectionHeading.exec(normalized);
  if (!heading) invalid();
  const headingEnd = heading.index + heading[0].length;
  const nextHeading = /^## [^\n]+$/gm;
  nextHeading.lastIndex = headingEnd;
  const next = nextHeading.exec(normalized);
  const sectionEnd = next?.index ?? normalized.length;
  return {
    headingEnd,
    sectionEnd,
    content: normalized.slice(headingEnd, sectionEnd).trim(),
  };
}

function singleLine(value: string): string {
  const result = value.trim();
  if (!result || /[\r\n]/.test(result)) invalid();
  return result;
}

function sourcePath(value: string): string {
  const result = singleLine(value);
  const pathMatch = /^(?:lessons|plans)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.md(?:#[A-Za-z0-9][A-Za-z0-9._=-]*)?$/
    .exec(result);
  if (pathMatch) {
    const path = result.split('#', 1)[0]!;
    if (path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
      invalid();
    }
    return result;
  }
  if (
    /^claim:[A-Za-z0-9@][A-Za-z0-9@._-]*\/handoff#(?:learner-c|teaching-t)[1-9]\d*$/
      .test(result)
  ) return result;
  return invalid();
}

function expectedPrefix(owner: ProfileOwner): 'S' | 'T' {
  return owner === 'student' ? 'S' : 'T';
}

function validateEntries(owner: ProfileOwner, entries: ProfileEntry[]): ProfileEntry[] {
  const prefix = expectedPrefix(owner);
  const ids = new Set<string>();
  return entries.map((entry) => {
    if (!new RegExp(`^${prefix}[1-9]\\d*$`).test(entry.id) || ids.has(entry.id)) {
      invalid();
    }
    ids.add(entry.id);
    if (entry.sources.length === 0) invalid();
    return {
      id: entry.id,
      content: singleLine(entry.content),
      scope: singleLine(entry.scope),
      sources: entry.sources.map(sourcePath),
      rationale: singleLine(entry.rationale),
      counterEvidence: singleLine(entry.counterEvidence),
    };
  });
}

function renderEntries(owner: ProfileOwner, entries: ProfileEntry[]): string {
  return validateEntries(owner, entries).map((entry) => [
    `### ${entry.id}`,
    '',
    `- Content: ${entry.content}`,
    `- Scope: ${entry.scope}`,
    '- Sources:',
    ...entry.sources.map((source) => `  - ${source}`),
    `- Rationale: ${entry.rationale}`,
    `- Counter-evidence: ${entry.counterEvidence}`,
  ].join('\n')).join('\n\n');
}

export function parseProfileDocument(
  source: string,
  owner: ProfileOwner,
): ProfileEntry[] {
  const section = activeSection(source);
  if (!section.content) return [];
  const headings = [...section.content.matchAll(/^### ([^\n]+)[ \t]*$/gm)];
  if (headings.length === 0 || section.content.slice(0, headings[0]!.index).trim()) {
    invalid();
  }
  const entries = headings.map((heading, index) => {
    const id = heading[1]!.trim();
    const block = section.content.slice(
      heading.index! + heading[0].length,
      headings[index + 1]?.index ?? section.content.length,
    ).trim();
    const match = /^- Content: ([^\r\n]+)\r?\n- Scope: ([^\r\n]+)\r?\n- Sources:\r?\n((?:  - [^\r\n]+\r?\n)+)- Rationale: ([^\r\n]+)\r?\n- Counter-evidence: ([^\r\n]+)$/
      .exec(block);
    if (!match) invalid();
    return {
      id,
      content: match[1]!,
      scope: match[2]!,
      sources: match[3]!.trimEnd().split(/\r?\n/).map((line) => line.slice(4)),
      rationale: match[4]!,
      counterEvidence: match[5]!,
    };
  });
  const normalized = validateEntries(owner, entries);
  if (renderEntries(owner, normalized) !== section.content) invalid();
  return normalized;
}

export function renderProfileDocument(
  source: string,
  owner: ProfileOwner,
  entries: ProfileEntry[],
): string {
  const normalized = source.replaceAll('\r\n', '\n');
  const section = activeSection(normalized);
  const body = renderEntries(owner, entries);
  const suffix = normalized.slice(section.sectionEnd);
  if (suffix) {
    return `${normalized.slice(0, section.headingEnd)}\n\n${body ? `${body}\n\n` : ''}${suffix}`;
  }
  return `${normalized.slice(0, section.headingEnd)}${body ? `\n\n${body}` : ''}\n`;
}

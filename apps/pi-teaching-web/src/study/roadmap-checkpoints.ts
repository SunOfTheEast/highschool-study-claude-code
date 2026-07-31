import { existsSync, readFileSync } from 'node:fs';
import {
  parseHandoff,
  resolveInsideRoot,
  type Handoff,
} from 'highschool-study-markdown/study-domain';

const checkpointHeading = /^### Checkpoint ([A-Za-z0-9][A-Za-z0-9._-]*)[ \t]*$/gm;

export function readRoadmapCheckpoints(root: string): Handoff[] {
  const path = resolveInsideRoot(root, 'ROADMAP.md');
  if (!existsSync(path)) return [];
  const source = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
  const headings = [...source.matchAll(checkpointHeading)];
  return headings.flatMap((heading, index) => {
    const id = heading[1]!;
    const contentStart = heading.index! + heading[0].length;
    const nextCheckpoint = headings[index + 1]?.index ?? source.length;
    const nextSectionOffset = /^## [^\n]+$/m.exec(
      source.slice(contentStart, nextCheckpoint),
    )?.index;
    const block = source.slice(
      contentStart,
      nextSectionOffset === undefined
        ? nextCheckpoint
        : contentStart + nextSectionOffset,
    );
    const sealedAt = /^- Sealed at: (.+)$/m.exec(block)?.[1]?.trim();
    const firstSection = /^#### (?:Learner|Teaching|Open Question) /m.exec(block);
    if (!sealedAt || !firstSection || !Number.isFinite(Date.parse(sealedAt))) {
      return [];
    }
    const sections = block.slice(firstSection.index).trim()
      .replace(/^#### /gm, '### ');
    const sourceIndex = [...sections.matchAll(/^  - (.+)$/gm)]
      .map((match) => match[1]!)
      .filter((value, position, values) => values.indexOf(value) === position);
    if (sourceIndex.length === 0) return [];
    const canonical = [
      '## Handoff',
      '',
      `- ID: ${id}/handoff`,
      `- From: roadmap:${id}`,
      '- To: roadmap:roadmap',
      `- Sealed at: ${sealedAt}`,
      '',
      sections,
      '',
      '### Source Index',
      '',
      ...sourceIndex.map((value) => `- ${value}`),
    ].join('\n');
    try {
      return [parseHandoff(canonical)];
    } catch {
      return [];
    }
  });
}

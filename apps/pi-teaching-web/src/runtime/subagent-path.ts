import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studySubagentDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../resources/subagents',
);
export const studyReadonlyToolsPath = join(
  studySubagentDirectory,
  'tools/study-readonly-tools.ts',
);
export const studySubagentRuntimeDirectory = join(
  tmpdir(),
  `studyforge-pi-subagents-${process.pid}`,
);

export function configureStudySubagentDirectory(): void {
  mkdirSync(studySubagentRuntimeDirectory, { recursive: true });
  const definition = readFileSync(join(studySubagentDirectory, 'study-scout.md'), 'utf8')
    .replace(
      'subagentOnlyExtensions: ./tools/study-readonly-tools.ts',
      `subagentOnlyExtensions: ${studyReadonlyToolsPath}`,
    );
  writeFileSync(join(studySubagentRuntimeDirectory, 'study-scout.md'), definition);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [
    process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS,
    studySubagentRuntimeDirectory,
  ].filter(Boolean).join(delimiter);
}

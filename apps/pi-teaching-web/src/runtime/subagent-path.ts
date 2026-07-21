import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studySubagentDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../resources/subagents',
);

export function configureStudySubagentDirectory(): void {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [
    process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS,
    studySubagentDirectory,
  ].filter(Boolean).join(delimiter);
}

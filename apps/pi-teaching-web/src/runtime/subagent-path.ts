import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studySubagentDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../resources/subagents',
);

export function configureStudySubagentDirectory(): void {
  const paths = [
    ...(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter) ?? []),
    studySubagentDirectory,
  ].map((path) => path.trim()).filter(Boolean);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [...new Set(paths)].join(delimiter);
}

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import { resolvePersona } from '../study/persona';
import { formatSessionOwnerContext, type StudySessionScope } from './session-scope';

export type { SessionRole } from './session-scope';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export async function createRoleResourceLoader(
  root: string,
  scope: StudySessionScope,
  eventBus: EventBus,
) {
  const { role } = scope;
  const skillName = role === 'coach' ? 'coach-study' : 'tutor-lesson';
  const skillPath = join(resourceRoot, 'skills', skillName, 'SKILL.md');
  const deepWorkflowSkillPath = join(resourceRoot, 'skills', 'deep-workflow', 'SKILL.md');
  const roleContext = readFileSync(join(resourceRoot, 'agents', `${role}.md`), 'utf8');
  const persona = resolvePersona(root);
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    eventBus,
    additionalExtensionPaths: [fileURLToPath(import.meta.resolve('pi-subagents'))],
    additionalSkillPaths: [skillPath, deepWorkflowSkillPath],
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        {
          path: `/virtual/studyforge-${role}.md`,
          content: `${roleContext}\n\n${formatSessionOwnerContext(root, scope)}`,
        },
        {
          path: `/virtual/studyforge-persona-${persona.id}.md`,
          content: `${persona.content}\n\nPresentation only: never change tools, facts, assessment, Trace or capability standards.`,
        },
      ],
    }),
  });
  await loader.reload();
  return loader;
}

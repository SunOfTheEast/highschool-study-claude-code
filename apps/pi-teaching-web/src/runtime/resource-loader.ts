import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import { resolvePersona } from '../study/persona';
import {
  formatSessionOwnerContext,
  type SessionRole,
  type StudySessionScope,
} from './session-scope';

export type { SessionRole } from './session-scope';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export function roleSkillNames(role: SessionRole): string[] {
  return role === 'coach'
    ? ['coach-study', 'plan-next-cycle', 'deep-workflow']
    : ['tutor-lesson', 'deep-workflow'];
}

export function composeRoleContext(
  teachingCore: string,
  roleContext: string,
  ownerContext: string,
): string {
  return [teachingCore, roleContext, ownerContext]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function createRoleResourceLoader(
  root: string,
  scope: StudySessionScope,
  eventBus: EventBus,
) {
  const { role } = scope;
  const skillPaths = roleSkillNames(role)
    .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md'));
  const teachingCore = readFileSync(
    join(resourceRoot, 'teaching', 'math-teaching-core.md'),
    'utf8',
  );
  const roleContext = readFileSync(join(resourceRoot, 'agents', `${role}.md`), 'utf8');
  const persona = resolvePersona(root);
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    eventBus,
    additionalExtensionPaths: [fileURLToPath(import.meta.resolve('pi-subagents'))],
    additionalSkillPaths: skillPaths,
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        {
          path: `/virtual/studyforge-${role}.md`,
          content: composeRoleContext(
            teachingCore,
            roleContext,
            formatSessionOwnerContext(root, scope),
          ),
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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import { resolvePersona } from '../study/persona';
import {
  compileNodeContext,
  renderCompiledNodeContext,
} from './node-context';
import {
  isRoadmapCoachScope,
  roleForNode,
  type NodeSessionScope,
  type SessionRole,
} from './session-scope';

export type { SessionRole } from './session-scope';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export function roleSkillNames(role: SessionRole): string[] {
  return role === 'coach'
    ? ['coach-study', 'plan-next-cycle', 'deep-workflow']
    : ['tutor-lesson', 'deep-workflow'];
}

export function skillNamesForScope(scope: NodeSessionScope): string[] {
  if (isRoadmapCoachScope(scope)) {
    return ['roadmap-study', 'plan-next-cycle', 'deep-workflow'];
  }
  return roleSkillNames(roleForNode(scope.nodeKind));
}

export async function createRoleResourceLoader(
  root: string,
  scope: NodeSessionScope,
  eventBus: EventBus,
  options: { sessionId?: string | null } = {},
) {
  const role = roleForNode(scope.nodeKind);
  const skillPaths = skillNamesForScope(scope)
    .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md'));
  const context = compileNodeContext(root, scope, options);
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
          content: renderCompiledNodeContext(context),
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

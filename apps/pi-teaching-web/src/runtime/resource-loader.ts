import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import { M0_MODEL_TOOLS, formatSessionOwnerContext, type NodeSessionScope } from './session-scope';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

const roleFiles = {
  roadmap: 'roadmap-node.md',
  plan: 'plan-node.md',
  lesson: 'lesson-node.md',
} as const;

const roleSkills = {
  roadmap: ['roadmap-study', 'plan-next-cycle'],
  plan: ['coach-study', 'plan-next-cycle'],
  lesson: ['tutor-lesson'],
} as const;

export type StaticNodeResources = {
  agentsFiles: Array<{ path: string; content: string }>;
  skillPaths: string[];
  tools: readonly string[];
};

function file(path: string): string {
  return readFileSync(path, 'utf8');
}

export function loadStaticNodeResources(
  root: string,
  scope: NodeSessionScope,
): StaticNodeResources {
  const roleFile = roleFiles[scope.nodeKind];
  const owner = [
    formatSessionOwnerContext(root, scope),
    '',
    'Read the current node file before making a teaching or planning decision.',
    'Read child documents and learning assets directly when they are needed.',
    'Do not assume another node transcript has been copied into this Session.',
  ].join('\n');
  return {
    agentsFiles: [
      {
        path: '/virtual/studyforge-m0-teaching-core.md',
        content: file(join(resourceRoot, 'teaching', 'math-teaching-core.md')),
      },
      {
        path: `/virtual/studyforge-m0-${roleFile}`,
        content: `Role resource: ${roleFile}\n\n${file(join(resourceRoot, 'agents', roleFile))}`,
      },
      {
        path: '/virtual/studyforge-m0-learning-guide.md',
        content: file(join(root, 'LEARNING_GUIDE.md')),
      },
      {
        path: '/virtual/studyforge-m0-current-node.md',
        content: owner,
      },
    ],
    skillPaths: roleSkills[scope.nodeKind]
      .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md')),
    tools: M0_MODEL_TOOLS,
  };
}

export async function createRoleResourceLoader(
  root: string,
  scope: NodeSessionScope,
  eventBus: EventBus,
) {
  const resources = loadStaticNodeResources(root, scope);
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    eventBus,
    additionalSkillPaths: resources.skillPaths,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    agentsFilesOverride: () => ({ agentsFiles: resources.agentsFiles }),
  });
  await loader.reload();
  return loader;
}

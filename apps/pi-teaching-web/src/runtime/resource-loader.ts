import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import {
  formatSessionOwnerContext,
  modelToolsForNode,
  type NodeSessionScope,
} from './session-scope';
import { studySubagentGuard } from './study-subagent-guard';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

const roleFiles = {
  roadmap: 'roadmap-node.md',
  plan: 'plan-node.md',
  lesson: 'lesson-node.md',
} as const;

const roleSkills = {
  roadmap: ['roadmap-dialogue', 'prepare-approved-plan'],
  plan: ['plan-dialogue', 'prepare-approved-lesson'],
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

function loadPersonaResource(personaId: string | undefined) {
  const id = personaId?.trim();
  if (!id) return [];
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`STUDY_PERSONA_INVALID: ${id}`);
  }
  const path = join(resourceRoot, 'personas', `${id}.md`);
  if (!existsSync(path)) throw new Error(`STUDY_PERSONA_NOT_FOUND: ${id}`);
  return [{
    path: `/virtual/studyforge-m0-persona-${id}.md`,
    content: file(path),
  }];
}

export function loadStaticNodeResources(
  root: string,
  scope: NodeSessionScope,
  personaId?: string,
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
        path: '/virtual/studyforge-m0-document-contract.md',
        content: file(join(resourceRoot, 'contracts', 'm0-document-contract.md')),
      },
      {
        path: join(root, 'LEARNING_GUIDE.md'),
        content: file(join(root, 'LEARNING_GUIDE.md')),
      },
      {
        path: '/virtual/studyforge-m0-teaching-core.md',
        content: file(join(resourceRoot, 'teaching', 'math-teaching-core.md')),
      },
      {
        path: `/virtual/studyforge-m0-${roleFile}`,
        content: `Role resource: ${roleFile}\n\n${file(join(resourceRoot, 'agents', roleFile))}`,
      },
      ...loadPersonaResource(personaId),
      {
        path: '/virtual/studyforge-m0-current-node.md',
        content: owner,
      },
    ],
    skillPaths: roleSkills[scope.nodeKind]
      .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md')),
    tools: modelToolsForNode(scope.nodeKind),
  };
}

export async function createRoleResourceLoader(
  root: string,
  scope: NodeSessionScope,
  eventBus: EventBus,
  personaId: string | undefined = process.env.STUDY_PERSONA,
) {
  const resources = loadStaticNodeResources(root, scope, personaId);
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    eventBus,
    additionalExtensionPaths: scope.nodeKind === 'plan'
      ? [fileURLToPath(import.meta.resolve('pi-subagents'))]
      : [],
    extensionFactories: scope.nodeKind === 'plan'
      ? [{
        name: 'study-subagent-guard',
        factory: studySubagentGuard,
        hidden: true,
      }]
      : [],
    additionalSkillPaths: resources.skillPaths,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    agentsFilesOverride: () => ({ agentsFiles: resources.agentsFiles }),
  });
  await loader.reload();
  return loader;
}

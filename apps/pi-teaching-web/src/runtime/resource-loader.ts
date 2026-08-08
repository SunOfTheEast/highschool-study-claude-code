import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import {
  FREE_LEARNING_MODEL_TOOLS,
  formatFreeLearningOwnerContext,
  formatSessionOwnerContext,
  isFreeLearningScope,
  modelToolsForNode,
  type FreeLearningSessionScope,
  type NodeSessionScope,
  type StudySessionScope,
} from './session-scope';
import { studySubagentGuard } from './study-subagent-guard';
import { lessonMemoryGuard } from './lesson-memory-guard';
import { memoryEnabled } from './memory-tools';

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

export type StaticSessionResources = StaticNodeResources;

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

function loadMemoryIndexResource(root: string) {
  const path = join(root, 'memory', 'INDEX.md');
  return existsSync(path) ? [{ path, content: file(path) }] : [];
}

export function loadStaticNodeResources(
  root: string,
  scope: NodeSessionScope,
  personaId?: string,
): StaticNodeResources {
  const roleFile = roleFiles[scope.nodeKind];
  const hasMemory = memoryEnabled(root);
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
      ...(hasMemory ? [{
        path: '/virtual/studyforge-m1-memory-contract.md',
        content: file(join(resourceRoot, 'contracts', 'm1-memory-contract.md')),
      }] : []),
      {
        path: join(root, 'LEARNING_GUIDE.md'),
        content: file(join(root, 'LEARNING_GUIDE.md')),
      },
      ...(hasMemory ? loadMemoryIndexResource(root) : []),
      {
        path: '/virtual/studyforge-m0-teaching-core.md',
        content: file(join(resourceRoot, 'teaching', 'math-teaching-core.md')),
      },
      {
        path: `/virtual/studyforge-m0-${roleFile}`,
        content: `Role resource: ${roleFile}\n\n${file(join(resourceRoot, 'agents', roleFile))}`,
      },
      {
        path: '/virtual/studyforge-teacher-presence.md',
        content: file(join(resourceRoot, 'teaching', 'teacher-presence.md')),
      },
      ...loadPersonaResource(personaId),
      {
        path: '/virtual/studyforge-m0-current-node.md',
        content: owner,
      },
    ],
    skillPaths: roleSkills[scope.nodeKind]
      .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md')),
    tools: modelToolsForNode(scope.nodeKind, hasMemory),
  };
}

export function loadStaticFreeLearningResources(
  root: string,
  scope: FreeLearningSessionScope,
  personaId?: string,
): StaticSessionResources {
  const hasMemory = memoryEnabled(root);
  return {
    agentsFiles: [
      ...(hasMemory ? [{
        path: '/virtual/studyforge-m1-memory-contract.md',
        content: file(join(resourceRoot, 'contracts', 'm1-memory-contract.md')),
      }] : []),
      {
        path: join(root, 'LEARNING_GUIDE.md'),
        content: file(join(root, 'LEARNING_GUIDE.md')),
      },
      ...(hasMemory ? loadMemoryIndexResource(root) : []),
      {
        path: '/virtual/studyforge-m0-teaching-core.md',
        content: file(join(resourceRoot, 'teaching', 'math-teaching-core.md')),
      },
      {
        path: '/virtual/studyforge-m1b-free-learning.md',
        content: file(join(resourceRoot, 'agents', 'free-learning.md')),
      },
      {
        path: '/virtual/studyforge-teacher-presence.md',
        content: file(join(resourceRoot, 'teaching', 'teacher-presence.md')),
      },
      ...loadPersonaResource(personaId),
      {
        path: '/virtual/studyforge-m1b-current-session.md',
        content: formatFreeLearningOwnerContext(root, scope),
      },
    ],
    skillPaths: [join(resourceRoot, 'skills', 'free-learning', 'SKILL.md')],
    tools: FREE_LEARNING_MODEL_TOOLS,
  };
}

export async function createRoleResourceLoader(
  root: string,
  scope: StudySessionScope,
  eventBus: EventBus,
  personaId: string | undefined = process.env.STUDY_PERSONA,
) {
  const resources = isFreeLearningScope(scope)
    ? loadStaticFreeLearningResources(root, scope, personaId)
    : loadStaticNodeResources(root, scope, personaId);
  const extensionFactories = !isFreeLearningScope(scope) && scope.nodeKind === 'plan'
    ? [{
      name: 'study-subagent-guard',
      factory: studySubagentGuard,
      hidden: true,
    }]
    : !isFreeLearningScope(scope) && scope.nodeKind === 'lesson'
      ? [{
        name: 'lesson-memory-guard',
        factory: lessonMemoryGuard(root, scope),
        hidden: true,
      }]
      : [];
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    eventBus,
    additionalExtensionPaths: !isFreeLearningScope(scope) && scope.nodeKind === 'plan'
      ? [fileURLToPath(import.meta.resolve('pi-subagents'))]
      : [],
    extensionFactories,
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

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DefaultResourceLoader,
  getAgentDir,
  type EventBus,
} from '@earendil-works/pi-coding-agent';
import {
  formatFreeLearningOwnerContext,
  formatMetaOwnerContext,
  formatSessionOwnerContext,
  isFreeLearningScope,
  isMetaScope,
  isNodeSessionScope,
  META_MODEL_TOOLS,
  modelToolsForFreeLearning,
  modelToolsForNode,
  type FreeLearningSessionScope,
  type MetaSessionScope,
  type NodeSessionScope,
  type StudySessionScope,
} from './session-scope';
import { studySubagentGuard } from './study-subagent-guard';
import { lessonMemoryGuard } from './lesson-memory-guard';
import { renderLessonSourceAliases } from './lesson-tools';
import { memoryEnabled } from './memory-tools';
import { renderSelectedAssetContext } from '../study/learning-assets';
import { renderSelectedProblemActivityContext } from '../study/problem-attempts';

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

function semanticAssetOverview(root: string): string {
  const path = join(root, 'semantics', 'indexes', 'asset-recall.tsv');
  if (!existsSync(path)) {
    return '# Semantic asset overview\n\n- Indexed assets: 0\n- Frequent tags: none';
  }
  const rows = file(path).split(/\r?\n/).slice(1).filter(Boolean);
  const counts = new Map<string, number>();
  let notes = 0;
  let cards = 0;
  for (const row of rows) {
    const fields = row.split('\t');
    if (fields[1] === 'note') notes += 1;
    if (fields[1] === 'problem-card') cards += 1;
    for (const field of [fields[3], fields[4]]) {
      if (!field) continue;
      let tags: unknown;
      try {
        tags = JSON.parse(field);
      } catch {
        continue;
      }
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (typeof tag === 'string' && tag.trim()) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }
  }
  const frequent = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([tag, count]) => `${tag} (${count})`);
  return [
    '# Semantic asset overview',
    '',
    `- Indexed assets: ${rows.length} (${notes} Notes, ${cards} problem cards)`,
    `- Frequent tags: ${frequent.join('、') || 'none'}`,
    '',
    'This is a compact content inventory, not evidence of student mastery.',
  ].join('\n');
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
  const lessonSources = scope.nodeKind === 'lesson'
    ? renderLessonSourceAliases(root, scope.nodePath)
    : '';
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
      ...(lessonSources ? [{
        path: '/virtual/studyforge-m1c-lesson-source-aliases.md',
        content: lessonSources,
      }] : []),
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
  const selectedAssets = renderSelectedAssetContext(root, scope.selectedAssets);
  const selectedActivity = renderSelectedProblemActivityContext(root, scope.selectedAssets);
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
      ...(selectedAssets ? [{
        path: '/virtual/studyforge-m1b-selected-assets.md',
        content: selectedAssets,
      }] : []),
      ...(selectedActivity ? [{
        path: '/virtual/studyforge-m1b-selected-problem-activity.md',
        content: selectedActivity,
      }] : []),
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
    tools: modelToolsForFreeLearning(hasMemory),
  };
}

export function loadStaticMetaResources(
  root: string,
  scope: MetaSessionScope,
  personaId?: string,
): StaticSessionResources {
  const selectedAssets = renderSelectedAssetContext(root, scope.selectedAssets);
  return {
    agentsFiles: [
      {
        path: join(root, 'LEARNING_GUIDE.md'),
        content: file(join(root, 'LEARNING_GUIDE.md')),
      },
      ...loadMemoryIndexResource(root),
      {
        path: '/virtual/studyforge-m1c-semantic-overview.md',
        content: semanticAssetOverview(root),
      },
      ...(selectedAssets ? [{
        path: '/virtual/studyforge-m1c-meta-selected-assets.md',
        content: selectedAssets,
      }] : []),
      {
        path: '/virtual/studyforge-m1c-meta-session.md',
        content: file(join(resourceRoot, 'agents', 'meta-session.md')),
      },
      {
        path: '/virtual/studyforge-teacher-presence.md',
        content: file(join(resourceRoot, 'teaching', 'teacher-presence.md')),
      },
      ...loadPersonaResource(personaId),
      {
        path: '/virtual/studyforge-m1c-current-meta-session.md',
        content: formatMetaOwnerContext(root, scope),
      },
    ],
    skillPaths: [join(resourceRoot, 'skills', 'meta-dialogue', 'SKILL.md')],
    tools: META_MODEL_TOOLS,
  };
}

export async function createRoleResourceLoader(
  root: string,
  scope: StudySessionScope,
  eventBus: EventBus,
  personaId: string | undefined = process.env.STUDY_PERSONA,
) {
  const resources = isMetaScope(scope)
    ? loadStaticMetaResources(root, scope, personaId)
    : isFreeLearningScope(scope)
      ? loadStaticFreeLearningResources(root, scope, personaId)
      : loadStaticNodeResources(root, scope, personaId);
  const extensionFactories = isNodeSessionScope(scope) && scope.nodeKind === 'plan'
    ? [{
      name: 'study-subagent-guard',
      factory: studySubagentGuard,
      hidden: true,
    }]
    : isNodeSessionScope(scope) && scope.nodeKind === 'lesson'
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
    additionalExtensionPaths: isNodeSessionScope(scope) && scope.nodeKind === 'plan'
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

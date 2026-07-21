import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefaultResourceLoader, getAgentDir } from '@earendil-works/pi-coding-agent';
import { resolvePersona } from '../study/persona';

export type SessionRole = 'coach' | 'tutor';

const resourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export async function createRoleResourceLoader(
  root: string,
  role: SessionRole,
  ownerId: string,
) {
  const skillName = role === 'coach' ? 'coach-study' : 'tutor-lesson';
  const skillPath = join(resourceRoot, 'skills', skillName, 'SKILL.md');
  const roleContext = readFileSync(join(resourceRoot, 'agents', `${role}.md`), 'utf8');
  const persona = resolvePersona(root);
  const loader = new DefaultResourceLoader({
    cwd: root,
    agentDir: getAgentDir(),
    additionalSkillPaths: [skillPath],
    agentsFilesOverride: (current) => ({
      agentsFiles: [
        ...current.agentsFiles,
        {
          path: `/virtual/studyforge-${role}.md`,
          content: `${roleContext}\n\nCurrent ${role}: ${ownerId}\nLearning set: ${root}`,
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

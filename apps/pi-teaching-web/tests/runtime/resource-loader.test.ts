import { expect, test } from 'bun:test';
import { createEventBus } from '@earendil-works/pi-coding-agent';
import { compileNodeContext } from '../../src/runtime/node-context';
import * as resourceLoader from '../../src/runtime/resource-loader';
import { renderCompiledNodeContext } from '../../src/runtime/node-context';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

type RoleSkillNames = (role: 'coach' | 'tutor') => string[];
type SkillNamesForScope = (scope: {
  nodeKind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
}) => string[];
type RolePromptFile = (scope: Parameters<SkillNamesForScope>[0]) => string;

function roleSkillNames(): RoleSkillNames {
  const value = (resourceLoader as Record<string, unknown>).roleSkillNames;
  expect(value).toBeFunction();
  return value as RoleSkillNames;
}

function skillNamesForScope(): SkillNamesForScope {
  const value = (resourceLoader as Record<string, unknown>).skillNamesForScope;
  expect(value).toBeFunction();
  return value as SkillNamesForScope;
}

function rolePromptFile(): RolePromptFile {
  const value = (resourceLoader as Record<string, unknown>).rolePromptFile;
  expect(value).toBeFunction();
  return value as RolePromptFile;
}

test('renders the compiled page table instead of duplicating role fragments', () => {
  const context = compileNodeContext(domainIntegrityFixtureRoot, {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  }, { sessionId: 'session-plan' });
  const rendered = renderCompiledNodeContext(context);

  expect(rendered).toContain('# StudyForge Node Context Frame');
  expect(rendered).toContain('## RESIDENT · Shared Math Teaching Core');
  expect(rendered).toContain('## FROZEN · Activation Snapshot');
  expect(rendered).toContain('## LOCAL · Current plan node');
  expect(rendered).toContain('Source: session:session-plan');
  expect(rendered.match(/# High-School Mathematics Teaching Core/g)).toHaveLength(1);
});

test('offers next-cycle planning only to Coach', () => {
  expect(roleSkillNames()('coach')).toEqual([
    'coach-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
  expect(roleSkillNames()('tutor')).toEqual([
    'tutor-lesson',
    'deep-workflow',
  ]);
});

test('loads Roadmap planning resources only for the Roadmap Coach scope', () => {
  expect(skillNamesForScope()({
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  })).toEqual([
    'roadmap-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
  expect(skillNamesForScope()({
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toEqual([
    'coach-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
});

test('selects one explicit Node Role Prompt by node kind', () => {
  expect(rolePromptFile()({
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  })).toEndWith('/resources/agents/roadmap-node.md');
  expect(rolePromptFile()({
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toEndWith('/resources/agents/plan-node.md');
  expect(rolePromptFile()({
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  })).toEndWith('/resources/agents/lesson-node.md');
});

test('compiles Teaching Core, Node Role, dynamic frame and presentation persona in order', async () => {
  const loader = await resourceLoader.createRoleResourceLoader(
    domainIntegrityFixtureRoot,
    {
      nodeKind: 'plan',
      nodeId: 'domain-integrity',
      nodePath: 'plans/domain-integrity.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    createEventBus(),
    { sessionId: 'session-current-plan' },
  );
  const files = loader.getAgentsFiles().agentsFiles.filter(
    (file) => file.path.startsWith('/virtual/studyforge-'),
  );
  expect(files.map((file) => file.path)).toEqual([
    '/virtual/studyforge-teaching-core.md',
    '/virtual/studyforge-plan-node.md',
    '/virtual/studyforge-node-frame.md',
    expect.stringMatching(/^\/virtual\/studyforge-persona-.+\.md$/),
  ]);
  expect(files[0]!.content).toContain('# High-School Mathematics Teaching Core');
  expect(files[1]!.content).toContain('# Plan Node');
  expect(files[2]!.content).toContain('# StudyForge Node Context Frame');
  expect(files[2]!.content).not.toContain('# High-School Mathematics Teaching Core');
  expect(files[2]!.content).not.toContain('# Plan Node');
  expect(files.at(-1)!.content).toContain('Presentation only');

  const serialized = files.map((file) => file.content).join('\n');
  expect(serialized).not.toContain('session-lesson-001');
  expect(serialized).not.toContain('session-lesson-002');
});

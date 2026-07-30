import { expect, test } from 'bun:test';
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

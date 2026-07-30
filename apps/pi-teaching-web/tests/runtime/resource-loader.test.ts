import { expect, test } from 'bun:test';
import * as resourceLoader from '../../src/runtime/resource-loader';

type ComposeRoleContext = (
  teachingCore: string,
  roleContext: string,
  ownerContext: string,
) => string;

type RoleSkillNames = (role: 'coach' | 'tutor') => string[];
type SkillNamesForScope = (scope: {
  nodeKind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
}) => string[];

function composeRoleContext(): ComposeRoleContext {
  const compose = (resourceLoader as Record<string, unknown>).composeRoleContext;
  expect(compose).toBeFunction();
  return compose as ComposeRoleContext;
}

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

test('composes the shared teaching core before role and owner context', () => {
  const context = composeRoleContext()('CORE', 'ROLE', 'OWNER');

  expect(context).toBe('CORE\n\nROLE\n\nOWNER');
  expect(context.match(/CORE/g)).toHaveLength(1);
  expect(context.match(/ROLE/g)).toHaveLength(1);
  expect(context.match(/OWNER/g)).toHaveLength(1);
});

test('drops empty context fragments without adding blank envelopes', () => {
  expect(composeRoleContext()(' CORE ', '', ' OWNER '))
    .toBe('CORE\n\nOWNER');
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

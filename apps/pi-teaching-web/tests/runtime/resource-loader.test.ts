import { expect, test } from 'bun:test';
import * as resourceLoader from '../../src/runtime/resource-loader';

type ComposeRoleContext = (
  teachingCore: string,
  roleContext: string,
  ownerContext: string,
) => string;

function composeRoleContext(): ComposeRoleContext {
  const compose = (resourceLoader as Record<string, unknown>).composeRoleContext;
  expect(compose).toBeFunction();
  return compose as ComposeRoleContext;
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

import { expect, test } from 'bun:test';
import { NodeAccessPolicy } from '../../src/runtime/node-access';
import { compileNodeContext } from '../../src/runtime/node-context';
import type { NodeSessionScope } from '../../src/runtime/session-scope';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

function planScope(): NodeSessionScope {
  return {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  };
}

function lessonScope(): NodeSessionScope {
  return {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  };
}

test('allows the current node and public assets but rejects branch and path escape reads', () => {
  const context = compileNodeContext(domainIntegrityFixtureRoot, planScope());
  const policy = new NodeAccessPolicy(domainIntegrityFixtureRoot, context);

  expect(policy.allows('plans/domain-integrity.md')).toBe(true);
  expect(policy.allows('LEARNING_GUIDE.md')).toBe(true);
  expect(policy.allows('cards/derivative/mst_p0032_ex22.card.yaml')).toBe(true);
  expect(policy.allows('card:cards/derivative/mst_p0032_ex22.card.yaml')).toBe(true);
  expect(policy.allows('plans/another-plan.md')).toBe(false);
  expect(policy.allows('lessons/lesson-002.md')).toBe(false);
  expect(policy.allows('memory/student-profile.md')).toBe(false);
  expect(policy.allows('../ROADMAP.md')).toBe(false);
  expect(policy.allows('/tmp/ROADMAP.md')).toBe(false);
});

test('allows only the current Session and explicit or scope-valid evidence handles', () => {
  const context = compileNodeContext(
    domainIntegrityFixtureRoot,
    lessonScope(),
    { sessionId: 'session-current-lesson' },
  );
  const policy = new NodeAccessPolicy(domainIntegrityFixtureRoot, context, {
    sessionId: 'session-current-lesson',
    sessionEntries: () => [{
      id: 'message-7',
      type: 'message',
      message: { role: 'user', content: 'CURRENT SESSION MESSAGE' },
    }],
  });

  expect(policy.allows('session:session-current-lesson')).toBe(true);
  expect(policy.allows('session:session-current-lesson#message:message-7')).toBe(true);
  expect(policy.allows('session:session-lesson-002')).toBe(false);
  expect(policy.allows('trace:trace-fixture-002')).toBe(true);
  expect(policy.allows('trace:trace-fixture-001')).toBe(false);
  expect(policy.allows('block:lesson-003/block-002')).toBe(true);
  expect(policy.allows('block:lesson-002/block-002')).toBe(false);

  const message = policy.resolve(
    'session:session-current-lesson#message:message-7',
  );
  expect(message).toMatchObject({
    valid: true,
    source: 'session:session-current-lesson#message:message-7',
  });
  expect(JSON.stringify(message)).toContain('CURRENT SESSION MESSAGE');
});

test('resolves legal sealed Handoffs and refuses an unrelated raw child document', () => {
  const context = compileNodeContext(domainIntegrityFixtureRoot, planScope());
  const policy = new NodeAccessPolicy(domainIntegrityFixtureRoot, context);

  expect(policy.allows('handoff:domain-integrity/handoff')).toBe(true);
  expect(policy.allows('handoff:lesson-001/handoff')).toBe(true);
  expect(policy.resolve('handoff:lesson-001/handoff')).toMatchObject({
    valid: true,
    source: 'handoff:lesson-001/handoff',
    kind: 'handoff',
  });
  expect(policy.resolve('lessons/lesson-001.md')).toMatchObject({
    valid: false,
    error: 'SOURCE_NOT_ALLOWED',
  });
});

test('tracks only explicitly recorded successful resolutions', () => {
  const context = compileNodeContext(domainIntegrityFixtureRoot, planScope());
  const policy = new NodeAccessPolicy(domainIntegrityFixtureRoot, context);
  const card = 'card:cards/derivative/mst_p0032_ex22.card.yaml';
  const resolution = policy.resolve(card);

  expect(resolution.valid).toBe(true);
  expect(policy.wasResolved(card)).toBe(false);
  policy.recordResolution(resolution);
  expect(policy.wasResolved(card)).toBe(true);

  const missing = policy.resolve('card:cards/derivative/missing.card.yaml');
  expect(missing.valid).toBe(false);
  policy.recordResolution(missing);
  expect(policy.wasResolved(missing.source)).toBe(false);
});

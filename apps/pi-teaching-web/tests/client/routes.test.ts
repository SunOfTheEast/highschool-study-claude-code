import { expect, test } from 'bun:test';
import { formatBrowserRoute, parseBrowserRoute } from '../../src/client/routes';
import type { HomeSnapshot } from '../../src/shared/contracts';
import { resolveContinuePath } from '../../src/shared/home';

test('round-trips home, Coach and Lesson routes', () => {
  const routes = [
    { kind: 'home' as const },
    { kind: 'roadmap' as const },
    { kind: 'coach' as const, planId: 'domain integrity' },
    { kind: 'lesson' as const, planId: '微积分 / 导数', lessonId: 'lesson 003' },
  ];
  for (const route of routes) {
    expect(parseBrowserRoute(formatBrowserRoute(route))).toEqual(route);
  }
});

test('rejects empty, extra, malformed and invalid URI paths', () => {
  for (const path of [
    '',
    '/plan/',
    '/plan/domain-integrity/extra',
    '/plan/domain-integrity/lesson/',
    '/plan/domain-integrity/lesson/lesson-1/extra',
    '/plan/%E0%A4%A',
    '/plan/domain-integrity/lesson/%E0%A4%A',
  ]) {
    expect(parseBrowserRoute(path)).toBeNull();
  }
});

test('does not accept trailing slashes or empty decoded IDs', () => {
  expect(parseBrowserRoute('/roadmap/')).toBeNull();
  expect(parseBrowserRoute('/plan/domain-integrity/')).toBeNull();
  expect(parseBrowserRoute('/plan/%20')).toBeNull();
  expect(parseBrowserRoute('/plan/domain-integrity/lesson/%20')).toBeNull();
});

test('restores only a route listed by the deterministic Home snapshot', () => {
  const home = {
    eligibleContinueRoutes: ['/plan/p1', '/plan/p1/lesson/l1'],
    continueTarget: { route: '/plan/p1/lesson/l1' },
  } as HomeSnapshot;

  expect(resolveContinuePath(home, '/plan/p1')).toBe('/plan/p1');
  expect(resolveContinuePath(home, '/plan/p1/lesson/closed')).toBe(
    '/plan/p1/lesson/l1',
  );
});

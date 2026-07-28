import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readHomeSnapshot } from '../../src/study/home';
import { resolveContinuePath } from '../../src/shared/home';
import { setFrontmatterField } from '../../src/study/write-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'home-snapshot-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

test('prioritizes active, paused and prepared Lessons before an unfinished Plan Coach', () => {
  const root = fixture();
  expect(readHomeSnapshot(root).continueTarget).toMatchObject({
    kind: 'lesson',
    lessonId: 'lesson-003',
    route: '/plan/domain-integrity/lesson/lesson-003',
  });

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'paused');
  expect(readHomeSnapshot(root).continueTarget.detail).toContain('暂停');

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'active');
  expect(readHomeSnapshot(root).continueTarget.detail).toContain('进行中');

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'abandoned');
  expect(readHomeSnapshot(root).continueTarget).toMatchObject({
    kind: 'coach',
    route: '/plan/domain-integrity',
  });
});

test('uses Roadmap setup when no Plan exists and next-stage planning when all are completed', () => {
  const empty = fixture();
  const roadmapPath = join(empty, 'ROADMAP.md');
  writeFileSync(
    roadmapPath,
    readFileSync(roadmapPath, 'utf8').replace(
      /## Plan Graph[\s\S]*?(?=\n## Change Log)/,
      '## Plan Graph\n\n（暂无）\n',
    ),
  );
  expect(readHomeSnapshot(empty).continueTarget).toMatchObject({
    kind: 'roadmap',
    route: '/roadmap',
  });
  expect(readHomeSnapshot(empty).continueTarget.title).toContain('第一个');

  const completed = fixture();
  setFrontmatterField(completed, 'plans/domain-integrity.md', 'status', 'completed');
  expect(readHomeSnapshot(completed).continueTarget).toMatchObject({
    kind: 'roadmap',
    route: '/roadmap',
  });
  expect(readHomeSnapshot(completed).continueTarget.title).toContain('下一阶段');
});

test('accepts a saved route only when it remains eligible', () => {
  const home = readHomeSnapshot(fixture());

  expect(resolveContinuePath(home, '/plan/domain-integrity')).toBe('/plan/domain-integrity');
  expect(resolveContinuePath(
    home,
    '/plan/domain-integrity/lesson/lesson-003',
  )).toBe('/plan/domain-integrity/lesson/lesson-003');
  expect(resolveContinuePath(
    home,
    '/plan/domain-integrity/lesson/lesson-001',
  )).toBe(home.continueTarget.route);
  expect(resolveContinuePath(home, '/roadmap')).toBe(home.continueTarget.route);
  expect(resolveContinuePath(home, '/plan/missing')).toBe(home.continueTarget.route);
});

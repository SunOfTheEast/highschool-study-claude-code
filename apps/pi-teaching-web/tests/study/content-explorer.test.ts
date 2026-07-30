import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendTrace } from 'highschool-study-markdown/study-domain';
import { searchStudentContent } from '../../src/study/content-explorer';
import { setBlockStatus, setFrontmatterField } from '../../src/study/write-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'content-explorer-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

test('limits an active Tutor to revealed assets and current-Lesson Trace permissions', () => {
  const root = fixture();
  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'active');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-001', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-002', 'active');

  const visible = searchStudentContent(root, {
    query: 'mst_p0032_ex22',
    sessionKey: 'tutor:lesson-003',
    limit: 20,
  });
  expect(visible.hits[0]).toMatchObject({
    kind: 'card',
    source: 'cards/derivative/mst_p0032_ex22.card.yaml',
    matchedBy: 'asset',
  });

  const pending = searchStudentContent(root, {
    query: 'mst_p0030_ex16',
    sessionKey: 'tutor:lesson-003',
    limit: 20,
  });
  expect(pending.hits).toEqual([]);
  expect(JSON.stringify(visible)).not.toContain('mst_p0030_ex16');
});

test('maps Trace matches back to a real card with complete active history only', () => {
  const root = fixture();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: 'step_4',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: 'unique-trace-term corrected observation',
    supersedes: 'trace-fixture-001',
    methods: null,
  }, () => new Date('2026-07-28T01:00:00Z'));

  const result = searchStudentContent(root, {
    query: 'unique-trace-term',
    sessionKey: 'tutor:lesson-001',
    limit: 20,
  });

  expect(result.hits[0]).toMatchObject({
    kind: 'card',
    matchedBy: 'trace',
    source: 'cards/derivative/mst_p0019_ex11.card.yaml',
  });
  expect(result.hits[0]?.traceHistory).toHaveLength(1);
  expect(JSON.stringify(result)).toContain('corrected observation');
  expect(JSON.stringify(result)).not.toContain('初答遗漏');
});

test('lets a Plan Coach and closed Replay search the full safe asset set', () => {
  const root = fixture();
  mkdirSync(join(root, 'materials'), { recursive: true });
  writeFileSync(
    join(root, 'materials', 'domain-note.md'),
    '# 定义域材料\n\nunique-material-term 只含学生公开说明。',
  );

  const coach = searchStudentContent(root, {
    query: 'unique-material-term',
    sessionKey: 'coach:domain-integrity',
    limit: 20,
  });
  expect(coach.hits[0]).toMatchObject({
    kind: 'material',
    source: 'materials/domain-note.md',
  });
  expect(coach.hits[0]?.preview).toContain('unique-material-term');

  const replay = searchStudentContent(root, {
    query: 'mst_p0030_ex16',
    sessionKey: 'tutor:lesson-001',
    limit: 20,
  });
  expect(replay.hits[0]).toMatchObject({
    kind: 'card',
    source: 'cards/derivative/mst_p0030_ex16.card.yaml',
  });

  expect(() => searchStudentContent(root, {
    query: '定义域',
    sessionKey: 'coach:@roadmap',
    limit: 20,
  })).toThrow('CONTENT_SEARCH_ROADMAP_UNAVAILABLE');
});

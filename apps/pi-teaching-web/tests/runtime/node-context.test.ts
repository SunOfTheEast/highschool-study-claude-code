import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderProfileDocument } from '../../src/memory-review/profile-document';
import {
  compileNodeContext,
  type CompiledNodeContext,
} from '../../src/runtime/node-context';
import {
  ROADMAP_COACH_SCOPE,
  type NodeSessionScope,
} from '../../src/runtime/session-scope';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function planScope(nodeId = 'domain-integrity'): NodeSessionScope {
  return {
    nodeKind: 'plan',
    nodeId,
    nodePath: `plans/${nodeId}.md`,
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  };
}

function lessonScope(nodeId = 'lesson-003'): NodeSessionScope {
  return {
    nodeKind: 'lesson',
    nodeId,
    nodePath: `lessons/${nodeId}.md`,
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  };
}

function pageKinds(context: CompiledNodeContext): string[] {
  return context.pages.map((page) => page.kind);
}

test('compiles Roadmap, Plan and Lesson page tables without sibling node files', () => {
  const roadmap = compileNodeContext(domainIntegrityFixtureRoot, ROADMAP_COACH_SCOPE);
  expect(pageKinds(roadmap)).toEqual(expect.arrayContaining([
    'resident',
    'local',
    'index',
  ]));
  expect(roadmap.allowlist).toContain('ROADMAP.md');

  const plan = compileNodeContext(domainIntegrityFixtureRoot, planScope());
  expect(pageKinds(plan)).toEqual(expect.arrayContaining([
    'resident',
    'frozen',
    'local',
    'index',
  ]));
  expect(plan.allowlist).toContain('plans/domain-integrity.md');
  expect(plan.allowlist).not.toContain('plans/another-plan.md');

  const lesson = compileNodeContext(
    domainIntegrityFixtureRoot,
    lessonScope(),
    { sessionId: 'session-current-lesson' },
  );
  expect(pageKinds(lesson)).toEqual(expect.arrayContaining([
    'resident',
    'frozen',
    'local',
    'index',
  ]));
  expect(lesson.allowlist).toContain('lessons/lesson-003.md');
  expect(lesson.allowlist).not.toContain('lessons/lesson-002.md');
  expect(lesson.pages).toContainEqual(expect.objectContaining({
    kind: 'local',
    source: 'session:session-current-lesson',
    content: null,
  }));
});

test('injects only profile entries explicitly selected by the activation snapshot', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-node-context-memory-'));
  temporaryRoots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });

  const profilePath = join(root, 'memory/student-profile.md');
  writeFileSync(
    profilePath,
    renderProfileDocument(readFileSync(profilePath, 'utf8'), 'student', [
      {
        id: 'S3',
        content: '先独立尝试，再决定是否需要提示。',
        scope: '当前 Roadmap',
        sources: ['lessons/lesson-002.md#lesson-summary'],
        rationale: '学生已确认。',
        counterEvidence: '暂无。',
      },
      {
        id: 'S4',
        content: '总是先看完整答案。',
        scope: '当前 Roadmap',
        sources: ['lessons/lesson-001.md#lesson-summary'],
        rationale: '旧记录。',
        counterEvidence: '已有反证。',
      },
    ]),
  );
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace(
      '- card:cards/derivative/mst_p0030_ex16.card.yaml\n\n### Content Boundary',
      '- card:cards/derivative/mst_p0030_ex16.card.yaml\n'
        + '- memory:student/S3\n\n### Content Boundary',
    ),
  );

  const context = compileNodeContext(root, lessonScope());
  const resident = context.pages
    .filter((page) => page.kind === 'resident')
    .map((page) => page.content)
    .join('\n');
  expect(resident).toContain('先独立尝试，再决定是否需要提示。');
  expect(resident).not.toContain('总是先看完整答案。');
  expect(context.resolvableSources).toContain('memory:student/S3');
  expect(context.resolvableSources).not.toContain('memory:student/S4');
  expect(context.allowlist).not.toContain('memory/student-profile.md');
});

test('indexes sealed child Handoffs without copying parent or sibling Session messages', () => {
  const context = compileNodeContext(
    domainIntegrityFixtureRoot,
    planScope(),
    { sessionId: 'session-current-plan' },
  );
  const serialized = JSON.stringify(context.pages);

  expect(context.resolvableSources).toContain('handoff:lesson-001/handoff');
  expect(context.resolvableSources).toContain('handoff:lesson-002/handoff');
  expect(serialized).not.toContain('session-lesson-001');
  expect(serialized).not.toContain('session-lesson-002');
  expect(serialized).not.toContain('PARENT RAW SESSION MESSAGE');
  expect(serialized).not.toContain('SIBLING RAW SESSION MESSAGE');
});

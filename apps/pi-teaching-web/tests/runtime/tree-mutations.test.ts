import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  materializeChild,
  updateParentDocument,
  type TreeMutationFileOps,
} from '../../src/runtime/tree-mutations';
import {
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
} from '../../src/study/lesson-blueprint';
import { validatePreparedLessonSource } from '../../src/study/validate-prepared-lesson';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'tree-mutations-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

const candidate = {
  publicPurpose: '检查定义域能否迁移到新的题型外壳。',
  after: 'lesson-candidate-003',
  dependsOn: ['lesson-candidate-003'],
  considerWhen: '第三节课完成后仍需迁移检查。',
  sources: ['trace:trace-fixture-002'],
  privateNote: '只改变题型外壳。',
};

test('adds, revises and removes only candidate entries with runtime handles', () => {
  const root = fixture();
  const added = updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{ action: 'add', candidate }],
    sections: {},
    frontmatter: {},
  });
  expect(added.entries.at(-1)).toMatchObject({
    state: 'candidate',
    handle: 'lesson-candidate-004',
  });

  const revised = updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{
      action: 'revise',
      handle: 'lesson-candidate-004',
      candidate: { ...candidate, publicPurpose: '迁移到参数不等式。' },
    }],
    sections: {},
    frontmatter: {},
  });
  expect(revised.entries.at(-1)).toMatchObject({
    publicPurpose: '迁移到参数不等式。',
  });

  expect(() => updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{
      action: 'remove',
      handle: 'lesson-candidate-003',
    }],
    sections: {},
    frontmatter: {},
  })).toThrow('NODE_TREE_MATERIALIZED_IMMUTABLE');

  const removed = updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{
      action: 'remove',
      handle: 'lesson-candidate-004',
    }],
    sections: {},
    frontmatter: {},
  });
  expect(removed.entries).toHaveLength(3);
});

function blueprint(): LessonBlueprint {
  return {
    title: '迁移检查',
    publicPurpose: candidate.publicPurpose,
    capabilityTarget: '在新外壳中主动使用定义域。',
    primaryTemplate: 'assessment',
    templateReason: '需要一条新的独立证据。',
    adjustments: [],
    activation: {
      parentSources: ['trace:trace-fixture-002'],
      selectedMemory: [],
      contentBoundary: ['首次尝试前不提示方法。'],
      adaptation: {
        workingJudgment: '定义域连续性已有正证据，迁移尚未确认。',
        sources: ['trace:trace-fixture-002'],
        designConsequence: '只改变题型外壳。',
        reviseIf: '学生无法识别新题的合法域。',
      },
    },
    cards: [{
      alias: 'Q-DOMAIN-EX22',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      role: '迁移检查',
    }],
    sources: [],
    blocks: [{
      localAlias: 'attempt',
      kind: 'problem',
      required: true,
      dependsOn: [],
      uses: ['Q-DOMAIN-EX22'],
      studentView: '请独立完成题卡。',
      teacherControl: '先冻结首次尝试。',
    }],
  };
}

test('materializes one candidate into a globally allocated prepared child', () => {
  const root = fixture();
  updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{ action: 'add', candidate }],
    sections: {},
    frontmatter: {},
  });
  const lesson = blueprint();
  const result = materializeChild(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateHandle: 'lesson-candidate-004',
    title: lesson.title,
    render: ({ childId, childPath }) => {
      const context = {
        planId: 'domain-integrity',
        planPath: 'plans/domain-integrity.md',
        planTitle: '定义域完整性的系统加固',
        lessonId: childId,
        lessonPath: childPath,
      };
      validateLessonBlueprint(root, context, lesson);
      return renderPreparedLesson(context, lesson);
    },
    validate: (childPath, source) => (
      validatePreparedLessonSource(root, childPath, source)
    ),
  });

  expect(result).toEqual({
    handle: 'lesson-candidate-004',
    childId: 'lesson-004',
    childPath: 'lessons/lesson-004.md',
  });
  expect(existsSync(join(root, result.childPath))).toBe(true);
  expect(readFileSync(
    join(root, 'plans/domain-integrity.md'),
    'utf8',
  )).toContain('### Child lesson-candidate-004');
});

test('rolls back both files when the parent install fails', () => {
  const root = fixture();
  updateParentDocument(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{ action: 'add', candidate }],
    sections: {},
    frontmatter: {},
  });
  const parentPath = join(root, 'plans/domain-integrity.md');
  const before = readFileSync(parentPath, 'utf8');
  let parentInstallAttempted = false;
  const fileOps: TreeMutationFileOps = {
    exists: existsSync,
    read: (path) => readFileSync(path, 'utf8'),
    write: writeFileSync,
    remove: (path) => rmSync(path, { force: true }),
    rename: (from, to) => {
      if (
        to === parentPath
        && from.includes('.studyforge-materialize')
      ) {
        parentInstallAttempted = true;
        throw new Error('SIMULATED_PARENT_INSTALL_FAILURE');
      }
      renameSync(from, to);
    },
  };
  const lesson = blueprint();
  expect(() => materializeChild(root, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateHandle: 'lesson-candidate-004',
    title: lesson.title,
    render: ({ childId, childPath }) => renderPreparedLesson({
      planId: 'domain-integrity',
      planPath: 'plans/domain-integrity.md',
      planTitle: '定义域完整性的系统加固',
      lessonId: childId,
      lessonPath: childPath,
    }, lesson),
    validate: (childPath, source) => (
      validatePreparedLessonSource(root, childPath, source)
    ),
    fileOps,
  })).toThrow('SIMULATED_PARENT_INSTALL_FAILURE');
  expect(parentInstallAttempted).toBe(true);
  expect(readFileSync(parentPath, 'utf8')).toBe(before);
  expect(existsSync(join(root, 'lessons/lesson-004.md'))).toBe(false);
});

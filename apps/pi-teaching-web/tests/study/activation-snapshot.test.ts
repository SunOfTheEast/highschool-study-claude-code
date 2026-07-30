import { expect, test } from 'bun:test';
import {
  parseActivationSnapshot,
  renderPreparedActivationSnapshot,
  sealActivationSnapshot,
  validateActivationSnapshotDraft,
  type ActivationSnapshotDraft,
} from '../../src/study/activation-snapshot';

const draft = {
  parentSources: ['claim:lesson-002/handoff#learner-c1'],
  selectedMemory: ['memory:student/S3'],
  contentBoundary: ['课前不公开候选方法名。'],
  adaptation: {
    workingJudgment: '学生能提出路线，但比较代价时仍会犹豫。',
    sources: ['claim:lesson-002/handoff#learner-c1'],
    designConsequence: '保持题型，只拉大两条路线的成本差。',
    reviseIf: '学生在陌生题型中无需比较即可稳定选路。',
  },
} satisfies ActivationSnapshotDraft;

test('renders and parses one prepared snapshot without copying profile text', () => {
  validateActivationSnapshotDraft(draft);
  const source = renderPreparedActivationSnapshot('plan:plan-001', draft);
  expect(source).toContain('- Parent: plan:plan-001');
  expect(source).toContain('- Activated at: pending');
  expect(source).toContain('- memory:student/S3');
  expect(source).not.toContain('S3 的画像全文');
  expect(parseActivationSnapshot(source)).toEqual({
    parent: 'plan:plan-001',
    activatedAt: 'pending',
    draft,
  });
});

test('requires a complete source-grounded Adaptation Brief', () => {
  for (const invalid of [
    { ...draft, adaptation: { ...draft.adaptation, workingJudgment: '' } },
    { ...draft, adaptation: { ...draft.adaptation, sources: [] } },
    { ...draft, adaptation: { ...draft.adaptation, designConsequence: '' } },
    { ...draft, adaptation: { ...draft.adaptation, reviseIf: '' } },
    { ...draft, parentSources: ['not-a-source'] },
    { ...draft, selectedMemory: ['学生喜欢先独立尝试。'] },
    { ...draft, contentBoundary: [] },
  ]) {
    expect(() => validateActivationSnapshotDraft(invalid))
      .toThrow('ACTIVATION_SNAPSHOT_INVALID');
  }
});

test('requires Adaptation evidence to be selected into the snapshot', () => {
  expect(() => validateActivationSnapshotDraft({
    ...draft,
    adaptation: {
      ...draft.adaptation,
      sources: ['trace:trace-not-selected'],
    },
  })).toThrow('ACTIVATION_SNAPSHOT_INVALID');
});

test('seals pending activation exactly once with runtime time', () => {
  const prepared = `# Lesson\n\n${renderPreparedActivationSnapshot(
    'plan:plan-001',
    draft,
  )}\n## Blocks\n`;
  const sealed = sealActivationSnapshot(
    prepared,
    new Date('2026-08-04T12:32:00.000Z'),
  );
  expect(sealed).toContain('- Activated at: 2026-08-04T12:32:00.000Z');
  expect(parseActivationSnapshot(sealed)).toMatchObject({
    parent: 'plan:plan-001',
    activatedAt: '2026-08-04T12:32:00.000Z',
  });
  expect(() => sealActivationSnapshot(
    sealed,
    new Date('2026-08-04T12:33:00.000Z'),
  )).toThrow('ACTIVATION_SNAPSHOT_ALREADY_SEALED');
});

test('rejects malformed parents, duplicate sources, and multiple snapshots', () => {
  expect(() => renderPreparedActivationSnapshot('lesson:lesson-001', draft))
    .toThrow('ACTIVATION_PARENT_INVALID');
  expect(() => validateActivationSnapshotDraft({
    ...draft,
    selectedMemory: ['memory:student/S3', 'memory:student/S3'],
  })).toThrow('ACTIVATION_SNAPSHOT_INVALID');
  const section = renderPreparedActivationSnapshot('plan:plan-001', draft);
  expect(() => parseActivationSnapshot(`${section}\n${section}`))
    .toThrow('ACTIVATION_SNAPSHOT_FORMAT_INVALID');
});

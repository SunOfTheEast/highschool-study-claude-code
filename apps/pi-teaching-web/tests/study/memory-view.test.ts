import { afterEach, expect, test } from 'bun:test';
import {
  projectHandoffFindings,
  projectObjectionTarget,
  readMemoryView,
} from '../../src/study/views/memory-view';
import { fakeSessionEvidenceReader } from '../support/session-evidence';
import {
  copyViewLearningSet,
  installViewMemoryScenario,
  removeViewLearningSets,
} from '../support/view-learning-set';

const query = {
  planId: 'domain-integrity',
  lessonId: null,
  methodName: null,
  cardPath: null,
  evidenceSource: null,
  topicId: null,
  timeRange: 'plan' as const,
};

afterEach(removeViewLearningSets);

test('separates confirmed memory, learner findings and open questions', () => {
  const root = copyViewLearningSet();
  installViewMemoryScenario(root);
  const view = readMemoryView(root, query, fakeSessionEvidenceReader());
  expect(view.confirmed.some((item) => item.id === 'S1')).toBe(true);
  expect(view.confirmed.some((item) => item.id === 'T1')).toBe(true);
  expect(view.stageFindings.every((item) => item.statement.length > 0)).toBe(true);
  expect(view.stageFindings.some((item) => (
    item.statement.includes('定义域')
  ))).toBe(true);
  expect(view.openQuestions.every((item) => item.question.length > 0)).toBe(true);
});

test('does not expose raw Teaching Claims or private runtime text', () => {
  const value = JSON.stringify(projectHandoffFindings([{
    id: 'lesson-001/handoff',
    level: 'lesson',
    state: 'active',
    learnerClaims: [{
      id: 'C1',
      statement: '学生会先比较路线代价。',
      scope: '导数综合题。',
      boundary: '仅在综合题中观察到。',
      nextUse: '下一课继续检查。',
      sources: ['trace:trace-active'],
    }],
    teachingClaims: [{
      id: 'T1',
      statement: 'PRIVATE_TEACHING_CLAIM_TEXT',
      scope: '下一节课。',
      boundary: 'SYSTEM_PROMPT_SENTINEL',
      nextUse: 'SUBAGENT_RAW_SENTINEL',
      sources: ['trace:trace-active'],
    }],
    openQuestions: [{
      id: 'Q1',
      question: '换题型后能否继续选路？',
      nextCheck: '用一题迁移题检查。',
      sources: ['trace:trace-active'],
    }],
    sourceIndex: ['trace:trace-active'],
  }]));
  expect(value).not.toContain('PRIVATE_TEACHING_CLAIM_TEXT');
  expect(value).not.toContain('SYSTEM_PROMPT_SENTINEL');
  expect(value).not.toContain('SUBAGENT_RAW_SENTINEL');
  expect(value).toContain('学生会先比较路线代价');
  expect(value).toContain('换题型后能否继续选路');
});

test('keeps a source-only Handoff as an index without inventing a finding', () => {
  const projected = projectHandoffFindings([{
    id: 'lesson-004/handoff',
    level: 'lesson',
    state: 'active',
    learnerClaims: [],
    teachingClaims: [],
    openQuestions: [],
    sourceIndex: ['trace:trace-source-only'],
  }]);
  expect(projected.stageFindings).toEqual([]);
  expect(projected.openQuestions).toEqual([]);
  expect(projected.sourceIndexes).toEqual([{
    id: 'lesson-004/handoff#sources',
    level: 'lesson',
    label: '本阶段只保留了来源记录',
    sources: ['trace:trace-source-only'],
    state: 'active',
  }]);
});

test('preserves invalidated lineage but excludes it from current findings', () => {
  const root = copyViewLearningSet();
  const scenario = installViewMemoryScenario(root);
  const view = readMemoryView(
    root,
    { ...query, evidenceSource: scenario.invalidatedSource },
    fakeSessionEvidenceReader(),
  );
  expect(view.stageFindings.some((item) => (
    item.statement === '学生总会遗漏定义域。'
  ))).toBe(false);
  expect(view.lineage?.state).toBe('invalidated');
  expect(view.detail?.state).toBe('invalidated');
});

test('routes objections to a writable Plan Coach or falls back to Roadmap Coach', () => {
  const source = 'trace:trace-active';
  expect(projectObjectionTarget(source, {
    planId: 'domain-integrity',
    planWritable: true,
  })).toMatchObject({
    route: '/course/plan/domain-integrity',
    sessionKey: 'coach:domain-integrity',
    source,
  });

  expect(projectObjectionTarget(source, {
    planId: 'domain-integrity',
    planWritable: false,
  })).toMatchObject({
    route: '/course',
    sessionKey: 'coach:@roadmap',
  });
});

test('shows only a safe generic label for selected Teaching Claim lineage', () => {
  const root = copyViewLearningSet();
  installViewMemoryScenario(root);
  const view = readMemoryView(root, {
    ...query,
    evidenceSource: 'claim:domain-integrity/handoff#teaching-t1',
  }, fakeSessionEvidenceReader());
  const serialized = JSON.stringify(view);
  expect(view.detail?.summary).toBe('这条阶段记录曾影响教学安排。');
  expect(serialized).not.toContain('PRIVATE_PLAN_TEACHING_CLAIM');
  expect(serialized).not.toContain('SYSTEM_PROMPT_SENTINEL');
  expect(serialized).not.toContain('SUBAGENT_RAW_SENTINEL');
});

test('projects Roadmap checkpoints only in the all-history range', () => {
  const root = copyViewLearningSet();
  installViewMemoryScenario(root);
  const all = readMemoryView(root, {
    ...query,
    timeRange: 'all',
  }, fakeSessionEvidenceReader());
  expect(all.stageFindings.some((item) => (
    item.level === 'roadmap'
    && item.statement === '学生已进入跨结构核验阶段。'
  ))).toBe(true);
  const selected = readMemoryView(root, {
    ...query,
    timeRange: 'all',
    evidenceSource: 'claim:checkpoint-001/handoff#learner-c1',
  }, fakeSessionEvidenceReader());
  expect(selected.lineage?.state).toBe('active');
  expect(selected.detail?.summary).toBe('学生已进入跨结构核验阶段。');

  const plan = readMemoryView(root, query, fakeSessionEvidenceReader());
  expect(plan.stageFindings.some((item) => item.level === 'roadmap')).toBe(false);
});

import { expect, test } from 'bun:test';
import { Check } from 'typebox/value';
import { createActivationInputSchema } from '../../src/runtime/activation-tool-schema';

function input(parentSource: string, selectedMemory: string[] = []) {
  return {
    parentSources: [parentSource],
    selectedMemory,
    contentBoundary: ['不公开私有解法。'],
    adaptation: {
      workingJudgment: '当前瓶颈是路线比较。',
      sources: [parentSource],
      designConsequence: '先比较路线代价。',
      reviseIf: '学生已经能稳定选路。',
    },
  };
}

test('limits Activation evidence to canonical handles in the current Node Frame', () => {
  const schema = createActivationInputSchema([
    'session:roadmap-session',
    'claim:plan-001/handoff#learner-c1',
    'memory:student/S1',
    'ROADMAP.md',
    'runtime:node-scope',
  ]);

  expect(Check(schema, input('session:roadmap-session'))).toBeTrue();
  expect(Check(schema, input(
    'claim:plan-001/handoff#learner-c1',
    ['memory:student/S1'],
  ))).toBeTrue();
  expect(Check(schema, input('ROADMAP.md'))).toBeFalse();
  expect(Check(schema, input('plan-candidate-001'))).toBeFalse();
  expect(Check(schema, input('session:invented-session'))).toBeFalse();
  expect(Check(schema, input(
    'session:roadmap-session',
    ['memory:student/invented'],
  ))).toBeFalse();
});

test('requires an empty selectedMemory list when the Node Frame has no memory handle', () => {
  const schema = createActivationInputSchema(['session:roadmap-session']);
  expect(Check(schema, input('session:roadmap-session'))).toBeTrue();
  expect(Check(schema, input(
    'session:roadmap-session',
    ['memory:student/S1'],
  ))).toBeFalse();
});

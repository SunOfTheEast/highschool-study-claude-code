import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LearningSetSnapshot } from '../../src/shared/contracts';
import { LearningSetHome } from '../../src/client/components/LearningSetHome';

function learningSet(learningPrinciples: string): LearningSetSnapshot {
  return {
    title: '测试学习集',
    overview: '学习集概述',
    learningPrinciples,
    goal: '学习目标',
    plans: [],
  };
}

test('renders public learning principles on the learning-set home', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('PUBLIC LEARNING PRINCIPLE')}
      onOpen={() => {}}
    />,
  );

  expect(html).toContain('研习要领');
  expect(html).toContain('PUBLIC LEARNING PRINCIPLE');
});

test('omits the learning-principles section when the guide is absent', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome value={learningSet('')} onOpen={() => {}} />,
  );

  expect(html).not.toContain('研习要领');
});

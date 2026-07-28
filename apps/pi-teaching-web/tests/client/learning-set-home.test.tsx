import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LearningSetSnapshot } from '../../src/shared/contracts';
import { LearningSetHome } from '../../src/client/components/LearningSetHome';

function learningSet(
  learningPrinciples: string,
  plans: LearningSetSnapshot['plans'] = [],
): LearningSetSnapshot {
  return {
    title: '测试学习集',
    overview: '学习集概述',
    learningPrinciples,
    goal: '学习目标',
    plans,
  };
}

test('renders public learning principles on the learning-set home', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('PUBLIC LEARNING PRINCIPLE')}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).toContain('研习要领');
  expect(html).toContain('PUBLIC LEARNING PRINCIPLE');
});

test('omits the learning-principles section when the guide is absent', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('')}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).not.toContain('研习要领');
});

test('promotes Roadmap planning when no Plan exists', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('')}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).toContain('建立第一个学习周期');
  expect(html).toContain('roadmap-entry primary');
  expect(html).not.toContain('选择当前学习周期');
});

test('keeps Roadmap planning quiet after Plans exist', () => {
  const html = renderToStaticMarkup(
    <LearningSetHome
      value={learningSet('', [{
        id: 'p1',
        title: '现有周期',
        path: 'plans/p1.md',
        status: 'active',
        goal: '目标',
        capabilityStandard: '标准',
        planningBasis: '依据',
        currentPosition: '当前位置',
        nextLessonCandidate: '下一步',
        planSummary: '摘要',
      }])}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );

  expect(html).toContain('现有周期');
  expect(html).toContain('总览与规划');
  expect(html).toContain('roadmap-entry quiet');
  expect(html).toContain('选择当前学习周期');
});

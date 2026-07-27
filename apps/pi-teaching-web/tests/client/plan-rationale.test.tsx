import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanRationale } from '../../src/client/components/PlanRationale';

test('shows a compact plan rationale only when Planning Basis exists', () => {
  const visible = renderToStaticMarkup(
    <PlanRationale value={'当前判断：需要练迁移。\n\n来源：[Lesson](../lessons/l.md#lesson-summary)'} />,
  );
  expect(visible).toContain('为什么这样安排');
  expect(visible).toContain('需要练迁移');
  expect(visible).toContain('../lessons/l.md#lesson-summary');
  expect(renderToStaticMarkup(<PlanRationale value="  " />)).toBe('');
});

import { expect, test } from 'bun:test';
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LessonReadyNotice } from '../../src/shared/contracts';
import { LessonReadyCard } from '../../src/client/components/LessonReadyCard';

const notice: LessonReadyNotice = {
  lessonId: 'lesson-007',
  lessonPath: 'lessons/lesson-007.md',
  publicTitle: '下一节课堂',
  publicPurpose: '练习公开的路线比较能力。',
  blockCount: 5,
  blockKinds: ['dialogue', 'problem', 'material', 'reflection'],
  sourceNumbers: ['source-17', 'source-32'],
};

function buttons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return [
    ...(element.type === 'button' ? [element] : []),
    ...buttons(element.props.children),
  ];
}

test('renders only the safe lesson shape and status-aware primary action', () => {
  const html = renderToStaticMarkup(
    <LessonReadyCard
      value={notice}
      status="prepared"
      onPrimary={() => {}}
      onDiscuss={() => {}}
    />,
  );

  expect(html).toContain('这一节已经准备好');
  expect(html).toContain('下一节课堂');
  expect(html).toContain('练习公开的路线比较能力');
  expect(html).toContain('共 5 个课堂环节');
  expect(html).toContain('讨论');
  expect(html).toContain('尝试');
  expect(html).toContain('材料');
  expect(html).toContain('小结');
  expect(html).toContain('具体题目会由课堂导师逐步展开');
  expect(html).toContain('source-17');
  expect(html).toContain('开始上课');
  expect(html).not.toContain('lesson-007');
  expect(html).not.toContain('lessons/lesson-007.md');

  const continued = renderToStaticMarkup(
    <LessonReadyCard
      value={notice}
      status="paused"
      onPrimary={() => {}}
      onDiscuss={() => {}}
    />,
  );
  expect(continued).toContain('继续课堂');
});

test('routes primary and discussion actions without exposing lesson content', () => {
  const primary: string[] = [];
  let discussed = 0;
  const tree = LessonReadyCard({
    value: notice,
    status: 'closed',
    onPrimary: (lessonId) => primary.push(lessonId),
    onDiscuss: () => { discussed += 1; },
  });
  const actions = buttons(tree);
  expect(actions).toHaveLength(2);

  (actions[0]!.props as { onClick(): void }).onClick();
  (actions[1]!.props as { onClick(): void }).onClick();
  expect(primary).toEqual(['lesson-007']);
  expect(discussed).toBe(1);
  expect(renderToStaticMarkup(tree)).toContain('查看记录');
});

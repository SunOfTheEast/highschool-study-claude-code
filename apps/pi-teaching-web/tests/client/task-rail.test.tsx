import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskRail } from '../../src/client/components/TaskRail';

test('renders dependencies and budgets without child output', () => {
  const html = renderToStaticMarkup(<TaskRail workflows={[{
    id: 'wf-1',
    goal: '备课会诊',
    mode: 'deep',
    status: 'proposed',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    tasks: [
      {
        id: 'evidence',
        label: '整理证据',
        role: '证据分析员',
        dependsOn: [],
        status: 'queued',
        sourceCount: 4,
        progress: '等待前序任务',
      },
      {
        id: 'design',
        label: '设计课堂',
        role: '课堂设计员',
        dependsOn: ['evidence'],
        status: 'queued',
        sourceCount: 0,
        progress: '等待前序任务',
      },
    ],
  }]} onAction={async () => {}} />);
  expect(html).toContain('备课会诊');
  expect(html).toContain('20,000 Token');
  expect(html).toContain('确认运行');
  expect(html).toContain('依赖 evidence');
  expect(html).not.toContain('findings');
});

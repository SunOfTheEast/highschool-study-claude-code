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
        status: 'completed',
        sourceCount: 4,
        cardCount: 2,
        progress: '分析完成',
        durationMs: 0,
        tokens: 0,
        toolCount: 0,
        currentActivity: '分析完成',
      },
      {
        id: 'design',
        label: '设计课堂',
        role: '课堂设计员',
        dependsOn: ['evidence'],
        status: 'queued',
        sourceCount: 0,
        cardCount: 0,
        progress: '等待前序任务',
        durationMs: 0,
        tokens: 0,
        toolCount: 0,
        currentActivity: '等待前序任务',
      },
    ],
  }]} onAction={async () => {}} />);
  expect(html).toContain('备课会诊');
  expect(html).toContain('20,000 Token');
  expect(html).toContain('确认运行');
  expect(html).toContain('依赖 evidence');
  expect(html).toContain('2 张题卡');
  expect(html).toContain('4 个来源');
  expect(html).not.toContain('findings');
  expect(html).not.toContain('隐藏题卡');
});

test('renders live Evidence Scout telemetry without pretending sources are complete', () => {
  const html = renderToStaticMarkup(<TaskRail workflows={[{
    id: 'wf-live',
    goal: '检索跨课证据',
    mode: 'quick',
    status: 'running',
    maxConcurrency: 1,
    tokenLimit: 50_000,
    timeoutMs: 180_000,
    tasks: [{
      id: 'evidence',
      label: '检索题卡证据',
      role: 'Evidence Scout',
      dependsOn: [],
      status: 'running',
      sourceCount: 0,
      cardCount: 0,
      progress: '正在分析',
      durationMs: 42_000,
      tokens: 3_777,
      toolCount: 4,
      currentActivity: '正在检索题卡',
    }],
  }]} onAction={async () => {}} />);

  expect(html).toContain('正在检索题卡');
  expect(html).toContain('42 / 180 秒');
  expect(html).toContain('3,777 / 50,000 Token');
  expect(html).toContain('4 次工具');
  expect(html).toContain('来源完成后汇总');
  expect(html).not.toContain('0 个来源');
});

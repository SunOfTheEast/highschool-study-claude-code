import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const protocolRoot = join(import.meta.dir, '../../validation/m1a');

function read(name: string): string {
  return readFileSync(join(protocolRoot, name), 'utf8');
}

test('freezes baselines, scope, student isolation, and an ordinary-language opener', () => {
  const protocol = read('student-protocol.md');

  expect(protocol).toContain('M0：`fed2a01`');
  expect(protocol).toContain('M1a：`17b7e9b`');
  expect(protocol).toContain('M1b 不在本轮验收范围内');
  expect(protocol).toContain('只能读取当前 Arm 的学生可见对话');
  expect(protocol).toContain('不得读取 Teacher Control、CoT、memory/、课程 Markdown、答案或另一 Arm 的 transcript');

  const opener = /<!-- opener:start -->\s*```text\s*([\s\S]*?)\s*```\s*<!-- opener:end -->/
    .exec(protocol)?.[1];
  expect(opener).toBe('简单的还行，复杂一点我就乱了，学过的方法也想不起来。我也不知道该怎么学。');
  for (const forbidden of ['同构', '结构识别', '能力假设', '对象记忆', '学习痕迹']) {
    expect(opener).not.toContain(forbidden);
  }
});

test('ledger freezes evidence-bound cognitive state without scripting a stumble Lesson', () => {
  const ledger = read('state-ledger-template.md');

  expect(ledger).toContain('stable');
  expect(ledger).toContain('fragile');
  expect(ledger).toContain('unseen');
  expect(ledger).toContain('学生可见证据');
  expect(ledger).toContain('听懂或在支架下完成只能进入 `fragile`');
  expect(ledger).toContain('不预言哪一节 Lesson 必须出现失败');
});

test('directed cases cover all seven approved bearing mechanisms', () => {
  const cases = read('directed-cases.md');

  for (const id of ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-06', 'DC-07']) {
    expect(cases).toContain(`## ${id}`);
  }
  expect(cases).toContain('一条 Trace 关联两个知识对象');
  expect(cases).toContain('旧 Log 和旧 Trace 逐字节不变');
  expect(cases).toContain('只有来源 Trace，对象路由缺失');
  expect(cases).toContain('相关召回与表面相似反例');
  expect(cases).toContain('同一对象不得升级为跨对象能力假设');
  expect(cases).toContain('INDEX 分桶');
  expect(cases).toContain('200,000-token');
});

test('scorecard preserves semantic boundaries, replay thresholds, and owner authority', () => {
  const scorecard = read('scorecard.md');

  for (const category of ['学习痕迹', '对象记忆', '能力假设', '偏好', '教学待办']) {
    expect(scorecard).toContain(category);
  }
  for (const checkpoint of [
    '该召回还是不该召回',
    '跨对象能力假设门槛',
    '当前新证据与旧判断',
    'Roadmap 跨 Plan 校准',
  ]) {
    expect(scorecard).toContain(checkpoint);
  }
  expect(scorecard).toContain('`3/3` = PASS');
  expect(scorecard).toContain('`2/3` = PARTIAL');
  expect(scorecard).toContain('`0–1/3` = FAIL');
  expect(scorecard).toContain('自动审计只能给出建议；M1a 的最终判断权属于项目负责人。');
  expect(scorecard).toContain('## 项目负责人最终判断\n\n尚未填写');
});

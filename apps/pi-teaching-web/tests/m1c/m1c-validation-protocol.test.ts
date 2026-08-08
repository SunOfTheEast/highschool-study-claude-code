import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const protocol = readFileSync(join(import.meta.dir, '../../validation/m1c/protocol.md'), 'utf8');

test('freezes the real models, code, evidence, and no-edit acceptance rule', () => {
  expect(protocol).toContain('`2a1788c`');
  expect(protocol).toContain('`openai-codex/gpt-5.6-sol` + `high`');
  expect(protocol).toContain('`openai-codex/gpt-5.6-terra` + `high`');
  expect(protocol).toContain('同一次 acceptance run 中不得修改产品代码、Skill 或协议');
  expect(protocol).toContain('原生 Pi JSONL');
  expect(protocol).toContain('首个学生可见反馈');
});

test('uses three natural student scenarios without teaching the agent its implementation', () => {
  for (const heading of [
    '有资料的 Ksp 自由学习与 Meta',
    '空白的阿伦尼乌斯自由讨论',
    '正式课程与旧题库召回',
  ]) expect(protocol).toContain(heading);
  expect(protocol).toContain('学生消息不得出现工具名、文件路径、schema、revision 或预期调用顺序');
  expect(protocol).toContain('达到 Coach 要求的数量即停');
  expect(protocol).toContain('漂亮 Note 本身不等于掌握证据');
});

test('keeps failures and final release authority explicit', () => {
  expect(protocol).toContain('PASS / FAIL / NOT OBSERVED');
  expect(protocol).toContain('失败 run 原样保留');
  expect(protocol).toContain('最终发布判断权属于项目负责人');
});

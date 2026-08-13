import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const helpRoot = join(import.meta.dir, '../../resources/help');

function read(name: string): string {
  return readFileSync(join(helpRoot, name), 'utf8');
}

function localImages(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]!);
}

test('installation guide is click-first and honest about the ad-hoc beta', () => {
  const markdown = read('macos-installation.md');
  for (const text of [
    '拖到“应用程序”',
    '隐私与安全性',
    '仍要打开',
    '尚未经过 Apple 公证',
    '打开已有学习集',
    '主教师',
    '检索 Scout',
  ]) expect(markdown).toContain(text);
  expect(markdown).not.toMatch(/```|(?:^|\n)\s*(?:bun|npm|node|chmod|xattr|cd)\b/i);
});

test('first-learning guide covers the actual student loop without teaching internals', () => {
  const markdown = read('first-learning.md');
  for (const text of [
    '从空白开始',
    '问老师',
    '自由学习',
    '笔记与闪卡',
    '题卡',
    '长期规划',
    '学习阶段',
    '课堂',
    'Documents/StudyForge',
    '学习文件保存在本机',
    '当前任务所需',
    '不会无条件上传整个学习集',
  ]) expect(markdown).toContain(text);
  expect(markdown).toMatch(/交给你选择的\s*模型服务处理/);
  expect(markdown).not.toContain('Session Log');
  expect(markdown).not.toContain('对象记忆');
});

test('installation guide states the same local and model-processing boundary', () => {
  const markdown = read('macos-installation.md');
  expect(markdown).toContain('学习文件保存在本机');
  expect(markdown).toContain('当前任务所需');
  expect(markdown).toMatch(/交给你选择的\s*模型服务处理/);
  expect(markdown).toContain('不会无条件上传整个学习集');
});

test('every help image, when present, is local and resolvable', () => {
  for (const name of ['macos-installation.md', 'first-learning.md']) {
    const path = join(helpRoot, name);
    const images = localImages(readFileSync(path, 'utf8'));
    for (const image of images) {
      expect(image).not.toMatch(/^https?:/);
      expect(existsSync(join(dirname(path), image))).toBe(true);
    }
  }
});

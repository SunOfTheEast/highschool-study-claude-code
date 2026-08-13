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

test('installation guide is click-first, model-complete, and honest about the ad-hoc beta', () => {
  const markdown = read('macos-installation.md');
  for (const text of [
    '拖到“应用程序”',
    '隐私与安全性',
    '仍要打开',
    '尚未经过 Apple 公证',
    '打开已有学习集',
    '主教师',
    '检索 Scout',
    '资料视觉',
    '常见故障',
  ]) expect(markdown).toContain(text);
  expect(markdown).not.toMatch(/```|(?:^|\n)\s*(?:bun|npm|node|chmod|xattr|cd)\b/i);
});

test('first-learning guide covers the actual student loop without teaching internals', () => {
  const markdown = read('first-learning.md');
  for (const text of [
    '选择 PDF',
    '从空白开始',
    '问老师',
    '从这一页开始学',
    '笔记与闪卡',
    '题卡',
    '规划长期学习',
    'Documents/StudyForge',
    '学习文件保存在本机',
    '当前任务所需',
    '不会无条件上传整个学习集',
  ]) expect(markdown).toContain(text);
  expect(markdown).toMatch(/交给你选择的\s*模型服务处理/);
  expect(markdown).not.toMatch(/Session Log|对象记忆|Material revision|Roadmap|Plan|Lesson/);
});

test('feature guide is organized by student tasks and separates optional capabilities', () => {
  const markdown = read('feature-guide.md');
  for (const text of [
    '我想……',
    '沿着一本书学习',
    '自由学习：直接问老师',
    '笔记与闪卡',
    '题卡',
    '三种方式整理学习资料',
    '复习',
    '正式课程',
    '学习日历与专注',
    '学习足迹与教师记忆',
    '可选与实验功能',
    '页面速查',
  ]) expect(markdown).toContain(text);
  expect(markdown).toContain('什么时候用');
  expect(markdown).toContain('不会自动发生什么');
  expect(markdown).not.toMatch(/Material revision|Session key|tool call|schema|frontmatter/);
});

test('installation guide states the same local and model-processing boundary', () => {
  const markdown = read('macos-installation.md');
  expect(markdown).toContain('学习文件保存在本机');
  expect(markdown).toContain('当前任务所需');
  expect(markdown).toMatch(/交给你选择的\s*模型服务处理/);
  expect(markdown).toContain('不会无条件上传整个学习集');
});

test('Windows installation guide is click-first and requires no developer tools', () => {
  const markdown = read('windows-installation.md');
  for (const text of [
    'Windows 10 或 Windows 11',
    '64 位',
    'Windows 已保护你的电脑',
    '仍要运行',
    '无需安装 Git、Bash、Node.js 或 Bun',
    'WebView2',
    '主教师',
    '检索 Scout',
    '资料视觉',
    '常见故障',
  ]) expect(markdown).toContain(text);
  expect(markdown).not.toMatch(/```|(?:^|\n)\s*(?:bun|npm|node|chmod|powershell|cmd|cd)\b/i);
});

test('every help image, when present, is local and resolvable', () => {
  for (const name of [
    'macos-installation.md',
    'windows-installation.md',
    'first-learning.md',
    'feature-guide.md',
  ]) {
    const path = join(helpRoot, name);
    const images = localImages(readFileSync(path, 'utf8'));
    for (const image of images) {
      expect(image).not.toMatch(/^https?:/);
      expect(existsSync(join(dirname(path), image))).toBe(true);
    }
  }
});

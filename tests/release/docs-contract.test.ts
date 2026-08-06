import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const activePublicDocs = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'docs/architecture/m0-runtime.zh-CN.md',
  'docs/guides/agent-assisted-setup.zh-CN.md',
  'docs/guides/learning-set.zh-CN.md',
];

const privateLearningSetCommand =
  'STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo';

const describesAsOptional = (content: string, slice: 'graph/' | 'cards/' | 'materials/') => {
  const flattened = content.replace(/\s+/g, ' ');
  const escaped = slice.replace('/', '\\/');
  return new RegExp(
    `(?:${escaped}.{0,160}(?:optional|可选)|(?:optional|可选).{0,160}${escaped})`,
    'i',
  ).test(flattened);
};

test('ships the required public product and governance documents', () => {
  for (const path of [
    'README.md',
    'README.en.md',
    'AGENTS.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'docs/architecture/m0-runtime.zh-CN.md',
    'docs/guides/agent-assisted-setup.zh-CN.md',
    'docs/guides/learning-set.zh-CN.md',
    'docs/vision/cognitive-outcome-agent.zh-CN.md',
  ]) {
    expect(read(path).trim().length).toBeGreaterThan(100);
  }
});

test('describes the current runtime and protects the beta-card license boundary', () => {
  const active = [read('README.md'), read('README.en.md'), read('AGENTS.md')].join('\n');
  expect(active).toContain('Roadmap');
  expect(active).toContain('Plan-local');
  expect(active).toContain('Material Scout');
  expect(active).toContain('Lesson Reviewer');
  expect(active).toContain('bun run doctor');
  expect(active).not.toContain('apps/pi-teaching-web');
  expect(active).not.toContain('/Users/');
  expect(read('THIRD_PARTY_NOTICES.md')).toContain('not licensed under Apache-2.0');
  expect(read('examples/derivative-m0/README.md')).toContain(
    'private beta evaluation corpus',
  );
});

test('ships a public cardless math starter under CC BY 4.0', () => {
  for (const path of [
    'examples/math-starter-m0/README.md',
    'examples/math-starter-m0/LICENSE',
    'examples/math-starter-m0/learning-set/LEARNING_GUIDE.md',
    'examples/math-starter-m0/learning-set/ROADMAP.md',
  ]) {
    expect(existsSync(join(root, path))).toBe(true);
  }

  const starterReadme = read('examples/math-starter-m0/README.md');
  expect(starterReadme).toContain('CC BY 4.0');
  expect(starterReadme).toContain('no preloaded graph, cards, or materials');
});

test('active public docs make the cardless starter and optional asset contract explicit', () => {
  for (const path of activePublicDocs) {
    const content = read(path);
    expect(content).toContain('math-starter-m0');
    expect(describesAsOptional(content, 'graph/')).toBe(true);
    expect(describesAsOptional(content, 'cards/')).toBe(true);
    expect(describesAsOptional(content, 'materials/')).toBe(true);
  }

  const active = activePublicDocs.map(read).join('\n');
  expect(active).toContain(privateLearningSetCommand);
});

test('documents the minimum writable Learning Set and stable empty Knowledge behavior', () => {
  const agentContract = read('AGENTS.md');
  expect(agentContract).toMatch(/LEARNING_GUIDE\.md[\s\S]*ROADMAP\.md/);
  expect(agentContract).toMatch(/(?:writable|write access)/i);
  expect(agentContract).toMatch(/present[\s-]*invalid[\s\S]*fail/i);

  const learningSetGuide = read('docs/guides/learning-set.zh-CN.md');
  expect(learningSetGuide).toMatch(/LEARNING_GUIDE\.md[\s\S]*ROADMAP\.md/);
  expect(learningSetGuide).toMatch(/Plan[\s\S]{0,100}(?:随后|之后|需要时|later)/i);
  expect(learningSetGuide).toMatch(/缺失[\s\S]{0,160}空[\s\S]{0,160}无效[\s\S]{0,160}失败/);
  expect(learningSetGuide).toMatch(/Knowledge[\s\S]{0,100}(?:稳定|不变)[\s\S]{0,100}空状态/);
});

test('keeps static Knowledge independent from the course model', () => {
  for (const path of ['README.md', 'README.en.md']) {
    const content = read(path);
    expect(content).toMatch(/(?:静态资产|static assets)[\s\S]{0,160}(?:加速|accelerat)/i);
    expect(content).toMatch(/(?:不是|not)[\s\S]{0,80}(?:课程模型|course model)/i);
  }

  const architecture = read('docs/architecture/m0-runtime.zh-CN.md');
  expect(architecture).toMatch(/Course[\s\S]{0,120}Session[\s\S]{0,120}Lesson/);
  expect(architecture).toMatch(/不依赖[\s\S]{0,120}Knowledge/);
});

const markdownFiles = [
  ...activePublicDocs,
  'docs/vision/cognitive-outcome-agent.zh-CN.md',
];

test('keeps active local Markdown links resolvable', () => {
  for (const file of markdownFiles) {
    const content = read(file).replace(/```[\s\S]*?```/g, '');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#', 1)[0]!;
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      expect(existsSync(resolve(root, dirname(file), decodeURIComponent(target)))).toBe(true);
    }
  }
});

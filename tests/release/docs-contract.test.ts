import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

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

const markdownFiles = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'docs/architecture/m0-runtime.zh-CN.md',
  'docs/guides/agent-assisted-setup.zh-CN.md',
  'docs/guides/learning-set.zh-CN.md',
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

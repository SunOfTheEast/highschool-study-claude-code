import { expect, test } from 'bun:test';

const css = await Promise.all([
  'workspace-shell.css',
  'course.css',
  'classroom.css',
  'knowledge.css',
  'memory.css',
  'responsive.css',
].map((name) => Bun.file(
  new URL(`../../src/client/styles/${name}`, import.meta.url),
).text())).then((parts) => parts.join('\n'));

test('defines medium drawers, narrow lists and reduced motion', () => {
  expect(css).toContain('@media (max-width: 1100px)');
  expect(css).toContain('@media (max-width: 720px)');
  expect(css).toContain('.method-list-fallback');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
});

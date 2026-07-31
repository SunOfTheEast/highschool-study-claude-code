import { describe, expect, test } from 'bun:test';

const themeFile = Bun.file(new URL('../../src/client/theme-liubai.css', import.meta.url));
const theme = await themeFile.exists() ? await themeFile.text() : '';
const main = await Bun.file(
  new URL('../../src/client/main.tsx', import.meta.url),
).text();
const styles = await Bun.file(
  new URL('../../src/client/styles.css', import.meta.url),
).text();
const layoutStyleNames = [
  'workspace-shell.css',
  'course.css',
  'classroom.css',
  'knowledge.css',
  'memory.css',
  'responsive.css',
];
const allLayoutStyles = [
  styles,
  ...await Promise.all(layoutStyleNames.map(async (name) => {
    const file = Bun.file(new URL(`../../src/client/styles/${name}`, import.meta.url));
    return await file.exists() ? file.text() : '';
  })),
].join('\n');

describe('liubai theme contract', () => {
  test('uses the approved palette as semantic tokens', () => {
    expect(theme).toContain('--paper: #faf7f1;');
    expect(theme).toContain('--paper-deep: #f1ece1;');
    expect(theme).toContain('--ink: #1b1916;');
    expect(theme).toContain('--ink-soft: #4a463d;');
    expect(theme).toContain('--ink-faint: #9a917f;');
    expect(theme).toContain('--accent: #3f5b54;');
    expect(theme).toContain('--accent-deep: #314a44;');
    expect(theme).toContain('--cinnabar: #9c493f;');
    expect(theme).toContain('--attention: #b6a06a;');
    expect(theme).toContain('--danger: #a8674f;');
    expect(theme).toContain('--rule: rgba(27, 25, 22, .09);');
  });

  test('keeps persona color local and loads the theme before layout styles', () => {
    expect(theme).toContain('.app-root[data-persona="neutral-tutor"]');
    expect(theme).toContain('.app-root[data-persona="calm-senpai"]');
    expect(theme).toContain('.app-root[data-persona="energetic-classmate"]');
    expect(theme).not.toContain('--amber');
    expect(main.indexOf("import './theme-liubai.css';"))
      .toBeLessThan(main.indexOf("import './styles.css';"));
  });

  test('layout styles consume semantic tokens instead of the old amber palette', () => {
    expect(allLayoutStyles).not.toContain('--amber');
    expect(allLayoutStyles).not.toContain('#b86c28');
    expect(allLayoutStyles).not.toContain('#f3efe5');
    expect(allLayoutStyles).not.toContain('radial-gradient');
    expect(allLayoutStyles).not.toContain('particle');
    expect(allLayoutStyles).toContain('var(--accent)');
    expect(allLayoutStyles).toContain('var(--attention)');
    expect(allLayoutStyles).toContain('var(--danger)');
    expect(allLayoutStyles).toContain('[data-view="coach"]');
    expect(allLayoutStyles).toContain('[data-view="tutor"]');
    expect(allLayoutStyles).toContain('[data-view="replay"]');
  });
});

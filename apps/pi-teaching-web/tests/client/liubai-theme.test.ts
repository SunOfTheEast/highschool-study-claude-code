import { describe, expect, test } from 'bun:test';

const themeFile = Bun.file(new URL('../../src/client/theme-liubai.css', import.meta.url));
const theme = await themeFile.exists() ? await themeFile.text() : '';
const main = await Bun.file(
  new URL('../../src/client/main.tsx', import.meta.url),
).text();
const styles = await Bun.file(
  new URL('../../src/client/styles.css', import.meta.url),
).text();

describe('liubai theme contract', () => {
  test('uses the approved palette as semantic tokens', () => {
    expect(theme).toContain('--paper: #faf7f1;');
    expect(theme).toContain('--paper-deep: #f1ece1;');
    expect(theme).toContain('--ink: #1b1916;');
    expect(theme).toContain('--ink-soft: #4a463d;');
    expect(theme).toContain('--ink-faint: #9a917f;');
    expect(theme).toContain('--accent: #3f5b54;');
    expect(theme).toContain('--accent-deep: #314a44;');
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
    expect(styles).not.toContain('--amber');
    expect(styles).not.toContain('#b86c28');
    expect(styles).not.toContain('#f3efe5');
    expect(styles).not.toContain('radial-gradient');
    expect(styles).toContain('var(--accent)');
    expect(styles).toContain('var(--attention)');
    expect(styles).toContain('var(--danger)');
    expect(styles).toContain('[data-view="coach"]');
    expect(styles).toContain('[data-view="tutor"]');
    expect(styles).toContain('[data-view="replay"]');
  });
});

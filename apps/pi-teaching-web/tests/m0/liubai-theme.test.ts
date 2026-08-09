import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const client = join(import.meta.dir, '../../src/client');

test('ships the approved Kimi paper, type and spacing tokens', () => {
  const theme = readFileSync(join(client, 'theme-liubai.css'), 'utf8');

  expect(theme).toContain('--paper: #faf7f1');
  expect(theme).toContain('--paper-deep: #f1ece1');
  expect(theme).toContain('--paper-mid: #f6f1e7');
  expect(theme).toContain('--seal: #9e4f3d');
  expect(theme).toContain('--text-body: 16px');
  expect(theme).toContain('--space-9: 96px');
  expect(theme).toContain('--font-ui: "LXGW WenKai Screen"');
});

test('loads the self-hosted WenKai font before local theme styles', () => {
  const main = readFileSync(join(client, 'main.tsx'), 'utf8');
  const font = main.indexOf('lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css');
  const theme = main.indexOf('./theme-liubai.css');

  expect(font).toBeGreaterThanOrEqual(0);
  expect(font).toBeLessThan(theme);
});

test('ports the Kimi brand seal and overview anchor selectors', () => {
  const shell = readFileSync(join(client, 'styles/workspace-shell.css'), 'utf8');
  const overview = readFileSync(join(client, 'pages/CourseOverviewPage.tsx'), 'utf8');

  expect(shell).toContain('.brand-seal');
  expect(shell).toContain('.course-overview');
  expect(overview).toContain('overview-continue');
});

test('does not hide teaching information in sub-11px literal font sizes', () => {
  const styleFiles = [
    join(client, 'styles.css'),
    join(client, 'theme-liubai.css'),
    ...readdirSync(join(client, 'styles'))
      .filter((name) => name.endsWith('.css'))
      .map((name) => join(client, 'styles', name)),
  ];
  const violations: string[] = [];

  for (const path of styleFiles) {
    const source = readFileSync(path, 'utf8');
    const patterns = [
      /font-size\s*:\s*(\d*\.?\d+)(px|rem)\b/g,
      /\bfont\s*:[^;{}]*?\s(\d*\.?\d+)(px|rem)\s*\//g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const numeric = Number(match[1]);
        const pixels = match[2] === 'rem' ? numeric * 16 : numeric;
        if (pixels < 11) violations.push(`${path}:${match[0]}`);
      }
    }
  }

  expect(violations).toEqual([]);
});

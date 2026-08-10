import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../../src/client/components/AppShell';
import {
  AssetProvenance,
  AssetTags,
} from '../../src/client/components/AssetSources';

test('keeps the Liubai palette readable and exposes four restrained action levels', () => {
  const theme = readFileSync(join(import.meta.dir, '../../src/client/theme-liubai.css'), 'utf8');
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles.css'), 'utf8');

  expect(theme).toContain('--ink-faint: #70695d');
  for (const level of ['solid', 'wash', 'outline', 'text']) {
    expect(styles).toContain(`.action-${level}`);
  }
  expect(styles).toContain('.seal-mark');
});

test('keeps desktop conversations as a readable letter with an inner writing gutter', () => {
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles/m1b.css'), 'utf8');

  expect(styles).toContain('.letter-workspace { width: min(860px, 100%); }');
  expect(styles).toMatch(/\.free-learning-workspace \.chat\s*\{[^}]*padding-inline:\s*var\(--space-5\)/s);
});

test('uses one dominant atlas and one contextual folio instead of three debugger columns', () => {
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles/knowledge.css'), 'utf8');

  expect(styles).toContain('.knowledge-atlas-layout');
  expect(styles).toMatch(
    /grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(18rem,\s*3fr\)/,
  );
  expect(styles).toContain('.knowledge-folio');
  expect(styles).toContain('.semantic-focus-slip');
  expect(styles).toMatch(/\.knowledge-folio\s*\{[^}]*border-top:\s*3px solid var\(--cinnabar\)/s);
  expect(styles).toMatch(/\.semantic-focus-slip\s*\{[^}]*border:\s*1px solid var\(--cinnabar\)/s);
  expect(styles).not.toContain('.knowledge-entry');
});

test('separates the atlas canvas from its contextual folio with explicit paper boundaries', () => {
  const theme = readFileSync(join(import.meta.dir, '../../src/client/theme-liubai.css'), 'utf8');
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles/knowledge.css'), 'utf8');

  expect(theme).toContain('--rule-strong: rgba(27, 25, 22, .20)');
  expect(styles).toMatch(
    /\.semantic-canvas\s*\{[^}]*border:\s*1px solid var\(--rule-strong\)/s,
  );
  expect(styles).toMatch(
    /\.knowledge-folio\s*\{[^}]*border:\s*1px solid var\(--rule-strong\)[^}]*border-top:\s*3px solid var\(--cinnabar\)[^}]*background:\s*var\(--paper-deep\)/s,
  );
});

test('uses the 学 seal as brand language rather than a status badge', () => {
  const markup = renderToStaticMarkup(
    <AppShell
      title="化学学习集"
      activeView="home"
      connection="open"
      hasCourse={false}
      onNavigate={() => {}}
    >
      <p>内容</p>
    </AppShell>,
  );

  expect(markup).toContain('class="brand-seal seal-mark"');
  expect(markup).toContain('>学</span>');
  expect(markup).not.toContain('data-status="学"');
});

test('distinguishes core and related tags in both words and semantic hooks', () => {
  const markup = renderToStaticMarkup(
    <AssetTags value={{ core: ['沉淀溶解平衡'], related: ['纯固体'] }} />,
  );

  expect(markup).toContain('data-tag-role="core"');
  expect(markup).toContain('data-tag-role="related"');
  expect(markup).toContain('核心 · 沉淀溶解平衡');
  expect(markup).toContain('相关 · 纯固体');
});

test('renders formation and pinned content sources as separate facts', () => {
  const markup = renderToStaticMarkup(
    <AssetProvenance
      formation={{
        sessionId: 'free-session-001',
        kind: 'free-learning',
        title: 'Ksp 为什么只写离子浓度？',
        route: '/learn/free-session-001',
      }}
      sources={[{
        kind: 'material',
        id: 'material-001',
        revision: 2,
        locator: 'page-0062',
      }]}
    />,
  );

  expect(markup).toContain('形成于');
  expect(markup).toContain('Ksp 为什么只写离子浓度？');
  expect(markup).toContain('内容来源');
  expect(markup).toContain('资料 material-001 · 第 2 版 · 第 62 页');
  expect(markup).not.toContain('形成来源');
});

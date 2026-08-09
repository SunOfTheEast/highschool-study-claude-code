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

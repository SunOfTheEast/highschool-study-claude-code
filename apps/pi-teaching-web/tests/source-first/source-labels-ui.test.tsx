import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssetSources } from '../../src/client/components/AssetSources';

test('shows human source labels and exact old-revision links without internal locator syntax', () => {
  const markup = renderToStaticMarkup(<AssetSources
    value={[{ kind: 'material', id: 'material-001', revision: 1, locator: 'pages-0086-0087' }]}
    labels={[{
      source: { kind: 'material', id: 'material-001', revision: 1, locator: 'pages-0086-0087' },
      label: '《化学反应原理》 · 第三章 · 第 86–87 页',
      route: '/assets/books/material-001/read/1/pages-0086-0087',
    }]}
  />);
  expect(markup).toContain('《化学反应原理》 · 第三章 · 第 86–87 页');
  expect(markup).toContain('/assets/books/material-001/read/1/pages-0086-0087');
  expect(markup).not.toContain('material-001 · 第 1 版');
  expect(markup).not.toContain('pages-0086-0087</');
});

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from '../../src/client/components/MarkdownView';
import { prepareMathMarkdown } from '../../src/client/math-markdown';

test('normalizes TeX math delimiters outside code spans and fences', () => {
  const source = [
    '行内 \\(te^t\\) 与块级：',
    '\\[\\frac{x^2-1}{x-1}=x+1\\]',
    '`\\(literal\\)`',
    '```tex',
    '\\[literal\\]',
    '```',
  ].join('\n');

  const prepared = prepareMathMarkdown(source);

  expect(prepared.tokens.map(({ value, display }) => ({ value, display }))).toEqual([
    { value: 'te^t', display: false },
    { value: '\\frac{x^2-1}{x-1}=x+1', display: true },
  ]);
  expect(prepared.markdown).toContain('`\\(literal\\)`');
  expect(prepared.markdown).toContain(['```tex', '\\[literal\\]', '```'].join('\n'));
});

test('preserves inline dollar math and canonicalizes display dollar math', () => {
  const prepared = prepareMathMarkdown('$f(x)$ 与 $$x^2$$ 与 \\(未闭合');

  expect(prepared.tokens.map(({ value, display }) => ({ value, display }))).toEqual([
    { value: 'x^2', display: true },
  ]);
  expect(prepared.markdown).toBe(`$f(x)$ 与 ${prepared.tokens[0]!.marker} 与 \\(未闭合`);
});

test('renders all four supported math delimiter forms through KaTeX', () => {
  const markup = renderToStaticMarkup(
    <MarkdownView>{'$a$ \\(b\\) $$c$$ \\[d\\]'}</MarkdownView>,
  );

  expect(markup.match(/class="katex"/g)).toHaveLength(4);
  expect(markup.match(/class="katex-display"/g)).toHaveLength(2);
});

test('keeps display math inside its list item and blockquote containers', () => {
  const listMarkup = renderToStaticMarkup(
    <MarkdownView>{'- 结论前 \\[x^2\\] 结论后'}</MarkdownView>,
  );
  const listClose = listMarkup.indexOf('</li>');
  expect(listMarkup.indexOf('katex-display')).toBeLessThan(listClose);
  expect(listMarkup.indexOf('结论后')).toBeLessThan(listClose);

  const quoteMarkup = renderToStaticMarkup(
    <MarkdownView>{'> 解释前 $$y^2$$ 解释后'}</MarkdownView>,
  );
  const quoteClose = quoteMarkup.indexOf('</blockquote>');
  expect(quoteMarkup.indexOf('katex-display')).toBeLessThan(quoteClose);
  expect(quoteMarkup.indexOf('解释后')).toBeLessThan(quoteClose);
});

test('restores inline TeX inside Markdown headings', () => {
  const markup = renderToStaticMarkup(
    <MarkdownView>{'## 当 \\(x>0\\) 时'}</MarkdownView>,
  );

  expect(markup).toContain('<h2>');
  expect(markup).toContain('class="katex"');
  expect(markup).not.toContain('STUDYFORGEMATHTOKEN');
});

test('keeps malformed formulas visible without throwing', () => {
  const render = () => renderToStaticMarkup(
    <MarkdownView>{'前文 $\\notARealCommand{x}$ 后文'}</MarkdownView>,
  );

  expect(render).not.toThrow();
  expect(render()).toContain('前文');
  expect(render()).toContain('后文');
});

test('renders a GFM table with math inside its cells', () => {
  const source = [
    '| 操作 | 反应气体的分压 | 平衡 |',
    '|---|---|---|',
    '| 恒温恒容加入惰性气体 | $p_i=n_iRT/V$ 不变 | 不移动 |',
  ].join('\n');

  const markup = renderToStaticMarkup(<MarkdownView>{source}</MarkdownView>);

  expect(markup).toContain('<table>');
  expect(markup).toContain('<th>操作</th>');
  expect(markup).toContain('class="katex"');
});

test('allows packaged help images without widening ordinary teaching Markdown', () => {
  const source = '![帮助图](data:image/png;base64,AAAA)';
  const help = renderToStaticMarkup(<MarkdownView allowDataImages>{source}</MarkdownView>);
  const teaching = renderToStaticMarkup(<MarkdownView>{source}</MarkdownView>);

  expect(help).toContain('src="data:image/png;base64,AAAA"');
  expect(teaching).not.toContain('src="data:image/png;base64,AAAA"');
});

test('renders one-line asset titles without a paragraph wrapper', () => {
  const markup = renderToStaticMarkup(<MarkdownView inline>{'**参数主元**'}</MarkdownView>);

  expect(markup).toBe('<strong>参数主元</strong>');
});

test('gives display math a readable textbook scale and vertical breathing room', () => {
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles.css'), 'utf8');
  const rule = /\.katex-display\s*\{([^}]*)\}/.exec(styles)?.[1] ?? '';

  expect(rule).toContain('overflow-x: auto');
  expect(rule).toContain('font-size: 1.08em');
  expect(rule).toContain('margin: var(--space-4, 1rem) 0');
  expect(rule).toContain('padding-block: .5em');
});

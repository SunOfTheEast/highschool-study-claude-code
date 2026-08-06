import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from '../../src/client/components/MarkdownView';
import { normalizeMathDelimiters } from '../../src/client/math-markdown';

test('normalizes TeX math delimiters outside code spans and fences', () => {
  const source = [
    '行内 \\(te^t\\) 与块级：',
    '\\[\\frac{x^2-1}{x-1}=x+1\\]',
    '`\\(literal\\)`',
    '```tex',
    '\\[literal\\]',
    '```',
  ].join('\n');

  expect(normalizeMathDelimiters(source)).toBe([
    '行内 $te^t$ 与块级：',
    '',
    '$$',
    '\\frac{x^2-1}{x-1}=x+1',
    '$$',
    '',
    '`\\(literal\\)`',
    '```tex',
    '\\[literal\\]',
    '```',
  ].join('\n'));
});

test('preserves inline dollar math and canonicalizes display dollar math', () => {
  expect(normalizeMathDelimiters('$f(x)$ 与 $$x^2$$ 与 \\(未闭合'))
    .toBe('$f(x)$ 与 \n\n$$\nx^2\n$$\n\n 与 \\(未闭合');
});

test('renders all four supported math delimiter forms through KaTeX', () => {
  const markup = renderToStaticMarkup(
    <MarkdownView>{'$a$ \\(b\\) $$c$$ \\[d\\]'}</MarkdownView>,
  );

  expect(markup.match(/class="katex"/g)).toHaveLength(4);
  expect(markup.match(/class="katex-display"/g)).toHaveLength(2);
});

test('keeps malformed formulas visible without throwing', () => {
  const render = () => renderToStaticMarkup(
    <MarkdownView>{'前文 $\\notARealCommand{x}$ 后文'}</MarkdownView>,
  );

  expect(render).not.toThrow();
  expect(render()).toContain('前文');
  expect(render()).toContain('后文');
});

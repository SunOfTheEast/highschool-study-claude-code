import 'katex/dist/katex.min.css';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import type { MouseEvent as ReactMouseEvent } from 'react';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { prepareMathMarkdown, remarkPreparedMath } from '../math-markdown';

const katexOptions = {
  throwOnError: false,
  strict: 'warn',
} as const;

const blockComponents: Components = {
  img: ({ src, alt, title }) => src ? <img src={src} alt={alt ?? ''} title={title} /> : null,
};

const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <>{children}</>,
};

export function MarkdownView({
  children,
  inline = false,
  allowDataImages = false,
  onFormulaSpeak,
}: {
  children: string;
  inline?: boolean;
  allowDataImages?: boolean;
  onFormulaSpeak?: (tex: string) => void;
}) {
  const prepared = prepareMathMarkdown(children);
  const rendered = (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm, remarkPreparedMath(prepared.tokens)]}
      rehypePlugins={[[rehypeKatex, katexOptions]]}
      components={inline ? inlineComponents : blockComponents}
      urlTransform={(url) => (
        allowDataImages && url.startsWith('data:image/png;base64,')
          ? url
          : defaultUrlTransform(url)
      )}
    >
      {prepared.markdown}
    </ReactMarkdown>
  );
  if (!onFormulaSpeak || inline) return rendered;

  const speakFormula = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const formula = target.closest('.katex');
    const annotation = formula?.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation?.textContent?.trim();
    if (tex) onFormulaSpeak(tex);
  };
  return (
    <div className="formula-speech-surface" onClick={speakFormula}>
      {rendered}
    </div>
  );
}

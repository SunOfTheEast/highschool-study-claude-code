import 'katex/dist/katex.min.css';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
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
}: {
  children: string;
  inline?: boolean;
  allowDataImages?: boolean;
}) {
  const prepared = prepareMathMarkdown(children);

  return (
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
}

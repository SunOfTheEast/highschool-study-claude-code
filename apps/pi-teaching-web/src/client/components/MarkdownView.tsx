import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { prepareMathMarkdown, remarkPreparedMath } from '../math-markdown';

const katexOptions = {
  throwOnError: false,
  strict: 'warn',
} as const;

export function MarkdownView({ children }: { children: string }) {
  const prepared = prepareMathMarkdown(children);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkPreparedMath(prepared.tokens)]}
      rehypePlugins={[[rehypeKatex, katexOptions]]}
    >
      {prepared.markdown}
    </ReactMarkdown>
  );
}

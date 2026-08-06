import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { normalizeMathDelimiters } from '../math-markdown';

const katexOptions = {
  throwOnError: false,
  strict: 'warn',
} as const;

export function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, katexOptions]]}
    >
      {normalizeMathDelimiters(children)}
    </ReactMarkdown>
  );
}

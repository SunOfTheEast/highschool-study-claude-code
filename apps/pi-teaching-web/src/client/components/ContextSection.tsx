import type { ReactNode } from 'react';

export function ContextSection({
  title,
  summary,
  open,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details className="context-section" open={open}>
      <summary>
        <span>{title}</span>
        <small>{summary}</small>
      </summary>
      <div className="context-section-body">{children}</div>
    </details>
  );
}

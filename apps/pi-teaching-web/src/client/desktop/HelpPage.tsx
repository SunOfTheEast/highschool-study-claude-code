import { useState } from 'react';
import { MarkdownView } from '../components/MarkdownView';

export type HelpDocument = {
  id: 'macos-installation' | 'first-learning';
  title: string;
  markdown: string;
};

export function HelpPage({ documents, onBack }: { documents: HelpDocument[]; onBack(): void }) {
  const [selected, setSelected] = useState<HelpDocument['id']>('first-learning');
  const document = documents.find((item) => item.id === selected) ?? documents[0];
  return (
    <main className="desktop-canvas desktop-page-reveal">
      <header className="desktop-subpage-header">
        <button className="action-text" type="button" onClick={onBack}>← 回到学习</button>
        <span>StudyForge 帮助</span>
      </header>
      <section className="desktop-help-layout">
        <nav aria-label="帮助目录">
          {documents.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === document?.id ? 'page' : undefined}
              onClick={() => setSelected(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <article className="desktop-help-paper">
          {document
            ? <MarkdownView>{document.markdown}</MarkdownView>
            : <p>离线教程暂时无法读取。</p>}
        </article>
      </section>
    </main>
  );
}

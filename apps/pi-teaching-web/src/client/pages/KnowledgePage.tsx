import type { KnowledgeViewProjection } from '../../shared/view-contracts';

export type KnowledgePageProps = {
  value: KnowledgeViewProjection;
};

export function KnowledgePage({ value }: KnowledgePageProps) {
  return (
    <main className="coordinate-page knowledge-page" aria-label="知识山河">
      {value.nodes.length > 0
        ? <p>方法骨架已经展开。</p>
        : <p>方法骨架中还没有可显示的节点。</p>}
    </main>
  );
}

export default KnowledgePage;

import type {
  KnowledgeGraphNode,
  KnowledgeViewProjection,
  ViewQuery,
} from '../../shared/view-contracts';
import { MethodFilters } from '../components/MethodFilters';
import { MethodInspector } from '../components/MethodInspector';
import { MethodLandscape } from '../components/MethodLandscape';

export type KnowledgePageProps = {
  value: KnowledgeViewProjection;
  onSelectMethod?(node: KnowledgeGraphNode): void;
  onSelectCard?(cardPath: string, methodName: string): void;
  onSelectMaterial?(path: string): void;
  onFilter?(patch: Partial<ViewQuery>): void;
  onCourse?(route: string): void;
  onMemory?(source: string): void;
};

export function KnowledgePage({
  value,
  onSelectMethod = () => {},
  onSelectCard = () => {},
  onSelectMaterial = () => {},
  onFilter = () => {},
  onCourse = () => {},
  onMemory = () => {},
}: KnowledgePageProps) {
  return (
    <main
      className="coordinate-page knowledge-page knowledge-workspace"
      aria-label="知识山河"
    >
      <MethodFilters value={value.filters} onChange={onFilter} />
      <MethodLandscape
        nodes={value.nodes}
        edges={value.edges}
        onSelect={onSelectMethod}
      />
      <MethodInspector
        value={value.selectedMethod}
        onSelectCard={onSelectCard}
        onSelectMaterial={onSelectMaterial}
        onCourse={onCourse}
        onMemory={onMemory}
      />
    </main>
  );
}

export default KnowledgePage;

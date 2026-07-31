import type {
  MemoryViewProjection,
  PublicObjectionTarget,
  ViewQuery,
} from '../../shared/view-contracts';
import { EvidenceDetail } from '../components/EvidenceDetail';
import { EvidenceLineage } from '../components/EvidenceLineage';
import { MemoryDirectory } from '../components/MemoryDirectory';

export type MemoryPageProps = {
  value: MemoryViewProjection;
  onSelectSource?(source: string): void;
  onFilter?(patch: Partial<ViewQuery>): void;
  onCourse?(planId: string | null, lessonId: string | null): void;
  onKnowledge?(methodName: string | null, cardPath: string | null): void;
  onObject?(target: PublicObjectionTarget): void;
};

export function MemoryPage({
  value,
  onSelectSource = () => {},
  onFilter = () => {},
  onCourse = () => {},
  onKnowledge = () => {},
  onObject = () => {},
}: MemoryPageProps) {
  return (
    <main
      className="coordinate-page memory-page memory-workspace"
      aria-label="研习留痕"
    >
      <MemoryDirectory
        value={value}
        onSelect={onSelectSource}
        onFilter={onFilter}
      />
      <section className="lineage-column" aria-label="来源脉络">
        {value.lineage ? (
          <EvidenceLineage
            value={value.lineage}
            selectedSource={value.selectedSource}
            onSelect={onSelectSource}
          />
        ) : <p>选择一条记忆或阶段发现，查看它从哪里来。</p>}
      </section>
      <EvidenceDetail
        value={value.detail}
        onCourse={onCourse}
        onKnowledge={onKnowledge}
        onObject={onObject}
      />
    </main>
  );
}

export default MemoryPage;

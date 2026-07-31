import type { MemoryViewProjection } from '../../shared/view-contracts';

export type MemoryPageProps = {
  value: MemoryViewProjection;
};

export function MemoryPage({ value }: MemoryPageProps) {
  return (
    <main className="coordinate-page memory-page" aria-label="研习留痕">
      {value.confirmed.length > 0
        ? <p>已整理经你确认的长期记录。</p>
        : <p>尚未形成经你确认的长期记录。</p>}
    </main>
  );
}

export default MemoryPage;

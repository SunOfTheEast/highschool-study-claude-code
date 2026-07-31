import type { PublicEvidenceNode } from '../../shared/view-contracts';

const evidenceStateLabel = {
  active: '当前有效',
  invalidated: '来源后来被修正',
  missing: '来源暂时不可读',
  forbidden: '不属于当前学习分支',
} as const;

function EvidenceBranch({
  node,
  selectedSource,
  onSelect,
}: {
  node: PublicEvidenceNode;
  selectedSource: string | null;
  onSelect(source: string): void;
}) {
  return (
    <li data-state={node.state}>
      <button
        type="button"
        aria-current={node.source === selectedSource || undefined}
        onClick={() => onSelect(node.source)}
      >
        <strong>{node.label}</strong>
        <small>{evidenceStateLabel[node.state]}</small>
      </button>
      {node.children.length > 0 && (
        <ol>
          {node.children.map((child) => (
            <EvidenceBranch
              key={child.source}
              node={child}
              selectedSource={selectedSource}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

export function EvidenceLineage({
  value,
  selectedSource,
  onSelect,
}: {
  value: PublicEvidenceNode;
  selectedSource: string | null;
  onSelect(source: string): void;
}) {
  return (
    <ol className="evidence-lineage" aria-label="学习来源链">
      <EvidenceBranch
        node={value}
        selectedSource={selectedSource}
        onSelect={onSelect}
      />
    </ol>
  );
}

export default EvidenceLineage;

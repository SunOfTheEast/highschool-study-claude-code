import type {
  EvidenceState,
  HandoffEvidenceNode,
} from '../../shared/contracts';

const stateLabel: Record<EvidenceState, string> = {
  active: '当前有效',
  invalidated: '底层记录后来被更正',
  missing: '来源暂时不可读',
  forbidden: '不属于当前学习分支',
};

function publicLabel(node: HandoffEvidenceNode): string {
  if (/^claim:.*#teaching-t\d+$/.test(node.source)) return '教学安排依据';
  if (node.source.startsWith('card:')) return '关联题卡';
  if (node.source.startsWith('block:')) return '课堂步骤';
  if (node.source.startsWith('session:')) return '课堂对话片段';
  return node.label;
}

function HandoffBranch({ node }: { node: HandoffEvidenceNode }) {
  return (
    <li className="handoff-tree-node" data-state={node.state}>
      <div className="handoff-tree-entry">
        <span aria-hidden="true" />
        <p>
          <strong>{publicLabel(node)}</strong>
          <small>{stateLabel[node.state]}</small>
        </p>
      </div>
      {node.children.length > 0 && (
        <ol>
          {node.children.map((child) => (
            <HandoffBranch key={child.source} node={child} />
          ))}
        </ol>
      )}
    </li>
  );
}

export function HandoffTree({ value }: { value: HandoffEvidenceNode }) {
  return (
    <ol className="handoff-tree" aria-label="阶段认识来源树">
      <HandoffBranch node={value} />
    </ol>
  );
}

import type { CourseTreeNode } from '../../shared/view-contracts';

function Branch({
  node,
  selectedKey,
  onSelect,
}: {
  node: CourseTreeNode;
  selectedKey: string | null;
  onSelect(node: CourseTreeNode): void;
}) {
  return (
    <li data-kind={node.kind} data-status={node.status}>
      <button
        type="button"
        aria-current={node.key === selectedKey ? 'page' : undefined}
        onClick={() => onSelect(node)}
      >
        <small>
          {node.status === 'candidate' ? '可能的下一步' : node.publicPurpose}
        </small>
        <strong>
          {node.status === 'candidate' ? node.publicPurpose : node.title}
        </strong>
      </button>
      {node.dependsOn.length > 0 && (
        <p className="course-dependencies">
          承接：{node.dependsOn.join('、')}
        </p>
      )}
      {node.children.length > 0 && (
        <ol>
          {node.children.map((child) => (
            <Branch
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

export function CourseTree({
  root,
  selectedKey,
  onSelect,
}: {
  root: CourseTreeNode;
  selectedKey: string | null;
  onSelect(node: CourseTreeNode): void;
}) {
  return (
    <nav className="course-tree" aria-label="课程组织">
      <ol>
        <Branch node={root} selectedKey={selectedKey} onSelect={onSelect} />
      </ol>
    </nav>
  );
}

export default CourseTree;

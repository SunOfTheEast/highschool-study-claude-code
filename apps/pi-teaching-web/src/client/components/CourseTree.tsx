import type { CourseTreeNode } from '../../shared/contracts';

const statusLabel = {
  prepared: '待开始',
  active: '进行中',
  completed: '已完成',
  closed: '已结束',
} as const;

function Branch({
  node,
  selectedPath,
  onSelect,
}: {
  node: CourseTreeNode;
  selectedPath: string;
  onSelect(node: CourseTreeNode): void;
}) {
  return (
    <li data-kind={node.kind} data-status={node.status}>
      <button
        type="button"
        aria-current={node.path === selectedPath ? 'page' : undefined}
        onClick={() => onSelect(node)}
      >
        <small>{statusLabel[node.status]}</small>
        <strong>{node.title}</strong>
      </button>
      {node.dependsOn.length > 0 && (
        <p className="course-dependencies">承接：{node.dependsOn.join('、')}</p>
      )}
      {node.children.length > 0 && (
        <ol>
          {node.children.map((child) => (
            <Branch
              key={child.path}
              node={child}
              selectedPath={selectedPath}
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
  selectedPath,
  onSelect,
}: {
  root: CourseTreeNode;
  selectedPath: string;
  onSelect(node: CourseTreeNode): void;
}) {
  return (
    <nav className="course-tree" aria-label="课程组织">
      <ol><Branch node={root} selectedPath={selectedPath} onSelect={onSelect} /></ol>
    </nav>
  );
}

export default CourseTree;

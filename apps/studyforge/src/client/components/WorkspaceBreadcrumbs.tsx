import type { CourseSnapshot, CourseTreeNode, NodeStatus } from '../../shared/contracts';
import { formatBrowserRoute, type BrowserRoute } from '../routes';

type Breadcrumb = {
  label: string;
  route?: BrowserRoute;
};

const statusLabel: Record<NodeStatus, string> = {
  prepared: '待开始',
  active: '进行中',
  completed: '已完成',
  closed: '已结束 · 只读',
};

function parentPlan(root: CourseTreeNode, selectedPath: string): CourseTreeNode | null {
  return root.children.find((node) => (
    node.kind === 'plan'
    && node.children.some((lesson) => lesson.path === selectedPath)
  )) ?? null;
}

export function WorkspaceBreadcrumbs({
  value,
  selectedNode,
}: {
  value: CourseSnapshot;
  selectedNode: CourseTreeNode;
}) {
  const plan = selectedNode.kind === 'plan'
    ? selectedNode
    : selectedNode.kind === 'lesson'
      ? parentPlan(value.tree, selectedNode.path)
      : null;
  const crumbs: Breadcrumb[] = [
    { label: '学习概览', route: { kind: 'course' } },
  ];

  if (selectedNode.kind === 'roadmap') {
    crumbs.push({ label: 'Roadmap' });
  } else {
    crumbs.push({ label: 'Roadmap', route: { kind: 'course-roadmap' } });
    if (plan) {
      crumbs.push(selectedNode.kind === 'plan'
        ? { label: plan.title }
        : {
          label: plan.title,
          route: { kind: 'course-plan', planId: plan.id },
        });
    }
    if (selectedNode.kind === 'lesson') crumbs.push({ label: selectedNode.title });
  }

  return (
    <nav className="workspace-breadcrumbs" aria-label="课程位置">
      <span className="breadcrumb-trail">
        {crumbs.map((crumb, index) => (
          <span className="breadcrumb-part" key={`${crumb.label}-${index}`}>
            {index > 0 && <span className="breadcrumb-separator" aria-hidden="true">›</span>}
            {crumb.route ? (
              <a href={formatBrowserRoute(crumb.route)}>{crumb.label}</a>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </span>
        ))}
      </span>
      <span className="breadcrumb-status" data-status={selectedNode.status}>
        <i aria-hidden="true" />
        {statusLabel[selectedNode.status]}
      </span>
    </nav>
  );
}

export default WorkspaceBreadcrumbs;

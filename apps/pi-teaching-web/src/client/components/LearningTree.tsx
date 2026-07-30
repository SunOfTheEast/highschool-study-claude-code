import type {
  NodeLifecycleStatus,
  PublicTreeEntry,
} from '../../shared/contracts';
import type { ReactNode } from 'react';

const statusLabel: Record<NodeLifecycleStatus, string> = {
  candidate: '可能的下一步',
  prepared: '待开始',
  active: '正在学习',
  paused: '已暂停',
  closed: '已完成',
  completed: '已完成',
  abandoned: '已归档',
};

function publicNodeTitle(entry: PublicTreeEntry): string {
  if (entry.status === 'candidate') return '可能的下一步';
  if (entry.kind === 'lesson' && entry.status === 'prepared') {
    return '准备好的下一课';
  }
  return entry.title ?? entry.publicPurpose;
}

function OrderNotes({ entry }: { entry: PublicTreeEntry }) {
  if (!entry.after && entry.dependsOn.length === 0) return null;
  return (
    <p className="learning-tree-order">
      {entry.after && <span>接续 {entry.after}</span>}
      {entry.dependsOn.length > 0 && (
        <span>依赖 {entry.dependsOn.join('、')}</span>
      )}
    </p>
  );
}

function TreeNode({
  entry,
  selected,
  onOpen,
  children,
}: {
  entry: PublicTreeEntry;
  selected: boolean;
  onOpen(): void;
  children?: ReactNode;
}) {
  const copy = (
    <>
      <span className="learning-tree-marker" aria-hidden="true" />
      <span className="learning-tree-copy">
        <small>{statusLabel[entry.status]}</small>
        <strong>{publicNodeTitle(entry)}</strong>
        <span>{entry.publicPurpose}</span>
        <OrderNotes entry={entry} />
      </span>
    </>
  );

  return (
    <li
      className="learning-tree-node"
      data-kind={entry.kind}
      data-status={entry.status}
    >
      {entry.status === 'candidate' || entry.nodeId === null ? (
        <div className="learning-tree-entry candidate-entry" data-node={entry.handle}>
          {copy}
        </div>
      ) : (
        <button
          type="button"
          className="learning-tree-entry"
          data-node={entry.handle}
          aria-current={selected ? 'page' : undefined}
          onClick={onOpen}
        >
          {copy}
        </button>
      )}
      {children}
    </li>
  );
}

export function LearningTree({
  roadmapTitle,
  planTree,
  currentPlanId,
  lessonTree = [],
  selectedKey,
  onRoadmap,
  onPlan,
  onLesson,
}: {
  roadmapTitle: string;
  planTree: PublicTreeEntry[];
  currentPlanId: string | null;
  lessonTree?: PublicTreeEntry[];
  selectedKey: string | null;
  onRoadmap(): void;
  onPlan(planId: string): void;
  onLesson(planId: string, lessonId: string): void;
}) {
  return (
    <nav className="learning-tree" aria-label="课程学习树">
      <ol className="learning-tree-root">
        <li className="learning-tree-roadmap" data-kind="roadmap">
          <button
            type="button"
            className="learning-tree-entry roadmap-tree-entry"
            aria-current={selectedKey === 'roadmap' ? 'page' : undefined}
            onClick={onRoadmap}
          >
            <span className="learning-tree-marker" aria-hidden="true" />
            <span className="learning-tree-copy">
              <small>Roadmap · 学习总览</small>
              <strong>{roadmapTitle}</strong>
              <span>长期目标与学习周期</span>
            </span>
          </button>
          <ol className="learning-tree-plans">
            {planTree.map((plan) => {
              const isCurrent = plan.nodeId === currentPlanId;
              return (
                <TreeNode
                  key={plan.handle}
                  entry={plan}
                  selected={selectedKey === `plan:${plan.nodeId}`}
                  onOpen={() => {
                    if (plan.nodeId) onPlan(plan.nodeId);
                  }}
                >
                  {isCurrent && lessonTree.length > 0 && (
                    <ol className="learning-tree-lessons">
                      {lessonTree.map((lesson) => (
                        <TreeNode
                          key={lesson.handle}
                          entry={lesson}
                          selected={selectedKey === `lesson:${lesson.nodeId}`}
                          onOpen={() => {
                            if (currentPlanId && lesson.nodeId) {
                              onLesson(currentPlanId, lesson.nodeId);
                            }
                          }}
                        />
                      ))}
                    </ol>
                  )}
                </TreeNode>
              );
            })}
          </ol>
        </li>
      </ol>
    </nav>
  );
}

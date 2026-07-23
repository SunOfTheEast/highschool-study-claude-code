import type { WorkflowView } from '../../shared/contracts';

const glyph = {
  queued: '○',
  running: '◐',
  completed: '●',
  failed: '×',
  blocked: '—',
  cancelled: '·',
} as const;

export function TaskRail({
  workflows,
  onAction,
}: {
  workflows: WorkflowView[];
  onAction(id: string, action: 'confirm' | 'cancel'): Promise<void>;
}) {
  if (workflows.length === 0) return null;
  return (
    <aside className="task-rail" aria-label="深度工作流">
      {workflows.map((workflow) => {
        const completed = workflow.tasks.filter((task) => task.status === 'completed').length;
        const running = workflow.tasks.filter((task) => task.status === 'running').length;
        const active = workflow.status === 'proposed' || workflow.status === 'running';
        return (
          <details
            className="workflow"
            data-status={workflow.status}
            open={active || workflow.status === 'cancelled'}
            key={workflow.id}
          >
            <summary className="workflow-summary">
              <span>{workflow.mode === 'quick' ? 'Quick' : 'Deep'}</span>
              <strong>{workflow.goal}</strong>
              <small>
                {completed}/{workflow.tasks.length} 已完成
                {running > 0 ? ` · ${running} 运行中` : ''}
              </small>
            </summary>
            <div className="workflow-budget">
              <span>并发 {workflow.maxConcurrency}</span>
              <span>{workflow.tokenLimit.toLocaleString('en-US')} Token</span>
              <span>{Math.ceil(workflow.timeoutMs / 1000)} 秒</span>
            </div>
            <ol>
              {workflow.tasks.map((task) => (
                <li className="workflow-task" data-status={task.status} key={task.id}>
                  <i aria-hidden="true">{glyph[task.status]}</i>
                  <span>
                    <b>{task.label}</b>
                    <small>{task.role}</small>
                  </span>
                  <span>
                    <em>{task.progress}</em>
                    <small>
                      {task.dependsOn.length > 0 ? `依赖 ${task.dependsOn.join(', ')}` : '无依赖'}
                      {' · '}
                      {task.cardCount > 0 ? `${task.cardCount} 张题卡 · ` : ''}
                      {task.sourceCount} 个来源
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            {active && (
              <footer>
                {workflow.mode === 'deep' && workflow.status === 'proposed' && (
                  <button
                    type="button"
                    className="workflow-confirm"
                    onClick={() => void onAction(workflow.id, 'confirm')}
                  >
                    确认运行
                  </button>
                )}
                <button
                  type="button"
                  className="workflow-cancel"
                  onClick={() => void onAction(workflow.id, 'cancel')}
                >
                  取消
                </button>
              </footer>
            )}
          </details>
        );
      })}
    </aside>
  );
}

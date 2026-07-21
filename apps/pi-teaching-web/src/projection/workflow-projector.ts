import type { WorkflowView } from '../shared/contracts';
import type { WorkflowSnapshot } from '../workflows/contracts';

const progress = {
  queued: '等待前序任务',
  running: '正在分析',
  completed: '分析完成',
  failed: '分析失败',
  blocked: '前序结果缺失',
  cancelled: '已取消',
} as const;

export function projectWorkflow(snapshot: WorkflowSnapshot): WorkflowView {
  return {
    id: snapshot.id,
    goal: snapshot.goal,
    mode: snapshot.mode,
    status: snapshot.status,
    maxConcurrency: snapshot.maxConcurrency,
    tokenLimit: snapshot.tokenLimit,
    timeoutMs: snapshot.timeoutMs,
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      label: task.label,
      role: task.role,
      dependsOn: task.dependsOn,
      status: task.status,
      sourceCount: task.result?.evidence_refs.length ?? task.sourceHandles.length,
      progress: progress[task.status],
    })),
  };
}

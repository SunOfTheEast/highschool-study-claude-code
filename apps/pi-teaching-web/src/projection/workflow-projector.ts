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

function currentActivity(status: WorkflowSnapshot['tasks'][number]['status'], tool: string | null): string {
  if (status !== 'running') return progress[status];
  const normalized = (tool ?? '').toLowerCase();
  if (normalized.includes('card_search')) return '正在检索题卡';
  if (normalized.includes('trace_search')) return '正在检索 Trace';
  if (normalized === 'read' || normalized.endsWith('.read')) return '正在读取来源';
  if (normalized.includes('grep') || normalized.includes('find')) return '正在定位来源';
  return '正在分析';
}

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
      cardCount: task.result?.card_index?.length ?? 0,
      progress: progress[task.status],
      durationMs: task.durationMs,
      tokens: task.tokens,
      toolCount: task.toolCount,
      currentActivity: currentActivity(task.status, task.currentTool),
    })),
  };
}

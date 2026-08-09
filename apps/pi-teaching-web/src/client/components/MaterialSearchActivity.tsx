import { useEffect, useState, type ReactElement } from 'react';
import type {
  MaterialSearchConversationItem,
  MaterialSearchPhase,
} from '../../shared/contracts';

const phaseCopy: Record<MaterialSearchPhase, string> = {
  starting: '正在启动材料检索',
  filtering: '正在筛选材料',
  inspecting: '正在查看候选材料',
  comparing: '正在比较候选',
  done: '材料检索已完成',
  adjusting: '材料检索遇到问题，老师正在调整',
};

export function formatMaterialSearchElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}分${remainder}秒` : `${remainder}秒`;
}

export function MaterialSearchActivity({
  item,
}: {
  item: MaterialSearchConversationItem;
}): ReactElement {
  const [elapsedMs, setElapsedMs] = useState(item.elapsedMs);

  useEffect(() => {
    setElapsedMs(item.elapsedMs);
    if (item.status !== 'running') return undefined;
    const base = item.elapsedMs;
    const started = Date.now();
    const interval = window.setInterval(() => {
      setElapsedMs(base + Date.now() - started);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [item.elapsedMs, item.status, item.updatedAt]);

  return (
    <div
      className="material-search-activity"
      data-status={item.status}
      role="status"
    >
      <span className="material-search-pulse" aria-hidden="true" />
      <span className="material-search-copy">
        <strong>{phaseCopy[item.phase]}</strong>
        <small>
          {item.completed} / {item.total} 个检索任务已返回
          {' · '}{formatMaterialSearchElapsed(elapsedMs)}
          {' · '}{item.toolCount} 次操作
        </small>
      </span>
    </div>
  );
}

export default MaterialSearchActivity;

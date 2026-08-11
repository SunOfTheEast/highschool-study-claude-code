import type { ReactElement } from 'react';
import type { PaperResearchConversationItem } from '../../shared/contracts';

const copy = {
  searching: '正在查找相关论文资料',
  checking: '正在核对论文与问题的联系',
  done: '论文资料已返回，老师正在把它接回当前问题',
  unavailable: '暂时没有找到合适的论文资料',
} as const;

export function PaperResearchActivity({
  item,
}: {
  item: PaperResearchConversationItem;
}): ReactElement {
  return (
    <div className="paper-research-activity" data-status={item.status} role="status">
      <span className="material-search-pulse" aria-hidden="true" />
      <span>{copy[item.phase]}</span>
    </div>
  );
}

export default PaperResearchActivity;

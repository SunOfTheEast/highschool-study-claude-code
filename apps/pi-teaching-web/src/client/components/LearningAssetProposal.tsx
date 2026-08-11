import { useState, type ReactElement } from 'react';
import type {
  LearningAssetProposalConversationItem,
  LearningAssetSavedConversationItem,
} from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function LearningAssetProposal({
  item,
}: {
  item: LearningAssetProposalConversationItem;
}): ReactElement {
  const [revealed, setRevealed] = useState<number[]>([]);
  const revision = item.mode === 'revise' && item.targetRevision
    ? ` · 当前第 ${item.targetRevision} 版`
    : '';
  if (item.assetKind === 'problem-card') {
    return (
      <article className="learning-asset-proposal problem-card-proposal">
        <small>{item.mode === 'revise' ? '题卡修改草稿' : '题卡草稿'}{revision}</small>
        <MarkdownView>{item.stem}</MarkdownView>
        {item.studentNote && (
          <div className="proposal-student-note">
            <strong>你的笔记</strong>
            <MarkdownView>{item.studentNote}</MarkdownView>
          </div>
        )}
        <p className="proposal-answer-boundary">标准答案将随题卡保存，作答后可查看。</p>
      </article>
    );
  }
  return (
    <article className="learning-asset-proposal note-proposal">
      <small>{item.mode === 'revise' ? '笔记修改草稿' : '笔记草稿'}{revision}</small>
      <h3><MarkdownView inline>{item.title}</MarkdownView></h3>
      {item.blocks.map((block, index) => block.kind === 'markdown' ? (
        <MarkdownView key={index}>{block.body}</MarkdownView>
      ) : (
        <div className="m1b-recall" key={index}>
          <small>回忆一下</small>
          <MarkdownView>{block.prompt}</MarkdownView>
          {revealed.includes(index) ? (
            <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
          ) : (
            <button
              type="button"
              className="action-outline"
              onClick={() => setRevealed((current) => [...current, index])}
            >
              显示答案
            </button>
          )}
        </div>
      ))}
    </article>
  );
}

export function LearningAssetSavedReceipt({
  item,
}: {
  item: LearningAssetSavedConversationItem;
}): ReactElement {
  if (item.status === 'running') {
    return <div className="tool-receipt"><span>正在保存{item.assetKind === 'note' ? '笔记' : '题卡'}</span></div>;
  }
  if (item.status === 'error' || !item.asset) {
    return <div className="tool-receipt"><span>这次没有保存成功，草稿仍在对话里。</span></div>;
  }
  return (
    <div className="tool-receipt learning-asset-saved-receipt">
      <span>已保存为{item.asset.kind === 'note' ? '笔记' : '题卡'}</span>
      <a href={item.asset.route}>{item.asset.title}</a>
    </div>
  );
}

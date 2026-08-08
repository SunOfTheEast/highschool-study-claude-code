import type { LearningFootprintActivity, LearningFootprintSnapshot } from '../../shared/contracts';

const labels: Record<LearningFootprintActivity, string> = {
  'session-start': '开始学习',
  'session-continue': '继续学习',
  'asset-created': '保存内容',
  'asset-revised': '更新内容',
  'material-imported': '加入资料',
  'problem-attempt': '完成作答',
  'answer-reveal': '查看答案',
  'learning-history': '认知变化',
};

export function FootprintPage({
  value,
  onOpen,
}: {
  value: LearningFootprintSnapshot;
  onOpen(route: string): void;
}) {
  return (
    <main className="m1c-footprint-page">
      <header><small>Learning footprint</small><h1>学习足迹</h1></header>
      {value.entries.length === 0 ? (
        <p className="m1b-empty">还没有可以回看的学习活动。</p>
      ) : (
        <ol>
          {value.entries.map((entry) => (
            <li key={entry.id}>
              <small>{labels[entry.activity]}</small>
              <strong>{entry.title}</strong>
              <p>{entry.summary}</p>
              {entry.at && <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>}
              {entry.route && (
                <button type="button" onClick={() => onOpen(entry.route!)}>回到发生处</button>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

export default FootprintPage;

import type {
  LearningFootprintActivity,
  LearningFootprintEntry,
  LearningFootprintSnapshot,
} from '../../shared/contracts';

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

type FootprintCategory = 'session' | 'asset' | 'attempt' | 'cognition';

function category(entry: LearningFootprintEntry): FootprintCategory {
  if (entry.source.kind === 'session') return 'session';
  if (entry.source.kind === 'problem-activity') return 'attempt';
  if (entry.source.kind === 'object-memory') return 'cognition';
  return 'asset';
}

function actionLabel(entry: LearningFootprintEntry): string {
  if (entry.source.kind === 'session') {
    return entry.source.sessionKey.startsWith('free:') || entry.source.sessionKey.startsWith('meta:')
      ? '进入对话'
      : '进入课程';
  }
  if (entry.source.kind === 'material') return '打开资料';
  if (entry.source.kind === 'problem-activity') return '打开题卡';
  if (entry.source.kind === 'object-memory') return '回到这段学习';
  return entry.source.asset.kind === 'note' ? '打开笔记' : '打开题卡';
}

function newestFirst(left: LearningFootprintEntry, right: LearningFootprintEntry): number {
  if (left.at === null) return right.at === null ? left.id.localeCompare(right.id) : 1;
  if (right.at === null) return -1;
  return Date.parse(right.at) - Date.parse(left.at) || left.id.localeCompare(right.id);
}

export function FootprintPage({
  value,
  onOpen,
}: {
  value: LearningFootprintSnapshot;
  onOpen(route: string): void;
}) {
  const entries = [...value.entries].sort(newestFirst);
  return (
    <main className="m1c-footprint-page footprint-ledger">
      <header>
        <small>Learning footprint</small>
        <h1>学习足迹</h1>
        <p>这里记录真实发生过的学习活动，不替学习效果下结论。</p>
      </header>
      {entries.length === 0 ? (
        <p className="m1b-empty">还没有可以回看的学习活动。</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.id} data-category={category(entry)}>
              <i className="footprint-dot" aria-hidden="true" />
              <small>{labels[entry.activity]}</small>
              <strong>{entry.title}</strong>
              <p>{entry.summary}</p>
              {entry.at ? (
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              ) : <span className="footprint-time">时间未记录</span>}
              {entry.route && (
                <button type="button" className="action-text" onClick={() => onOpen(entry.route!)}>
                  {actionLabel(entry)}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

export default FootprintPage;

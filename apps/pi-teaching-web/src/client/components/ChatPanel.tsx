import { useState, type FormEvent } from 'react';
import type { ConversationItem, SessionKey } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';
import { LessonReviewActivity } from './LessonReviewActivity';
import { LessonHandoutActivity } from './LessonHandoutActivity';
import { MaterialSearchActivity } from './MaterialSearchActivity';

const toolStatus = {
  running: '进行中',
  done: '已完成',
  error: '失败',
} as const;

export function ChatPanel({
  sessionKey,
  items,
  running,
  error,
  enabled,
  onSend,
}: {
  sessionKey: SessionKey;
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  enabled: boolean;
  onSend(text: string): Promise<void>;
}) {
  const [text, setText] = useState('');
  const freeLearning = sessionKey.startsWith('free:');
  const backgroundTaskRunning = items.some((item) => (
    (
      item.kind === 'material-search'
      || item.kind === 'lesson-review'
      || item.kind === 'lesson-handout'
    )
    && item.status === 'running'
  ));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || running || !enabled) return;
    setText('');
    void onSend(value).catch(() => setText(value));
  };

  return (
    <section className="chat" aria-label="课堂对话">
      <header className="chat-header">
        <span>{freeLearning ? '自由学习' : sessionKey.startsWith('lesson:') ? '课堂对话' : '学习讨论'}</span>
        {!freeLearning && <code>{sessionKey}</code>}
      </header>
      <div className="timeline" aria-live="polite">
        {items.map((item) => {
          if (item.kind === 'material-search') {
            return <MaterialSearchActivity item={item} key={item.id} />;
          }
          if (item.kind === 'lesson-review') {
            return <LessonReviewActivity item={item} key={item.id} />;
          }
          if (item.kind === 'lesson-handout') {
            return <LessonHandoutActivity item={item} key={item.id} />;
          }
          if (item.kind === 'tool' && item.name === 'subagent') {
            return (
              <div className="subagent-activity" key={item.id}>
                <span>后台任务</span>
                <small data-status={item.status}>{toolStatus[item.status]}</small>
              </div>
            );
          }
          if (item.kind === 'tool') {
            return (
              <details className="tool-activity" key={item.id}>
                <summary>
                  <span>{item.name}</span>
                  <small data-status={item.status}>{toolStatus[item.status]}</small>
                </summary>
                <pre>{JSON.stringify(item.detail, null, 2)}</pre>
              </details>
            );
          }
          return (
            <article className={`message ${item.kind}`} key={item.id}>
              <span className="message-role">{item.kind === 'user' ? '你' : '老师'}</span>
              <div><MarkdownView>{item.text}</MarkdownView></div>
            </article>
          );
        })}
        {items.length === 0 && (
          <div className="empty-conversation">
            <span>从这里继续</span>
            <p>{freeLearning
              ? '问题可以很小，也可以发散。说出你此刻真正好奇或卡住的地方。'
              : '可以说说目标、具体卡点，或请老师先介绍这个学习集。'}</p>
          </div>
        )}
      </div>
      <div className="chat-feedback">
        {running && !backgroundTaskRunning && (
          <p className="work-status"><span />老师正在思考…</p>
        )}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={enabled
            ? freeLearning ? '从一个问题、联想或不确定的想法开始…' : '写下你的想法或解题过程…'
            : freeLearning ? '这个线程已经结束' : '开始这个节点后即可对话'}
          disabled={!enabled}
          rows={3}
        />
        <footer>
          <small>Markdown · LaTeX</small>
          <button type="submit" disabled={!enabled || running || !text.trim()}>
            发送 <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </form>
    </section>
  );
}

export default ChatPanel;

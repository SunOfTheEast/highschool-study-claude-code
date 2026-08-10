import { useState, type FormEvent } from 'react';
import type { ConversationItem, SessionKey } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';
import { LessonReviewActivity } from './LessonReviewActivity';
import { LessonHandoutActivity } from './LessonHandoutActivity';
import { MaterialSearchActivity } from './MaterialSearchActivity';
import {
  presentConversation,
  toolActivityCopy,
  waitingForTeacherCopy,
} from '../conversation-presentation';
import { publicErrorText, publicSessionErrorText } from '../public-errors';
import {
  usePeerPlayback,
  visibleConversationDuringPeer,
} from '../peer-playback';
import { PeerEmbodiment } from './PeerEmbodiment';

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
  connected = true,
  onSend,
}: {
  sessionKey: SessionKey;
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  enabled: boolean;
  connected?: boolean;
  onSend(text: string): Promise<void>;
}) {
  const [text, setText] = useState('');
  const freeLearning = sessionKey.startsWith('free:');
  const playback = usePeerPlayback(items, freeLearning);
  const presentedItems = presentConversation(items);
  const visibleItems = visibleConversationDuringPeer(
    presentedItems,
    playback.phase === 'idle' ? null : playback.item?.id ?? null,
  );
  const activityRunning = visibleItems.some((item) => (
    item.kind !== 'user' && item.kind !== 'assistant' && item.status === 'running'
  ));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || running || !enabled || !connected) return;
    playback.stop();
    setText('');
    void onSend(value).catch(() => setText(value));
  };

  return (
    <section className="chat" aria-label="课堂对话">
      <header className="chat-header">
        <span>{freeLearning ? '自由学习' : sessionKey.startsWith('lesson:') ? '课堂对话' : '学习讨论'}</span>
        {freeLearning && (
          <button
            className="peer-sound-toggle"
            type="button"
            aria-label={playback.muted ? '开启阿夏语音' : '静音阿夏'}
            onClick={playback.toggleMute}
          >
            {playback.muted ? '阿夏 · 已静音' : '阿夏 · 自动朗读'}
          </button>
        )}
      </header>
      {freeLearning && (
        <PeerEmbodiment
          item={playback.item}
          phase={playback.phase}
          mouth={playback.mouth}
          portraitUrl={playback.portraitUrl}
          muted={playback.muted}
          onStop={playback.stop}
          onToggleMute={playback.toggleMute}
        />
      )}
      <div className="timeline" aria-live="polite">
        {visibleItems.map((item) => {
          if (item.kind === 'peer') {
            return (
              <article className={`message peer ${item.status}`} key={item.id}>
                <span className="message-role">
                  {item.displayName}
                  <small>AI 同学</small>
                </span>
                <div>
                  {item.status === 'running'
                    ? <p className="peer-pending">阿夏正在想……</p>
                    : item.status === 'error'
                      ? <p className="peer-unavailable">阿夏暂时没接上</p>
                      : (
                        <MarkdownView onFormulaSpeak={playback.readFormula}>
                          {item.text ?? ''}
                        </MarkdownView>
                      )}
                </div>
              </article>
            );
          }
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
              <div className="tool-receipt" key={item.id}>
                <span>{toolActivityCopy(item)}</span>
                <small data-status={item.status}>{toolStatus[item.status]}</small>
              </div>
            );
          }
          return (
            <article className={`message ${item.kind}`} key={item.id}>
              <span className="message-role">{item.kind === 'user' ? '你' : '老师'}</span>
              <div><MarkdownView>{item.text}</MarkdownView></div>
            </article>
          );
        })}
        {visibleItems.length === 0 && !running && (
          <div className="empty-conversation">
            <span>从这里继续</span>
            <p>{freeLearning
              ? '问题可以很小，也可以发散。说出你此刻真正好奇或卡住的地方。'
              : '可以说说目标、具体卡点，或请老师先介绍这个学习集。'}</p>
          </div>
        )}
      </div>
      <div className="chat-feedback">
        {running && !activityRunning && playback.phase === 'idle' && (
          <p className="work-status"><span />{waitingForTeacherCopy(sessionKey)}</p>
        )}
        {error && (
          <p className="session-error" role="alert">
            {publicErrorText(error, publicSessionErrorText())}
          </p>
        )}
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
          <button type="submit" disabled={!enabled || !connected || running || !text.trim()}>
            发送 <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </form>
    </section>
  );
}

export default ChatPanel;

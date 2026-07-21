import { useState, type ReactNode } from 'react';
import type { ChatMessage, SessionKey } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function ChatPanel({
  sessionKey,
  messages,
  work,
  error,
  composerEnabled,
  gate,
  onSend,
}: {
  sessionKey: SessionKey;
  messages: ChatMessage[];
  work: string;
  error: string | undefined;
  composerEnabled: boolean;
  gate: ReactNode;
  onSend(text: string): Promise<void>;
}) {
  const [text, setText] = useState('');

  return (
    <section className="chat">
      <header className="chat-header">
        <span>当前输入只发送到</span>
        <strong>{sessionKey}</strong>
        <i className={composerEnabled ? 'live' : ''}>{composerEnabled ? '可对话' : '仅预览'}</i>
      </header>

      <div className="timeline">
        {gate}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <span className="message-role">
              {message.role === 'student' ? '你' : message.role === 'coach' ? 'Coach' : 'Tutor'}
            </span>
            <div><MarkdownView>{message.text}</MarkdownView></div>
          </article>
        ))}
        {!gate && messages.length === 0 && (
          <div className="empty-conversation">
            <span>从这里开始</span>
            <p>说说你现在的目标、卡住的地方，或者想先复盘哪一节课。</p>
          </div>
        )}
      </div>

      <div className="chat-feedback" aria-live="polite">
        {work && <p className="work-status"><span />{work}</p>}
        {error && <p className="session-error" role="alert">{error}</p>}
      </div>

      {composerEnabled && (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            if (!value) return;
            setText('');
            void onSend(value);
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下你的想法或解题过程…"
            rows={3}
          />
          <div className="composer-footer">
            <span>支持 Markdown 与 LaTeX</span>
            <button type="submit">发送 <i aria-hidden="true">↗</i></button>
          </div>
        </form>
      )}
    </section>
  );
}

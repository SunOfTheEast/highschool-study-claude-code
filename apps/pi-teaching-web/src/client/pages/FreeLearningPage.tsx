import type { ConversationItem, SessionKey } from '../../shared/contracts';
import { ChatPanel } from '../components/ChatPanel';

export type CarriedContextItem = {
  key: string;
  kind: string;
  title: string;
  detail: string;
};

export function FreeLearningPage({
  sessionKey,
  title = '自由学习',
  contexts = [],
  connected = true,
  status,
  items,
  running,
  error,
  onSend,
  onEnd,
  onStartFocus = null,
}: {
  sessionKey: SessionKey;
  title?: string;
  contexts?: CarriedContextItem[];
  connected?: boolean;
  status: 'active' | 'ended';
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  onSend(text: string): Promise<void>;
  onEnd(): Promise<void>;
  onStartFocus?: ((targetSeconds: 900 | 1500 | 2700) => Promise<void>) | null;
}) {
  return (
    <main className="free-learning-workspace letter-workspace">
      <header className="free-learning-heading">
        <div><small>Open conversation</small><h1>{title}</h1></div>
        {status === 'active' ? (
          <button type="button" disabled={running} onClick={() => void onEnd()}>
            结束这次自由学习
          </button>
        ) : <span>这个线程已经结束，可以随时开启新的讨论。</span>}
      </header>
      {contexts.length > 0 && (
        <aside className="carried-context" aria-label="本次对话上下文">
          <span>随身带入</span>
          <ul>{contexts.map((item) => (
            <li key={item.key}><small>{item.kind}</small>{item.title} · {item.detail}</li>
          ))}</ul>
        </aside>
      )}
      <ChatPanel
        sessionKey={sessionKey}
        items={items}
        running={running}
        error={error}
        enabled={status === 'active'}
        connected={connected}
        focusStart={status === 'active' ? onStartFocus : null}
        onSend={onSend}
      />
    </main>
  );
}

export default FreeLearningPage;

import type { ConversationItem, SessionKey } from '../../shared/contracts';
import { ChatPanel } from '../components/ChatPanel';

export function FreeLearningPage({
  sessionKey,
  status,
  items,
  running,
  error,
  onSend,
  onEnd,
}: {
  sessionKey: SessionKey;
  status: 'active' | 'ended';
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  onSend(text: string): Promise<void>;
  onEnd(): Promise<void>;
}) {
  return (
    <main className="free-learning-workspace">
      <header className="free-learning-heading">
        <div><small>Open conversation</small><h1>自由学习</h1></div>
        {status === 'active' ? (
          <button type="button" disabled={running} onClick={() => void onEnd()}>
            结束这次自由学习
          </button>
        ) : <span>这个线程已经结束，可以随时开启新的讨论。</span>}
      </header>
      <ChatPanel
        sessionKey={sessionKey}
        items={items}
        running={running}
        error={error}
        enabled={status === 'active'}
        onSend={onSend}
      />
    </main>
  );
}

export default FreeLearningPage;


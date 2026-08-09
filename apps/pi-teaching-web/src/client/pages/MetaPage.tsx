import type { ConversationItem, MetaSessionKey } from '../../shared/contracts';
import { ChatPanel } from '../components/ChatPanel';

export function MetaPage({
  sessionKey,
  items,
  running,
  error,
  hasCourse,
  connected = true,
  onSend,
  onEnterCourse,
}: {
  sessionKey: MetaSessionKey;
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  hasCourse: boolean;
  connected?: boolean;
  onSend(text: string): Promise<void>;
  onEnterCourse(): void;
}) {
  return (
    <main className="free-learning-workspace letter-workspace">
      <header className="free-learning-heading">
        <div><small>Long-term direction</small><h1>长期学习规划</h1></div>
        {hasCourse && (
          <button type="button" className="action-wash" onClick={onEnterCourse}>进入正式课程</button>
        )}
      </header>
      <ChatPanel
        sessionKey={sessionKey}
        items={items}
        running={running}
        error={error}
        enabled={!hasCourse}
        connected={connected}
        onSend={onSend}
      />
    </main>
  );
}

export default MetaPage;

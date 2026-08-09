import type { ConversationItem, MetaSessionKey } from '../../shared/contracts';
import { ChatPanel } from '../components/ChatPanel';

export function MetaPage({
  sessionKey,
  items,
  running,
  error,
  hasCourse,
  onSend,
  onEnterCourse,
}: {
  sessionKey: MetaSessionKey;
  items: ConversationItem[];
  running: boolean;
  error: string | null;
  hasCourse: boolean;
  onSend(text: string): Promise<void>;
  onEnterCourse(): void;
}) {
  return (
    <main className="free-learning-workspace">
      <header className="free-learning-heading">
        <div><small>Long-term direction</small><h1>长期学习规划</h1></div>
        {hasCourse && <button type="button" onClick={onEnterCourse}>进入 Roadmap</button>}
      </header>
      <ChatPanel
        sessionKey={sessionKey}
        items={items}
        running={running}
        error={error}
        enabled={!hasCourse}
        onSend={onSend}
      />
    </main>
  );
}

export default MetaPage;

import { expect, test } from 'bun:test';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { AppShell } from '../../src/client/components/AppShell';
import { FocusStartControl } from '../../src/client/components/FocusCycleControls';
import { projectConversationEntries } from '../../src/projection/conversation';
import {
  FOCUS_ENDED_MESSAGE_TYPE,
  FOCUS_STARTED_MESSAGE_TYPE,
} from '../../src/runtime/session-custom-messages';
import type { PublicFocusCycle } from '../../src/shared/contracts';

const focus: PublicFocusCycle = {
  sessionKey: 'free:free-001',
  targetSeconds: 1500,
  startedAt: '2026-08-12T08:00:00.000Z',
  status: 'running',
  elapsedSeconds: 300,
  remainingSeconds: 1200,
  expiresAt: '2026-08-12T08:25:00.000Z',
};

test('projects native time facts as quiet markers without internal identifiers', () => {
  const entries: SessionEntry[] = [
    {
      type: 'custom_message', id: 'start-entry', parentId: null,
      timestamp: '2026-08-12T08:00:00.000Z', customType: FOCUS_STARTED_MESSAGE_TYPE,
      content: 'private protocol', display: true,
      details: {
        cycleId: 'private-cycle', sessionKey: 'free:free-001', sessionId: 'private-session',
        targetSeconds: 1500, startedAt: '2026-08-12T08:00:00.000Z',
      },
    },
    {
      type: 'custom_message', id: 'end-entry', parentId: 'start-entry',
      timestamp: '2026-08-12T08:10:00.000Z', customType: FOCUS_ENDED_MESSAGE_TYPE,
      content: 'private protocol', display: true,
      details: {
        cycleId: 'private-cycle', sessionKey: 'free:free-001', sessionId: 'private-session',
        targetSeconds: 1500, elapsedSeconds: 600,
        endedAt: '2026-08-12T08:10:00.000Z', reason: 'manual',
      },
    },
  ];
  const items = projectConversationEntries('free:free-001', entries);
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-001"
      items={items}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup).toContain('开始了 25 分钟计时');
  expect(markup).toContain('本次计时已结束');
  expect(markup).not.toMatch(/private-cycle|private-session|studyforge\.m2|sessionKey/);
});

test('offers only three focus durations in an eligible chat and hides them after end', () => {
  const start = renderToStaticMarkup(
    <FocusStartControl expanded onStart={async () => {}} />,
  );
  expect(start).toContain('15 分钟');
  expect(start).toContain('25 分钟');
  expect(start).toContain('45 分钟');

  const ended = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-001"
      items={[]}
      running={false}
      error={null}
      enabled={false}
      focusStart={null}
      onSend={async () => {}}
    />,
  );
  expect(ended).not.toContain('开始专注');
});

test('keeps active focus in the application header without exposing ownership IDs', () => {
  const markup = renderToStaticMarkup(
    <AppShell
      title="化学学习集"
      activeView="assets"
      connection="open"
      hasCourse={false}
      focus={focus}
      onPauseFocus={async () => {}}
      onResumeFocus={async () => {}}
      onEndFocus={async () => {}}
      onNavigate={() => {}}
    >
      <main>题卡阅读页</main>
    </AppShell>,
  );

  expect(markup).toContain('专注中');
  expect(markup).toContain('20:00');
  expect(markup).toContain('题卡阅读页');
  expect(markup).not.toContain('free:free-001');
});

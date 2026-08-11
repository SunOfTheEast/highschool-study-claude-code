import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import {
  companionBubbleText,
  nextCompanionPresentation,
} from '../../src/client/companion/main-playback';
import type { CompanionBridge } from '../../src/client/companion/contracts';
import { DesktopToolsProvider } from '../../src/client/desktop/DesktopContext';
import type { PeerConversationItem } from '../../src/shared/contracts';

const at = '2026-08-11T08:00:00.000Z';

function peer(input: Partial<PeerConversationItem> = {}): PeerConversationItem {
  return {
    id: 'peer-1',
    kind: 'peer',
    actorId: 'peer-axia',
    displayName: '阿夏',
    status: 'done',
    text: '也许先比较一个反例。',
    move: 'challenge',
    expression: 'skeptical',
    delivery: 'live',
    at,
    ...input,
  };
}

function fakeBridge(): CompanionBridge {
  return {
    snapshot: async () => ({
      presentation: null,
      playback: { messageId: null, phase: 'idle', muted: false },
    }),
    present: async () => true,
    control: async () => true,
    setPlayback: async () => {},
    onPresentation: async () => () => {},
    onPlayback: async () => () => {},
    onControl: async () => () => {},
    showMain: async () => {},
    showCompanion: async () => {},
    hideCompanion: async () => {},
    quit: async () => {},
  };
}

test('publishes only a new live Axia item and never history', () => {
  const history = peer({ id: 'history', delivery: 'history' });
  const running = peer({ id: 'running', status: 'running', text: null, expression: 'curious' });
  const live = peer();

  expect(nextCompanionPresentation([history], new Set())).toBeNull();
  expect(nextCompanionPresentation([running], new Set())).toEqual({
    messageId: 'running',
    actorId: 'peer-axia',
    text: '',
    expression: 'curious',
    phase: 'thinking',
  });
  expect(nextCompanionPresentation([live], new Set())).toEqual({
    messageId: 'peer-1',
    actorId: 'peer-axia',
    text: '也许先比较一个反例。',
    expression: 'skeptical',
    phase: 'speaking',
  });
  expect(nextCompanionPresentation([live], new Set(['peer-1']))).toBeNull();
});

test('turns one Peer message into a bounded non-semantic bubble', () => {
  const text = `**我先说结论。** 这里真正需要比较的是两边的次数，而不是把公式逐字念出来。

\\[\\frac{x^2+1}{x+1}\\]

后面还有一大段只应该留在主窗口里的解释。`;
  const bubble = companionBubbleText(text);

  expect(bubble).toContain('我先说结论');
  expect(bubble.length).toBeLessThanOrEqual(58);
  expect(bubble).not.toContain('\\frac');
  expect(bubble).not.toContain('**');
});

test('desktop chat keeps Peer text but does not mount a second model', () => {
  const markup = renderToStaticMarkup(
    <DesktopToolsProvider value={{
      openSettings: () => {},
      openHelp: () => {},
      companion: fakeBridge(),
    }}>
      <ChatPanel
        sessionKey="free:free-session-001"
        items={[peer()]}
        running={false}
        error={null}
        enabled
        onSend={async () => {}}
      />
    </DesktopToolsProvider>,
  );

  expect(markup).toContain('阿夏');
  expect(markup).toContain('也许先比较一个反例。');
  expect(markup).not.toContain('peer-embodiment');
});

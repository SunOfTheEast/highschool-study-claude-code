import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import {
  deliverCompanionPresentation,
  companionBubbleText,
  nextCompanionPresentation,
} from '../../src/client/companion/main-playback';
import {
  companionRuntimeDecision,
  CompanionRoot,
} from '../../src/client/companion/CompanionRoot';
import type { CompanionBridge } from '../../src/client/companion/contracts';
import { DesktopToolsProvider } from '../../src/client/desktop/DesktopContext';
import type { PeerConversationItem } from '../../src/shared/contracts';

const at = '2026-08-11T08:00:00.000Z';
const appRoot = join(import.meta.dir, '../..');

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

test('does not mount the companion model before its runtime transport is ready', () => {
  const markup = renderToStaticMarkup(<CompanionRoot />);

  expect(markup).toBe('');
});

test('keeps polling and reconfigures transport when the runtime port changes', () => {
  const first = companionRuntimeDecision({
    state: { status: 'ready', port: 65100, workspace: 'selected' },
    apiBase: 'http://127.0.0.1:65100',
    token: 'first-token',
    error: null,
  });
  const restarted = companionRuntimeDecision({
    state: { status: 'ready', port: 65101, workspace: 'selected' },
    apiBase: 'http://127.0.0.1:65101',
    token: 'second-token',
    error: null,
  });

  expect(first.ready).toBe(true);
  expect(first.delay).toBeGreaterThan(0);
  expect(first.transportKey).not.toBe(restarted.transportKey);
});

test('treats a rejected native presentation as an ordinary delivery failure', async () => {
  const bridge = fakeBridge();
  bridge.present = async () => { throw new Error('event channel closed'); };

  expect(await deliverCompanionPresentation(bridge, {
    messageId: 'peer-retry',
    actorId: 'peer-axia',
    text: '先检查定义域。',
    expression: 'neutral',
    phase: 'speaking',
  })).toBe(false);
});

test('keeps one control listener while playback state changes', () => {
  const root = readFileSync(
    join(appRoot, 'src/client/companion/CompanionRoot.tsx'),
    'utf8',
  );

  expect(root).toContain('const playbackRef = useRef(playback);');
  expect(root).not.toContain('}, [playback, presentation?.messageId]);');
});

test('makes formula speech part of the same interruptible playback owner', () => {
  const playback = readFileSync(join(appRoot, 'src/client/peer-playback.ts'), 'utf8');

  expect(playback).toContain('stopRef.current = systemSpeech(spoken) ?? (() => {});');
  expect(playback).not.toContain('    systemSpeech(spoken);');
});

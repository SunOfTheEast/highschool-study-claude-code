import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { PeerEmbodiment } from '../../src/client/components/PeerEmbodiment';
import {
  mouthForAmplitude,
  nextLivePeer,
  peerPresence,
  visibleConversationDuringPeer,
} from '../../src/client/peer-playback';
import type { ConversationItem, PeerConversationItem } from '../../src/shared/contracts';

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

test('selects each completed live Axia reply once and never selects history', () => {
  const history = peer({ id: 'history', delivery: 'history' });
  const running = peer({ id: 'running', status: 'running', text: null });
  const first = peer({ id: 'first' });
  const second = peer({ id: 'second' });
  const items: ConversationItem[] = [history, running, first, second];

  expect(nextLivePeer(items, new Set())).toEqual(first);
  expect(nextLivePeer(items, new Set(['first']))).toEqual(second);
  expect(nextLivePeer(items, new Set(['first', 'second']))).toBeNull();
  expect(nextLivePeer([history], new Set())).toBeNull();
});

test('withholds only items after the Peer while playback is active', () => {
  const items: ConversationItem[] = [
    { id: 'student', kind: 'user', text: '阿夏你怎么看？', at },
    peer(),
    { id: 'teacher', kind: 'assistant', text: '我接着说。', at },
  ];

  expect(visibleConversationDuringPeer(items, 'peer-1')).toEqual(items.slice(0, 2));
  expect(visibleConversationDuringPeer(items, null)).toEqual(items);
  expect(visibleConversationDuringPeer(items, 'missing')).toEqual(items);
});

test('maps a smoothed audio level to only three mouth states', () => {
  expect(mouthForAmplitude(0)).toBe('closed');
  expect(mouthForAmplitude(0.025)).toBe('half');
  expect(mouthForAmplitude(0.09)).toBe('open');
});

test('projects one calm, thinking, or speaking presence from existing Peer facts', () => {
  const idle = { item: null, phase: 'idle' as const, mouth: 'closed' as const };
  const running = peer({ status: 'running', text: null, expression: 'curious' });

  expect(peerPresence([], idle)).toEqual({
    phase: 'calm', expression: 'neutral', mouth: 'closed',
  });
  expect(peerPresence([running], idle)).toEqual({
    phase: 'thinking', expression: 'curious', mouth: 'closed',
  });
  expect(peerPresence([peer()], {
    item: peer(), phase: 'speaking', mouth: 'half',
  })).toEqual({
    phase: 'speaking', expression: 'skeptical', mouth: 'half',
  });
});

test('keeps a restrained stage present in calm and adds controls only for active audio', () => {
  const calm = renderToStaticMarkup(
    <PeerEmbodiment
      state={{ phase: 'calm', expression: 'neutral', mouth: 'closed' }}
      playbackActive={false}
      muted={false}
      onStop={() => {}}
      onToggleMute={() => {}}
    />,
  );
  const thinking = renderToStaticMarkup(
    <PeerEmbodiment
      state={{ phase: 'thinking', expression: 'curious', mouth: 'closed' }}
      playbackActive={false}
      muted={false}
      onStop={() => {}}
      onToggleMute={() => {}}
    />,
  );
  const speaking = renderToStaticMarkup(
    <PeerEmbodiment
      state={{ phase: 'speaking', expression: 'skeptical', mouth: 'half' }}
      playbackActive
      muted={false}
      onStop={() => {}}
      onToggleMute={() => {}}
    />,
  );

  expect(calm).toContain('class="peer-embodiment"');
  expect(calm).not.toContain('peer-embodiment-caption');
  expect(calm).not.toContain('停止阿夏语音');
  expect(thinking).toContain('阿夏在想');
  expect(thinking).not.toContain('停止阿夏语音');
  expect(speaking).toContain('data-expression="skeptical"');
  expect(speaking).toContain('data-mouth="half"');
  expect(speaking).toContain('阿夏正在说');
  expect(speaking).toContain('aria-label="停止阿夏语音"');
  expect(speaking).toContain('aria-label="静音阿夏"');
  expect(speaking).not.toContain('<img');
  expect(speaking).not.toContain('undefined');
});

test('never mounts the Peer stage outside Free Learning', () => {
  const course = renderToStaticMarkup(
    <ChatPanel
      sessionKey="plan:plan-001"
      items={[]}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );
  const ended = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-session-001"
      items={[]}
      running={false}
      error={null}
      enabled={false}
      onSend={async () => {}}
    />,
  );

  expect(course).not.toContain('peer-embodiment');
  expect(ended).not.toContain('peer-embodiment');
});

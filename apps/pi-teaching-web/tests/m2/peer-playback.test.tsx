import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PeerEmbodiment } from '../../src/client/components/PeerEmbodiment';
import {
  mouthForAmplitude,
  nextLivePeer,
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

test('renders a restrained accessible stage without a broken image URL', () => {
  const markup = renderToStaticMarkup(
    <PeerEmbodiment
      item={peer()}
      phase="speaking"
      mouth="half"
      portraitUrl={null}
      muted={false}
      onStop={() => {}}
      onToggleMute={() => {}}
    />,
  );

  expect(markup).toContain('class="peer-embodiment"');
  expect(markup).toContain('data-expression="skeptical"');
  expect(markup).toContain('data-mouth="half"');
  expect(markup).toContain('阿夏正在说');
  expect(markup).toContain('aria-label="停止阿夏语音"');
  expect(markup).toContain('aria-label="静音阿夏"');
  expect(markup).not.toContain('<img');
  expect(markup).not.toContain('undefined');
});

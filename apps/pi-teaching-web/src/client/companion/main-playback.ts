import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConversationItem,
  PeerConversationItem,
} from '../../shared/contracts';
import { automaticPeerSpeech } from '../../shared/peer-speech';
import {
  nextLivePeer,
  type PeerPlaybackView,
} from '../peer-playback';
import type {
  CompanionBridge,
  CompanionPlayback,
  CompanionPresentation,
} from './contracts';

const publishedLivePeers = new Set<string>();

export function nextCompanionPresentation(
  items: readonly ConversationItem[],
  attempted: ReadonlySet<string>,
): CompanionPresentation | null {
  const running = items.findLast((item): item is PeerConversationItem => (
    item.kind === 'peer'
    && item.actorId === 'peer-axia'
    && item.delivery === 'live'
    && item.status === 'running'
  ));
  if (running) {
    return {
      messageId: running.id,
      actorId: 'peer-axia',
      text: '',
      expression: running.expression,
      phase: 'thinking',
    };
  }

  const completed = nextLivePeer(items, attempted);
  return completed ? {
    messageId: completed.id,
    actorId: 'peer-axia',
    text: completed.text ?? '',
    expression: completed.expression,
    phase: 'speaking',
  } : null;
}

export function companionBubbleText(text: string): string {
  const plain = automaticPeerSpeech(text)
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 58 ? `${plain.slice(0, 57).trimEnd()}…` : plain;
}

export async function deliverCompanionPresentation(
  bridge: CompanionBridge,
  presentation: CompanionPresentation,
): Promise<boolean> {
  try {
    return await bridge.present(presentation);
  } catch {
    return false;
  }
}

type RemoteState = Pick<PeerPlaybackView, 'item' | 'phase' | 'mouth'>;

function matchingPeer(
  items: readonly ConversationItem[],
  messageId: string,
): PeerConversationItem | null {
  return items.find((item): item is PeerConversationItem => (
    item.kind === 'peer' && item.id === messageId
  )) ?? null;
}

export function useCompanionPeerPlayback(
  items: readonly ConversationItem[],
  enabled: boolean,
  bridge: CompanionBridge,
): PeerPlaybackView {
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<RemoteState>({
    item: null,
    phase: 'idle',
    mouth: 'closed',
  });
  const stateRef = useRef(state);
  const publishedRef = useRef<string | null>(null);
  stateRef.current = state;

  const applyPlayback = useCallback((playback: CompanionPlayback) => {
    setMuted(playback.muted);
    const current = stateRef.current;
    if (playback.phase === 'idle') {
      if (!playback.messageId || current.item?.id === playback.messageId) {
        setState({ item: null, phase: 'idle', mouth: 'closed' });
      }
      return;
    }
    if (!playback.messageId || current.item?.id !== playback.messageId) return;
    setState({ ...current, phase: playback.phase, mouth: 'closed' });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void bridge.snapshot().then((snapshot) => {
      if (!disposed) applyPlayback(snapshot.playback);
    });
    void bridge.onPlayback(applyPlayback).then((next) => {
      if (disposed) next();
      else unlisten = next;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [applyPlayback, bridge]);

  useEffect(() => {
    if (!enabled) {
      publishedRef.current = null;
      setState({ item: null, phase: 'idle', mouth: 'closed' });
      void bridge.control({ action: 'stop' });
      void bridge.present(null);
      return;
    }

    const presentation = nextCompanionPresentation(items, publishedLivePeers);
    if (!presentation) return;
    const signature = `${presentation.messageId}:${presentation.phase}`;
    if (publishedRef.current === signature) return;
    publishedRef.current = signature;

    const item = matchingPeer(items, presentation.messageId);
    if (!item) return;
    setState({ item, phase: 'loading', mouth: 'closed' });
    void deliverCompanionPresentation(bridge, presentation).then((delivered) => {
      if (delivered) {
        if (presentation.phase === 'speaking') publishedLivePeers.add(presentation.messageId);
        return;
      }
      if (publishedRef.current === signature) publishedRef.current = null;
      if (stateRef.current.item?.id === presentation.messageId) {
        setState({ item: null, phase: 'idle', mouth: 'closed' });
      }
    });
  }, [bridge, enabled, items]);

  useEffect(() => () => {
    void bridge.control({ action: 'stop' });
    void bridge.present(null);
  }, [bridge]);

  const stop = useCallback(() => {
    void bridge.control({ action: 'stop' });
  }, [bridge]);
  const toggleMute = useCallback(() => {
    void bridge.control({ action: 'toggle-mute' });
  }, [bridge]);
  const readFormula = useCallback((tex: string) => {
    void bridge.control({ action: 'speak-formula', tex });
  }, [bridge]);

  return { ...state, muted, stop, toggleMute, readFormula };
}

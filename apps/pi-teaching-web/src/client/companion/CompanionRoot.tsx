import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationItem, PeerExpression } from '../../shared/contracts';
import { configureTransport } from '../transport';
import { peerPresence, usePeerPlayback } from '../peer-playback';
import {
  tauriDesktopBridge,
  type RuntimeConnection,
} from '../desktop/bridge';
import { tauriCompanionBridge } from './bridge';
import type {
  CompanionControl,
  CompanionPlayback,
  CompanionPresentation,
} from './contracts';
import { CompanionStage } from './CompanionStage';

function expression(value: string): PeerExpression {
  return value === 'curious' || value === 'skeptical' ? value : 'neutral';
}

function conversation(presentation: CompanionPresentation | null): ConversationItem[] {
  if (!presentation) return [];
  return [{
    id: presentation.messageId,
    kind: 'peer',
    actorId: 'peer-axia',
    displayName: '阿夏',
    status: presentation.phase === 'thinking' ? 'running' : 'done',
    text: presentation.phase === 'thinking' ? null : presentation.text,
    move: 'association',
    expression: expression(presentation.expression),
    delivery: 'live',
    at: '',
  }];
}

type CompanionRuntimeDecision =
  | {
    ready: true;
    delay: number;
    transportKey: string;
    apiBase: string;
    token: string;
  }
  | {
    ready: false;
    delay: number;
    transportKey: null;
  };

export function companionRuntimeDecision(
  connection: RuntimeConnection,
): CompanionRuntimeDecision {
  if (connection.state.status === 'ready' && connection.apiBase && connection.token) {
    return {
      ready: true,
      delay: 1000,
      transportKey: `${connection.apiBase}\u0000${connection.token}`,
      apiBase: connection.apiBase,
      token: connection.token,
    };
  }
  return {
    ready: false,
    delay: connection.state.status === 'starting' ? 180 : 500,
    transportKey: null,
  };
}

export function CompanionRoot() {
  const [ready, setReady] = useState(false);
  const [presentation, setPresentation] = useState<CompanionPresentation | null>(null);
  const items = useMemo(() => conversation(presentation), [presentation]);
  const playback = usePeerPlayback(items, ready && presentation !== null);
  const observedActive = useRef<string | null>(null);
  const playbackRef = useRef(playback);
  const presentationRef = useRef(presentation);
  playbackRef.current = playback;
  presentationRef.current = presentation;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let transportKey: string | null = null;
    const poll = async () => {
      let delay = 500;
      try {
        const connection = await tauriDesktopBridge.runtimeConnection();
        if (disposed) return;
        const decision = companionRuntimeDecision(connection);
        delay = decision.delay;
        if (decision.ready) {
          if (decision.transportKey !== transportKey) {
            configureTransport({ apiBase: decision.apiBase, token: decision.token });
            transportKey = decision.transportKey;
          }
          setReady(true);
        } else {
          transportKey = null;
          setReady(false);
        }
      } catch {
        if (!disposed) setReady(false);
      }
      if (!disposed) timer = setTimeout(poll, delay);
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void tauriCompanionBridge.onPresentation((value) => setPresentation(value)).then((next) => {
      if (disposed) {
        next();
        return;
      }
      unlisten = next;
      void tauriCompanionBridge.snapshot().then((snapshot) => {
        if (!disposed) setPresentation(snapshot.presentation);
      });
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!presentation || presentation.phase !== 'speaking') {
      observedActive.current = null;
      return;
    }
    if (playback.item?.id === presentation.messageId && playback.phase !== 'idle') {
      observedActive.current = presentation.messageId;
    }
  }, [playback.item?.id, playback.phase, presentation]);

  useEffect(() => {
    if (!presentation) {
      void tauriCompanionBridge.setPlayback({
        messageId: null,
        phase: 'idle',
        muted: playback.muted,
      });
      return;
    }

    let receipt: CompanionPlayback;
    let finished = false;
    if (presentation.phase === 'thinking') {
      receipt = { messageId: presentation.messageId, phase: 'loading', muted: playback.muted };
    } else if (playback.muted) {
      receipt = { messageId: presentation.messageId, phase: 'idle', muted: true };
      finished = true;
    } else if (playback.phase === 'idle') {
      finished = observedActive.current === presentation.messageId;
      receipt = {
        messageId: presentation.messageId,
        phase: finished ? 'idle' : 'loading',
        muted: false,
      };
    } else {
      receipt = {
        messageId: presentation.messageId,
        phase: playback.phase,
        muted: false,
      };
    }

    void tauriCompanionBridge.setPlayback(receipt).then(() => {
      if (finished) setPresentation((current) => (
        current?.messageId === presentation.messageId ? null : current
      ));
    });
  }, [playback.muted, playback.phase, presentation]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const handle = (control: CompanionControl) => {
      const currentPlayback = playbackRef.current;
      if (control.action === 'toggle-mute') currentPlayback.toggleMute();
      else if (control.action === 'speak-formula') currentPlayback.readFormula(control.tex);
      else {
        currentPlayback.stop();
        const messageId = presentationRef.current?.messageId ?? null;
        void tauriCompanionBridge.setPlayback({
          messageId,
          phase: 'idle',
          muted: currentPlayback.muted,
        });
        setPresentation(null);
      }
    };
    void tauriCompanionBridge.onControl(handle).then((next) => {
      if (disposed) next();
      else unlisten = next;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!ready) return null;

  const presence = peerPresence(items, playback);
  return (
    <CompanionStage
      text={presentation?.text ?? ''}
      state={presence}
      playback={playback}
    />
  );
}

export default CompanionRoot;

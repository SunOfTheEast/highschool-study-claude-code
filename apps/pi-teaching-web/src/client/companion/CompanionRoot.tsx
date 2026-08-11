import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationItem, PeerExpression } from '../../shared/contracts';
import { configureTransport } from '../transport';
import { peerPresence, usePeerPlayback } from '../peer-playback';
import { tauriDesktopBridge } from '../desktop/bridge';
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

export function CompanionRoot() {
  const [ready, setReady] = useState(false);
  const [presentation, setPresentation] = useState<CompanionPresentation | null>(null);
  const items = useMemo(() => conversation(presentation), [presentation]);
  const playback = usePeerPlayback(items, ready && presentation !== null);
  const observedActive = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const connection = await tauriDesktopBridge.runtimeConnection();
        if (disposed) return;
        if (connection.state.status === 'ready' && connection.apiBase && connection.token) {
          configureTransport({ apiBase: connection.apiBase, token: connection.token });
          setReady(true);
          return;
        }
        if (connection.state.status === 'starting') timer = setTimeout(poll, 180);
      } catch {
        if (!disposed) timer = setTimeout(poll, 500);
      }
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
      if (control.action === 'toggle-mute') playback.toggleMute();
      else if (control.action === 'speak-formula') playback.readFormula(control.tex);
      else {
        playback.stop();
        const messageId = presentation?.messageId ?? null;
        void tauriCompanionBridge.setPlayback({
          messageId,
          phase: 'idle',
          muted: playback.muted,
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
  }, [playback, presentation?.messageId]);

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

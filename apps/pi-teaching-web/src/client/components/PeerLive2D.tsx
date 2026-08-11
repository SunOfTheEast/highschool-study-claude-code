import { useEffect, useRef, type ReactElement } from 'react';
import { bootstrapPeerLive2D } from '../live2d/bootstrap';
import type { PeerLive2DRenderer, PeerVisualState } from '../live2d/contracts';

const calm: PeerVisualState = {
  phase: 'calm', expression: 'neutral', mouth: 'closed',
};

export function PeerLive2D({
  state,
  onReady,
  onFailure,
}: {
  state: PeerVisualState;
  onReady(ready: boolean): void;
  onFailure(): void;
}): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PeerLive2DRenderer | null>(null);
  const stateRef = useRef(state);
  const onReadyRef = useRef(onReady);
  const onFailureRef = useRef(onFailure);
  stateRef.current = state;
  onReadyRef.current = onReady;
  onFailureRef.current = onFailure;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new AbortController();
    let disposed = false;

    void bootstrapPeerLive2D({
      host,
      state: stateRef.current,
      signal: controller.signal,
      onFailure: () => onFailureRef.current(),
    }).then((renderer) => {
      if (!renderer || disposed) {
        renderer?.destroy();
        return;
      }
      rendererRef.current = renderer;
      renderer.setState(stateRef.current);
      if (document.hidden) renderer.setPaused(true);
      onReadyRef.current(true);
    });

    return () => {
      disposed = true;
      controller.abort();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    const onVisibility = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      if (document.hidden) {
        renderer.setPaused(true);
        return;
      }
      renderer.setState(calm);
      renderer.setPaused(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return <div ref={hostRef} className="peer-live2d" aria-hidden="true" />;
}

export default PeerLive2D;

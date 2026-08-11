import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PeerVisualState } from '../live2d/contracts';
import { PeerLive2D } from './PeerLive2D';

export function PeerEmbodiment({
  state,
  playbackActive,
  muted,
  onStop,
  onToggleMute,
}: {
  state: PeerVisualState;
  playbackActive: boolean;
  muted: boolean;
  onStop(): void;
  onToggleMute(): void;
}) {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [live2DReady, setLive2DReady] = useState(false);
  const [live2DFailed, setLive2DFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setPortraitUrl(null);
    void api.peerPortrait('peer-axia', state.expression).then((blob) => {
      if (!active || !blob) return;
      createdUrl = URL.createObjectURL(blob);
      setPortraitUrl(createdUrl);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [state.expression]);

  return (
    <aside
      className="peer-embodiment"
      data-expression={state.expression}
      data-mouth={state.mouth}
      data-phase={state.phase}
      data-live2d-ready={live2DReady || undefined}
      aria-label="阿夏"
    >
      <div className="peer-portrait" aria-hidden="true">
        <div className="peer-static" hidden={live2DReady}>
          {portraitUrl
            ? <img src={portraitUrl} alt="" />
            : <span className="peer-portrait-placeholder"><i>夏</i></span>}
          {portraitUrl && state.phase === 'speaking' && <span className="peer-mouth" />}
        </div>
        {!live2DFailed && (
          <PeerLive2D
            state={state}
            onReady={setLive2DReady}
            onFailure={() => {
              setLive2DReady(false);
              setLive2DFailed(true);
            }}
          />
        )}
      </div>
      {state.phase !== 'calm' && (
        <div className="peer-embodiment-caption">
          <span>{state.phase === 'thinking' ? '阿夏在想' : '阿夏正在说'}</span>
          {playbackActive && (
            <div>
              <button type="button" aria-label="停止阿夏语音" onClick={onStop}>停止</button>
              <button
                type="button"
                aria-label={muted ? '开启阿夏语音' : '静音阿夏'}
                onClick={onToggleMute}
              >
                {muted ? '开声' : '静音'}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export default PeerEmbodiment;

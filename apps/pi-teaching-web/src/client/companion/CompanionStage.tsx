import { useRef, useState, type MouseEvent } from 'react';
import type { PeerVisualState } from '../live2d/contracts';
import type { PeerPlaybackView } from '../peer-playback';
import { PeerEmbodiment } from '../components/PeerEmbodiment';
import { tauriCompanionBridge } from './bridge';
import { companionBubbleText } from './main-playback';
import { useCompanionWindowControls } from './window-controls';

export function CompanionStage({
  text,
  state,
  playback,
}: {
  text: string;
  state: PeerVisualState;
  playback: PeerPlaybackView;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const controls = useCompanionWindowControls(targetRef, menuRef);
  const bubble = state.phase === 'speaking' ? companionBubbleText(text) : '';
  const openMenu = (event: MouseEvent) => {
    event.preventDefault();
    setMenu({
      x: Math.min(event.clientX, 194),
      y: Math.min(event.clientY, 404),
    });
  };
  return (
    <main className="companion-stage" data-phase={state.phase} onPointerDown={() => setMenu(null)}>
      {bubble && <p className="companion-bubble">{bubble}</p>}
      <PeerEmbodiment
        state={state}
        playbackActive={playback.phase !== 'idle'}
        muted={playback.muted}
        onStop={playback.stop}
        onToggleMute={playback.toggleMute}
      />
      <div
        ref={targetRef}
        className="companion-hit-target"
        aria-label="阿夏桌宠"
        onDoubleClick={() => void tauriCompanionBridge.showMain()}
        onContextMenu={openMenu}
        onPointerDown={(event) => {
          event.stopPropagation();
          controls.onPointerDown(event);
        }}
        onPointerMove={controls.onPointerMove}
        onPointerUp={controls.onPointerUp}
        onPointerCancel={controls.onPointerUp}
      />
      {menu && (
        <div
          ref={menuRef}
          className="companion-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={playback.toggleMute}>
            {playback.muted ? '开声' : '静音'}
          </button>
          <button type="button" role="menuitem" onClick={() => void tauriCompanionBridge.hideCompanion()}>
            隐藏桌宠
          </button>
          <button type="button" role="menuitem" onClick={() => void tauriCompanionBridge.quit()}>
            退出 StudyForge
          </button>
        </div>
      )}
    </main>
  );
}

export default CompanionStage;

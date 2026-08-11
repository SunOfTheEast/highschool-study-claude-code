import type { PeerMouth } from '../peer-playback';
import type {
  PeerLive2DRenderer,
  PeerVisualDriver,
  PeerVisualState,
} from './contracts';

export function mouthTarget(mouth: PeerMouth): 0 | 0.45 | 1 {
  if (mouth === 'open') return 1;
  if (mouth === 'half') return 0.45;
  return 0;
}

export function createPeerVisualController(
  driver: PeerVisualDriver,
  initialState: PeerVisualState,
): PeerLive2DRenderer {
  let current = initialState;
  let paused = false;
  let destroyed = false;

  driver.setAttention(initialState.phase);
  driver.setExpression(initialState.expression);
  driver.setMouthTarget(mouthTarget(initialState.mouth));

  return {
    setState(next) {
      if (destroyed) return;
      if (next.phase !== current.phase) driver.setAttention(next.phase);
      if (next.expression !== current.expression) driver.setExpression(next.expression);
      if (next.mouth !== current.mouth) driver.setMouthTarget(mouthTarget(next.mouth));
      current = next;
    },
    setPaused(next) {
      if (destroyed || next === paused) return;
      paused = next;
      driver.setPaused(next);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      driver.destroy();
    },
  };
}

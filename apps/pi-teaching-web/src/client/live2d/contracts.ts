import type { PeerExpression } from '../../shared/contracts';
import type { PeerMouth } from '../peer-playback';
import type { PeerLive2DPackage } from './private-package';

export type PeerPresencePhase = 'calm' | 'thinking' | 'speaking';

export type PeerVisualState = {
  phase: PeerPresencePhase;
  expression: PeerExpression;
  mouth: PeerMouth;
};

export type PeerLive2DRenderer = {
  setState(state: PeerVisualState): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

export type PeerVisualDriver = {
  setAttention(phase: PeerPresencePhase): void;
  setExpression(expression: PeerExpression): void;
  setMouthTarget(value: number): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

export type CreatePeerLive2DRenderer = (input: {
  host: HTMLElement;
  package: PeerLive2DPackage;
  initialState: PeerVisualState;
  onFailure(): void;
}) => Promise<PeerLive2DRenderer>;

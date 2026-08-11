import type { PeerExpression } from '../../shared/contracts';

export type CompanionPresentation = {
  messageId: string;
  actorId: 'peer-axia';
  text: string;
  expression: PeerExpression;
  phase: 'thinking' | 'speaking';
};

export type CompanionPlayback = {
  messageId: string | null;
  phase: 'idle' | 'loading' | 'speaking';
  muted: boolean;
};

export type CompanionControl =
  | { action: 'stop'; tex?: never }
  | { action: 'toggle-mute'; tex?: never }
  | { action: 'speak-formula'; tex: string };

export type CompanionSnapshot = {
  presentation: CompanionPresentation | null;
  playback: CompanionPlayback;
};

export type CompanionBridge = {
  snapshot(): Promise<CompanionSnapshot>;
  present(value: CompanionPresentation | null): Promise<boolean>;
  control(value: CompanionControl): Promise<boolean>;
  setPlayback(value: CompanionPlayback): Promise<void>;
  onPresentation(listener: (value: CompanionPresentation | null) => void): Promise<() => void>;
  onPlayback(listener: (value: CompanionPlayback) => void): Promise<() => void>;
  onControl(listener: (value: CompanionControl) => void): Promise<() => void>;
  showMain(): Promise<void>;
  showCompanion(): Promise<void>;
  hideCompanion(): Promise<void>;
  quit(): Promise<void>;
};

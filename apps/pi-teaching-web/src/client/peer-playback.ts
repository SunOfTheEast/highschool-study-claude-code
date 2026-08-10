import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConversationItem,
  PeerConversationItem,
} from '../shared/contracts';
import {
  automaticPeerSpeech,
  detailedFormulaSpeech,
} from '../shared/peer-speech';
import { api } from './api';

export type PeerMouth = 'closed' | 'half' | 'open';
export type PeerPlaybackPhase = 'idle' | 'loading' | 'speaking';

export type PeerPlaybackView = {
  item: PeerConversationItem | null;
  phase: PeerPlaybackPhase;
  mouth: PeerMouth;
  portraitUrl: string | null;
  muted: boolean;
  stop(): void;
  toggleMute(): void;
  readFormula(tex: string): void;
};

type PlaybackState = Pick<
  PeerPlaybackView,
  'item' | 'phase' | 'mouth' | 'portraitUrl'
>;

const muteKey = 'studyforge.peer-voice-muted';
const attemptedLivePeers = new Set<string>();

export function nextLivePeer(
  items: readonly ConversationItem[],
  attempted: ReadonlySet<string>,
): PeerConversationItem | null {
  return items.find((item): item is PeerConversationItem => (
    item.kind === 'peer'
    && item.actorId === 'peer-axia'
    && item.delivery === 'live'
    && item.status === 'done'
    && Boolean(item.text)
    && !attempted.has(item.id)
  )) ?? null;
}

export function visibleConversationDuringPeer(
  items: readonly ConversationItem[],
  peerId: string | null,
): ConversationItem[] {
  if (!peerId) return [...items];
  const index = items.findIndex((item) => item.id === peerId);
  return index < 0 ? [...items] : items.slice(0, index + 1);
}

export function mouthForAmplitude(amplitude: number): PeerMouth {
  if (amplitude < 0.014) return 'closed';
  if (amplitude < 0.06) return 'half';
  return 'open';
}

function initialMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(muteKey) === 'true';
  } catch {
    return false;
  }
}

function systemSpeech(text: string, onEnd?: () => void): (() => void) | null {
  if (
    typeof window === 'undefined'
    || typeof SpeechSynthesisUtterance === 'undefined'
    || !window.speechSynthesis
  ) return null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.98;
  const voice = window.speechSynthesis.getVoices().find((candidate) => (
    candidate.lang.toLowerCase().startsWith('zh')
  ));
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return () => {
    utterance.onend = null;
    utterance.onerror = null;
    window.speechSynthesis.cancel();
  };
}

export function usePeerPlayback(
  items: readonly ConversationItem[],
  enabled: boolean,
): PeerPlaybackView {
  const [muted, setMuted] = useState(initialMuted);
  const [state, setState] = useState<PlaybackState>({
    item: null,
    phase: 'idle',
    mouth: 'closed',
    portraitUrl: null,
  });
  const stopRef = useRef<() => void>(() => {});

  const begin = useCallback((item: PeerConversationItem) => {
    const controller = new AbortController();
    let settled = false;
    let portraitUrl: string | null = null;
    let audioUrl: string | null = null;
    let audio: HTMLAudioElement | null = null;
    let audioContext: AudioContext | null = null;
    let frame = 0;
    let stopSystemSpeech: (() => void) | null = null;

    const releaseAudio = () => {
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = 0;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.src = '';
      }
      audio = null;
      if (audioContext) void audioContext.close().catch(() => undefined);
      audioContext = null;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      controller.abort();
      releaseAudio();
      stopSystemSpeech?.();
      stopSystemSpeech = null;
      if (portraitUrl) URL.revokeObjectURL(portraitUrl);
      portraitUrl = null;
      stopRef.current = () => {};
      setState({ item: null, phase: 'idle', mouth: 'closed', portraitUrl: null });
    };

    const playSystemFallback = (spokenText: string) => {
      if (settled) return;
      setState((current) => ({ ...current, phase: 'speaking', mouth: 'closed' }));
      stopSystemSpeech = systemSpeech(spokenText, finish);
      if (!stopSystemSpeech) finish();
    };

    const playAudio = async (blob: Blob, spokenText: string) => {
      if (settled || typeof Audio === 'undefined') {
        playSystemFallback(spokenText);
        return;
      }
      audioUrl = URL.createObjectURL(blob);
      audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audio.onended = finish;
      audio.onerror = () => {
        releaseAudio();
        playSystemFallback(spokenText);
      };

      const Context = typeof window === 'undefined'
        ? undefined
        : window.AudioContext
          ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) {
        try {
          audioContext = new Context();
          const source = audioContext.createMediaElementSource(audio);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          const samples = new Uint8Array(analyser.fftSize);
          let smoothed = 0;
          const sample = () => {
            if (settled || !audio || audio.paused) return;
            analyser.getByteTimeDomainData(samples);
            let energy = 0;
            for (const value of samples) {
              const normalized = (value - 128) / 128;
              energy += normalized * normalized;
            }
            const rms = Math.sqrt(energy / samples.length);
            smoothed = smoothed * 0.68 + rms * 0.32;
            const mouth = mouthForAmplitude(smoothed);
            setState((current) => current.mouth === mouth ? current : { ...current, mouth });
            frame = requestAnimationFrame(sample);
          };
          frame = requestAnimationFrame(sample);
        } catch {
          audioContext = null;
        }
      }

      try {
        await audio.play();
        if (!settled) setState((current) => ({ ...current, phase: 'speaking' }));
      } catch {
        releaseAudio();
        playSystemFallback(spokenText);
      }
    };

    stopRef.current = finish;
    setState({ item, phase: 'loading', mouth: 'closed', portraitUrl: null });
    const spokenText = automaticPeerSpeech(item.text ?? '');
    if (!spokenText) {
      finish();
      return;
    }

    void api.peerPortrait('peer-axia', item.expression).then((blob) => {
      if (!blob || settled) return;
      portraitUrl = URL.createObjectURL(blob);
      setState((current) => ({ ...current, portraitUrl }));
    }).catch(() => undefined);

    void api.peerSpeech('peer-axia', spokenText, controller.signal)
      .then((blob) => blob ? playAudio(blob, spokenText) : playSystemFallback(spokenText))
      .catch(() => playSystemFallback(spokenText));
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopRef.current();
      return;
    }
    const candidate = nextLivePeer(items, attemptedLivePeers);
    if (!candidate) return;
    attemptedLivePeers.add(candidate.id);
    if (!muted) begin(candidate);
  }, [begin, enabled, items, muted]);

  useEffect(() => () => stopRef.current(), []);

  const stop = useCallback(() => stopRef.current(), []);
  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(muteKey, String(next));
      } catch {
        // A private-storage failure must not affect the conversation.
      }
      if (next) stopRef.current();
      return next;
    });
  }, []);
  const readFormula = useCallback((tex: string) => {
    const spoken = detailedFormulaSpeech(tex);
    if (!spoken) return;
    stopRef.current();
    systemSpeech(spoken);
  }, []);

  return { ...state, muted, stop, toggleMute, readFormula };
}

export type FocusAlertCopy = { title: string; body: string };

export async function deliverFocusAlert(
  effects: { play(): void; notify(): Promise<void> },
  _copy: FocusAlertCopy,
): Promise<boolean> {
  effects.play();
  try {
    await effects.notify();
    return true;
  } catch {
    return false;
  }
}

export function playFocusChime(): void {
  const AudioContextClass = globalThis.AudioContext
    ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.48);
  oscillator.addEventListener('ended', () => void context.close(), { once: true });
}

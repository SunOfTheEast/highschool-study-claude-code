import type { PresentationPreferences } from '../shared/contracts';

const key = 'studyforge.presentation.v1';
const defaults: PresentationPreferences = {
  motion: 'gentle',
  completionFeedback: true,
};

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readPresentationPreferences(
  storage: Pick<BrowserStorage, 'getItem'>,
  systemReducedMotion: boolean,
): PresentationPreferences {
  let stored: Partial<PresentationPreferences> = {};
  try {
    stored = JSON.parse(storage.getItem(key) ?? '{}') as Partial<PresentationPreferences>;
  } catch {
    stored = {};
  }
  const motion = stored.motion === 'gentle' || stored.motion === 'reduced'
    ? stored.motion
    : defaults.motion;
  return {
    motion: systemReducedMotion ? 'reduced' : motion,
    completionFeedback: typeof stored.completionFeedback === 'boolean'
      ? stored.completionFeedback
      : defaults.completionFeedback,
  };
}

export function writePresentationPreferences(
  storage: Pick<BrowserStorage, 'setItem'>,
  value: PresentationPreferences,
): void {
  storage.setItem(key, JSON.stringify(value));
}

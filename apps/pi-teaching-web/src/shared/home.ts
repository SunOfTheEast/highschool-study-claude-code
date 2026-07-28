import type { HomeSnapshot } from './contracts';

export function resolveContinuePath(
  home: HomeSnapshot,
  savedPath: string | null,
): string {
  return savedPath && home.eligibleContinueRoutes.includes(savedPath)
    ? savedPath
    : home.continueTarget.route;
}

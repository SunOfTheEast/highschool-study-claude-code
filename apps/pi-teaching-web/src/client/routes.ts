export type BrowserRoute =
  | { kind: 'home' }
  | { kind: 'coach'; planId: string }
  | { kind: 'lesson'; planId: string; lessonId: string };

function decodeId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.trim() ? decoded : null;
  } catch {
    return null;
  }
}

export function parseBrowserRoute(pathname: string): BrowserRoute | null {
  if (pathname === '/') return { kind: 'home' };
  if (!pathname.startsWith('/') || pathname.endsWith('/')) return null;
  const parts = pathname.slice(1).split('/');
  if (parts.length === 2 && parts[0] === 'plan') {
    const planId = decodeId(parts[1]!);
    return planId ? { kind: 'coach', planId } : null;
  }
  if (parts.length === 4 && parts[0] === 'plan' && parts[2] === 'lesson') {
    const planId = decodeId(parts[1]!);
    const lessonId = decodeId(parts[3]!);
    return planId && lessonId ? { kind: 'lesson', planId, lessonId } : null;
  }
  return null;
}

export function formatBrowserRoute(route: BrowserRoute): string {
  if (route.kind === 'home') return '/';
  const plan = encodeURIComponent(route.planId);
  return route.kind === 'coach'
    ? `/plan/${plan}`
    : `/plan/${plan}/lesson/${encodeURIComponent(route.lessonId)}`;
}

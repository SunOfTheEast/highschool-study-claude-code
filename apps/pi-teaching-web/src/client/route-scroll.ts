export function resetRouteScroll(
  target: Pick<Window, 'scrollTo'> = window,
): void {
  target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

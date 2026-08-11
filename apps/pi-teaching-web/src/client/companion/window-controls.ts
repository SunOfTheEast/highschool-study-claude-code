import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  PhysicalPosition,
  availableMonitors,
  cursorPosition,
  getCurrentWindow,
  primaryMonitor,
} from '@tauri-apps/api/window';

export type CompanionPoint = { x: number; y: number };
export type CompanionSize = { width: number; height: number };
export type CompanionRect = { left: number; top: number; right: number; bottom: number };
export type CompanionMonitor = { position: CompanionPoint; size: CompanionSize };

const positionKey = 'studyforge.companion-position.v1';

function contains(rect: CompanionRect, point: CompanionPoint): boolean {
  return point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom;
}

export function pointInCompanionTarget(
  point: CompanionPoint,
  target: CompanionRect,
  menu: CompanionRect | null,
): boolean {
  return contains(target, point) || Boolean(menu && contains(menu, point));
}

function intersectsMonitor(
  position: CompanionPoint,
  monitor: CompanionMonitor,
  size: CompanionSize,
): boolean {
  return position.x < monitor.position.x + monitor.size.width
    && position.x + size.width > monitor.position.x
    && position.y < monitor.position.y + monitor.size.height
    && position.y + size.height > monitor.position.y;
}

export function restoreCompanionPosition(
  saved: CompanionPoint | null,
  monitors: readonly CompanionMonitor[],
  size: CompanionSize,
): CompanionPoint {
  if (saved && monitors.some((monitor) => intersectsMonitor(saved, monitor, size))) return saved;
  const primary = monitors[0];
  if (!primary) return { x: 0, y: 0 };
  return {
    x: primary.position.x + Math.max(0, primary.size.width - size.width - 50),
    y: primary.position.y + Math.max(0, primary.size.height - size.height - 60),
  };
}

function savedPosition(): CompanionPoint | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(positionKey) ?? 'null') as unknown;
    if (!value || typeof value !== 'object') return null;
    const point = value as Partial<CompanionPoint>;
    return Number.isFinite(point.x) && Number.isFinite(point.y)
      ? { x: point.x!, y: point.y! }
      : null;
  } catch {
    return null;
  }
}

export function useCompanionWindowControls(
  targetRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
): {
  onPointerDown(event: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(event: ReactPointerEvent<HTMLElement>): void;
  onPointerUp(): void;
} {
  const dragOrigin = useRef<CompanionPoint | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void Promise.all([availableMonitors(), primaryMonitor(), appWindow.scaleFactor()]).then(([
      available,
      primary,
      scale,
    ]) => {
      if (disposed) return;
      const ordered = primary
        ? [primary, ...available.filter((monitor) => monitor !== primary)]
        : available;
      const monitors = ordered.map((monitor) => monitor.workArea);
      const size = { width: 340 * scale, height: 560 * scale };
      const position = restoreCompanionPosition(savedPosition(), monitors, size);
      void appWindow.setPosition(new PhysicalPosition(position.x, position.y));
    });

    void appWindow.onMoved(({ payload }) => {
      try {
        window.localStorage.setItem(positionKey, JSON.stringify({ x: payload.x, y: payload.y }));
      } catch {
        // Position persistence is optional; the fallback remains deterministic.
      }
    }).then((next) => {
      if (disposed) next();
      else unlisten = next;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let ignored: boolean | null = null;
    let checking = false;
    const check = async () => {
      const target = targetRef.current;
      if (checking || !target) return;
      checking = true;
      try {
        const [cursor, position, scale] = await Promise.all([
          cursorPosition(),
          appWindow.innerPosition(),
          appWindow.scaleFactor(),
        ]);
        const point = {
          x: (cursor.x - position.x) / scale,
          y: (cursor.y - position.y) / scale,
        };
        const interactive = pointInCompanionTarget(
          point,
          target.getBoundingClientRect(),
          menuRef.current?.getBoundingClientRect() ?? null,
        );
        const nextIgnored = !interactive;
        if (ignored !== nextIgnored) {
          await appWindow.setIgnoreCursorEvents(nextIgnored);
          ignored = nextIgnored;
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void check(), 120);
    void check();
    return () => window.clearInterval(timer);
  }, [menuRef, targetRef]);

  return {
    onPointerDown(event) {
      if (event.button !== 0) return;
      dragOrigin.current = { x: event.clientX, y: event.clientY };
      dragging.current = false;
    },
    onPointerMove(event) {
      const origin = dragOrigin.current;
      if (!origin || dragging.current || (event.buttons & 1) === 0) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 4) return;
      dragging.current = true;
      void getCurrentWindow().startDragging();
    },
    onPointerUp() {
      dragOrigin.current = null;
      dragging.current = false;
    },
  };
}

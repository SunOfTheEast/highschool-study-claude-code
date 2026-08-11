import { useEffect, useState } from 'react';
import type { PublicFocusCycle } from '../../shared/contracts';

const choices = [900, 1500, 2700] as const;

export function FocusStartControl({
  expanded,
  onStart,
}: {
  expanded?: boolean;
  onStart(targetSeconds: 900 | 1500 | 2700): Promise<void>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  return (
    <div className="focus-start-control">
      {!open ? (
        <button type="button" onClick={() => setLocalOpen(true)}>开始专注</button>
      ) : (
        <div className="focus-duration-choices" aria-label="选择专注时长">
          {choices.map((seconds) => (
            <button key={seconds} type="button" onClick={() => void onStart(seconds)}>
              {seconds / 60} 分钟
            </button>
          ))}
          {expanded === undefined && (
            <button type="button" onClick={() => setLocalOpen(false)}>取消</button>
          )}
        </div>
      )}
    </div>
  );
}

function displaySeconds(focus: PublicFocusCycle, now: number | null): number {
  if (focus.status === 'paused' || !focus.expiresAt || now === null) {
    return focus.remainingSeconds;
  }
  return Math.max(0, Math.ceil((Date.parse(focus.expiresAt) - now) / 1000));
}

function clock(value: number): string {
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = Math.max(0, value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function FocusCycleControls({
  focus,
  onPause,
  onResume,
  onEnd,
}: {
  focus: PublicFocusCycle;
  onPause(): Promise<void>;
  onResume(): Promise<void>;
  onEnd(): Promise<void>;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (focus.status === 'paused') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [focus.status, focus.expiresAt]);
  const remaining = displaySeconds(focus, now);
  return (
    <div className="focus-cycle-controls" data-status={focus.status}>
      <span>{focus.status === 'running' ? '专注中' : '已暂停'} <b>{clock(remaining)}</b></span>
      {focus.status === 'running'
        ? <button type="button" onClick={() => void onPause()}>暂停</button>
        : <button type="button" onClick={() => void onResume()}>继续</button>}
      <button type="button" onClick={() => void onEnd()}>结束</button>
    </div>
  );
}

import { useState } from 'react';
import type { CalendarAppointment, CalendarDestination } from '../../shared/contracts';
import { learningSetLabel } from '../calendar-navigation';

export type CalendarDraft = {
  title: string;
  startsAt: string;
  plannedMinutes: number | null;
  destination: CalendarDestination;
};

export type CalendarPlanChoice = { id: string; title: string };

function localTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

function localInput(date: string, time = '19:00'): string {
  return `${date}T${time}`;
}

export function CalendarDayPanel({
  date,
  appointments,
  currentLearningSetPath,
  plans = [],
  reviewCount = 0,
  onCreate,
  onUpdate,
  onDelete,
  onOpen,
}: {
  date: string;
  appointments: readonly CalendarAppointment[];
  currentLearningSetPath: string;
  plans?: readonly CalendarPlanChoice[];
  reviewCount?: number;
  onCreate(input: CalendarDraft): Promise<void>;
  onUpdate(appointment: CalendarAppointment, input: Omit<CalendarDraft, 'destination'>): Promise<void>;
  onDelete(appointment: CalendarAppointment): Promise<void>;
  onOpen(appointment: CalendarAppointment): Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(localInput(date));
  const [minutes, setMinutes] = useState('');
  const [destination, setDestination] = useState(plans.length > 0 ? `plan:${plans[0]!.id}` : 'free');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editMinutes, setEditMinutes] = useState('');

  const beginEdit = (appointment: CalendarAppointment) => {
    const value = new Date(appointment.startsAt);
    const offset = value.getTimezoneOffset() * 60_000;
    setEditing(appointment.id);
    setEditTitle(appointment.title);
    setEditStartsAt(new Date(value.getTime() - offset).toISOString().slice(0, 16));
    setEditMinutes(appointment.plannedMinutes ? String(appointment.plannedMinutes) : '');
  };

  const saveEdit = async (appointment: CalendarAppointment) => {
    if (!editTitle.trim() || !editStartsAt) return;
    setBusy(true);
    try {
      await onUpdate(appointment, {
        title: editTitle.trim(),
        startsAt: new Date(editStartsAt).toISOString(),
        plannedMinutes: editMinutes ? Number(editMinutes) : null,
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!title.trim() || !startsAt) return;
    setBusy(true);
    try {
      const selected = destination.startsWith('plan:')
        ? { kind: 'plan' as const, planId: destination.slice('plan:'.length) }
        : { kind: 'free-learning' as const, intent: 'open' as const, contexts: [] };
      await onCreate({
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        plannedMinutes: minutes ? Number(minutes) : null,
        destination: selected,
      });
      setTitle('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="calendar-day-panel" aria-label={`${date} 的学习安排`}>
      <header>
        <small>当天安排</small>
        <h2>{date}</h2>
        {reviewCount > 0 && <p>待复习 {reviewCount} 项</p>}
      </header>
      <ol className="calendar-appointment-list">
        {appointments.map((appointment) => {
          const otherSet = appointment.learningSetPath !== currentLearningSetPath;
          return (
            <li key={appointment.id} data-other-set={otherSet || undefined}>
              <div>
                <time dateTime={appointment.startsAt}>{localTime(appointment.startsAt)}</time>
                <small>{learningSetLabel(appointment.learningSetPath)}</small>
              </div>
              <strong>{appointment.title}</strong>
              <p>{appointment.plannedMinutes ? `约 ${appointment.plannedMinutes} 分钟` : '未限定时长'}</p>
              {editing === appointment.id ? (
                <div className="calendar-edit-form">
                  <label>主题<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></label>
                  <label>开始时间<input type="datetime-local" value={editStartsAt} onChange={(event) => setEditStartsAt(event.target.value)} /></label>
                  <label>计划分钟<input type="number" min="1" value={editMinutes} placeholder="可不填" onChange={(event) => setEditMinutes(event.target.value)} /></label>
                  <div className="calendar-row-actions">
                    <button type="button" className="action-solid" disabled={busy || !editTitle.trim()} onClick={() => void saveEdit(appointment)}>保存修改</button>
                    <button type="button" className="action-text" onClick={() => setEditing(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <div className="calendar-row-actions">
                  <button type="button" className="action-solid" onClick={() => void onOpen(appointment)}>
                    现在开始
                  </button>
                  <button type="button" className="action-text" onClick={() => beginEdit(appointment)}>修改</button>
                  <button type="button" className="action-text" onClick={() => void onDelete(appointment)}>
                    删除
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {appointments.length === 0 && <li className="calendar-empty">这一天还没有学习约定。</li>}
      </ol>
      <details className="calendar-create" open={appointments.length === 0}>
        <summary>新建学习约定</summary>
        <label>主题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>开始时间<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>计划分钟<input type="number" min="1" value={minutes} placeholder="可不填" onChange={(event) => setMinutes(event.target.value)} /></label>
        <label>进入位置
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="free">自由学习</option>
            {plans.map((plan) => <option key={plan.id} value={`plan:${plan.id}`}>{plan.title}</option>)}
          </select>
        </label>
        <button type="button" className="action-solid" disabled={busy || !title.trim()} onClick={() => void create()}>
          保存约定
        </button>
      </details>
    </aside>
  );
}

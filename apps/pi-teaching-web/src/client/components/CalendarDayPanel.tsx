import { useEffect, useState } from 'react';
import type {
  CalendarAppointment,
  CalendarDestination,
  CalendarReviewCandidate,
} from '../../shared/contracts';
import { learningSetLabel } from '../calendar-navigation';
import { publicErrorText } from '../public-errors';

export type CalendarDraft = {
  title: string;
  startsAt: string;
  plannedMinutes: number | null;
  learningSetPath?: string;
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

function reviewKey(candidate: CalendarReviewCandidate): string {
  return `${candidate.learningSetPath}\u0000${candidate.asset.kind}:${candidate.asset.id}`;
}

export function calendarActionErrorText(error: unknown): string {
  return publicErrorText(error, '这项日历操作暂时没有完成，请稍后再试。');
}

export function CalendarDayPanel({
  date,
  appointments,
  currentLearningSetPath,
  plans = [],
  reviewCandidates = [],
  onCreate,
  onUpdate,
  onDelete,
  onOpen,
  onReview = async () => {},
}: {
  date: string;
  appointments: readonly CalendarAppointment[];
  currentLearningSetPath: string;
  plans?: readonly CalendarPlanChoice[];
  reviewCandidates?: readonly CalendarReviewCandidate[];
  onCreate(input: CalendarDraft): Promise<void>;
  onUpdate(appointment: CalendarAppointment, input: Omit<CalendarDraft, 'destination'>): Promise<void>;
  onDelete(appointment: CalendarAppointment): Promise<void>;
  onOpen(appointment: CalendarAppointment): Promise<void>;
  onReview?(candidates: CalendarReviewCandidate[]): Promise<void>;
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
  const [selectedReviews, setSelectedReviews] = useState<string[]>(() => (
    reviewCandidates.filter((candidate) => !candidate.unavailable).map(reviewKey)
  ));
  const [reviewDraft, setReviewDraft] = useState<{
    learningSetPath: string;
    candidates: CalendarReviewCandidate[];
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(appointments.length === 0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setStartsAt(localInput(date));
    setDestination(plans.length > 0 ? `plan:${plans[0]!.id}` : 'free');
    setReviewDraft(null);
    setCreateOpen(appointments.length === 0);
  }, [date]);

  useEffect(() => {
    setSelectedReviews(reviewCandidates
      .filter((candidate) => !candidate.unavailable)
      .map(reviewKey));
  }, [reviewCandidates]);

  const reviewGroups = [...reviewCandidates.reduce((groups, candidate) => {
    const current = groups.get(candidate.learningSetPath) ?? [];
    groups.set(candidate.learningSetPath, [...current, candidate]);
    return groups;
  }, new Map<string, CalendarReviewCandidate[]>())];

  const selectedFrom = (candidates: CalendarReviewCandidate[]) => candidates.filter((candidate) => (
    !candidate.unavailable && selectedReviews.includes(reviewKey(candidate))
  ));

  const prepareReview = (candidates: CalendarReviewCandidate[]) => {
    const selected = selectedFrom(candidates);
    if (selected.length === 0) return;
    setReviewDraft({ learningSetPath: selected[0]!.learningSetPath, candidates: selected });
    setDestination('review');
    setTitle(selected.length === 1 ? `复习：${selected[0]!.title}` : `复习 ${selected.length} 份学习资料`);
    setStartsAt(localInput(date));
    setCreateOpen(true);
  };

  const beginEdit = (appointment: CalendarAppointment) => {
    const value = new Date(appointment.startsAt);
    const offset = value.getTimezoneOffset() * 60_000;
    setEditing(appointment.id);
    setEditTitle(appointment.title);
    setEditStartsAt(new Date(value.getTime() - offset).toISOString().slice(0, 16));
    setEditMinutes(appointment.plannedMinutes ? String(appointment.plannedMinutes) : '');
  };

  const runAction = async (action: () => Promise<void>, onSuccess?: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      setActionError(calendarActionErrorText(error));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (appointment: CalendarAppointment) => {
    if (!editTitle.trim() || !editStartsAt) return;
    await runAction(() => onUpdate(appointment, {
        title: editTitle.trim(),
        startsAt: new Date(editStartsAt).toISOString(),
        plannedMinutes: editMinutes ? Number(editMinutes) : null,
      }), () => setEditing(null));
  };

  const create = async () => {
    if (!title.trim() || !startsAt) return;
    const selected = destination === 'review' && reviewDraft
      ? {
        kind: 'free-learning' as const,
        intent: 'review' as const,
        contexts: reviewDraft.candidates.map((candidate) => ({ ...candidate.asset })),
      }
      : destination.startsWith('plan:')
        ? { kind: 'plan' as const, planId: destination.slice('plan:'.length) }
        : { kind: 'free-learning' as const, intent: 'open' as const, contexts: [] };
    await runAction(() => onCreate({
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        plannedMinutes: minutes ? Number(minutes) : null,
        ...(reviewDraft ? { learningSetPath: reviewDraft.learningSetPath } : {}),
        destination: selected,
      }), () => {
      setTitle('');
      setReviewDraft(null);
      setDestination(plans.length > 0 ? `plan:${plans[0]!.id}` : 'free');
      });
  };

  return (
    <aside className="calendar-day-panel" aria-label={`${date} 的学习安排`}>
      <header>
        <small>当天安排</small>
        <h2>{date}</h2>
        {reviewCandidates.length > 0 && <p>待复习 {reviewCandidates.length} 项</p>}
      </header>
      {reviewGroups.length > 0 && (
        <section className="calendar-review-candidates" aria-label="待复习资料">
          {reviewGroups.map(([learningSetPath, candidates]) => {
            const selected = selectedFrom(candidates);
            return (
              <div key={learningSetPath}>
                <header>
                  <small>{candidates[0]!.learningSetName}</small>
                  <span>{candidates.length} 项</span>
                </header>
                {candidates.map((candidate) => (
                  <label key={reviewKey(candidate)} data-unavailable={candidate.unavailable || undefined}>
                    <input
                      type="checkbox"
                      disabled={candidate.unavailable}
                      checked={selectedReviews.includes(reviewKey(candidate))}
                      onChange={() => setSelectedReviews((current) => (
                        current.includes(reviewKey(candidate))
                          ? current.filter((key) => key !== reviewKey(candidate))
                          : [...current, reviewKey(candidate)]
                      ))}
                    />
                    <span>{candidate.title}</span>
                    {candidate.unavailable && <small>当前资料不可用</small>}
                  </label>
                ))}
                <div className="calendar-row-actions">
                  <button
                    type="button"
                    className="action-solid"
                    disabled={busy || selected.length === 0}
                    onClick={() => void runAction(() => onReview(selected))}
                  >
                    现在开始复习
                  </button>
                  <button
                    type="button"
                    className="action-text"
                    disabled={busy || selected.length === 0}
                    onClick={() => prepareReview(candidates)}
                  >
                    安排到时间
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
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
                  <button type="button" className="action-solid" disabled={busy} onClick={() => void runAction(() => onOpen(appointment))}>
                    现在开始
                  </button>
                  <button type="button" className="action-text" onClick={() => beginEdit(appointment)}>修改</button>
                  <button type="button" className="action-text" disabled={busy} onClick={() => void runAction(() => onDelete(appointment))}>
                    删除
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {appointments.length === 0 && <li className="calendar-empty">这一天还没有学习约定。</li>}
      </ol>
      {actionError && <p className="inline-error" role="alert">{actionError}</p>}
      <details
        className="calendar-create"
        open={createOpen}
        onToggle={(event) => setCreateOpen(event.currentTarget.open)}
      >
        <summary>新建学习约定</summary>
        <label>主题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>开始时间<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>计划分钟<input type="number" min="1" value={minutes} placeholder="可不填" onChange={(event) => setMinutes(event.target.value)} /></label>
        <label>进入位置
          <select value={destination} onChange={(event) => {
            setDestination(event.target.value);
            if (event.target.value !== 'review') setReviewDraft(null);
          }}>
            {reviewDraft && <option value="review">复习所选资料</option>}
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

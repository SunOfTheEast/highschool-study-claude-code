import { useMemo, useState } from 'react';
import type { CalendarAppointment } from '../../shared/contracts';
import {
  CalendarDayPanel,
  type CalendarDraft,
  type CalendarPlanChoice,
} from '../components/CalendarDayPanel';

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateValue(date: Date): string {
  return `${monthValue(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDate(iso: string): string {
  return dateValue(new Date(iso));
}

function monthCells(month: string): Array<{ date: string; current: boolean }> {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year!, monthNumber! - 1, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: dateValue(day), current: day.getMonth() === monthNumber! - 1 };
  });
}

function shiftedMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthValue(new Date(year!, monthNumber! - 1 + delta, 1));
}

export function CalendarPage({
  appointments,
  currentLearningSetPath,
  plans = [],
  reviewCandidates,
  reminderPermission = null,
  initialMonth = monthValue(new Date()),
  initialDate = dateValue(new Date()),
  onCreate,
  onUpdate,
  onDelete,
  onOpen,
}: {
  appointments: readonly CalendarAppointment[];
  currentLearningSetPath: string;
  plans?: readonly CalendarPlanChoice[];
  reviewCandidates: readonly unknown[];
  reminderPermission?: 'granted' | 'denied' | 'unsupported' | 'unavailable' | null;
  initialMonth?: string;
  initialDate?: string;
  onCreate(input: CalendarDraft): Promise<void>;
  onUpdate(appointment: CalendarAppointment, input: Omit<CalendarDraft, 'destination'>): Promise<void>;
  onDelete(appointment: CalendarAppointment): Promise<void>;
  onOpen(appointment: CalendarAppointment): Promise<void>;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const cells = useMemo(() => monthCells(month), [month]);
  const byDate = useMemo(() => {
    const grouped = new Map<string, CalendarAppointment[]>();
    for (const appointment of appointments) {
      const key = localDate(appointment.startsAt);
      grouped.set(key, [...grouped.get(key) ?? [], appointment]);
    }
    return grouped;
  }, [appointments]);
  const [year, monthNumber] = month.split('-').map(Number);

  const move = (delta: number) => {
    const next = shiftedMonth(month, delta);
    setMonth(next);
    setSelectedDate(`${next}-01`);
  };

  return (
    <main className="calendar-page">
      <header className="calendar-heading">
        <div><small>LEARNING CALENDAR</small><h1>学习日历</h1></div>
        <div>
          <p>只记录你决定什么时候回来学习，不替你判断完成或掌握。</p>
          {(reminderPermission === 'denied' || reminderPermission === 'unavailable') && (
            <p className="calendar-reminder-warning">系统提醒未开启，日历安排仍会正常保存。</p>
          )}
        </div>
      </header>
      <div className="calendar-layout">
        <section className="calendar-month" aria-label={`${year} 年 ${monthNumber} 月`}>
          <header>
            <button type="button" className="action-text" onClick={() => move(-1)}>上个月</button>
            <h2>{year} 年 {monthNumber} 月</h2>
            <button type="button" className="action-text" onClick={() => move(1)}>下个月</button>
          </header>
          <div className="calendar-weekdays" aria-hidden="true">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>周{day}</span>)}
          </div>
          <div className="calendar-grid">
            {cells.map((cell) => {
              const dayAppointments = byDate.get(cell.date) ?? [];
              return (
                <button
                  type="button"
                  key={cell.date}
                  aria-label={cell.date}
                  aria-pressed={selectedDate === cell.date}
                  data-current-month={cell.current || undefined}
                  onClick={() => setSelectedDate(cell.date)}
                >
                  <time dateTime={cell.date}>{Number(cell.date.slice(-2))}</time>
                  <span>{dayAppointments.slice(0, 2).map((item) => <i key={item.id}>{item.title}</i>)}</span>
                  {dayAppointments.length > 2 && <small>另有 {dayAppointments.length - 2} 项</small>}
                </button>
              );
            })}
          </div>
        </section>
        <CalendarDayPanel
          date={selectedDate}
          appointments={byDate.get(selectedDate) ?? []}
          currentLearningSetPath={currentLearningSetPath}
          plans={plans}
          reviewCount={reviewCandidates.length}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      </div>
    </main>
  );
}

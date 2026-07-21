import type { LessonReplay } from '../../shared/contracts';

function RouteRow({ label, values, accent }: { label: string; values: string[]; accent?: boolean }) {
  return (
    <div className="route-row" data-accent={accent || undefined}>
      <small>{label}</small>
      <div>
        {values.map((value, index) => (
          <span key={`${value}:${index}`}>
            {value}{index < values.length - 1 && <i aria-hidden="true">→</i>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RouteMap({ replay }: { replay: LessonReplay }) {
  return (
    <section className="route-map">
      <span>课堂路线</span>
      <RouteRow label="初始" values={replay.route.initial} />
      <RouteRow label="实际" values={replay.route.effective} accent />
    </section>
  );
}

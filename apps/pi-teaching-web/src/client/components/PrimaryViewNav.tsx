import type { PrimaryView } from '../view-state';

export type PrimaryViewNavProps = {
  active: PrimaryView;
  hrefs: Record<PrimaryView, string>;
  onNavigate(view: PrimaryView): void;
};

const labels: Record<PrimaryView, string> = {
  course: '课程脉络',
  knowledge: '知识山河',
  memory: '研习留痕',
};

export function PrimaryViewNav({
  active,
  hrefs,
  onNavigate,
}: PrimaryViewNavProps) {
  return (
    <nav className="primary-view-nav" aria-label="主视图">
      {(Object.keys(labels) as PrimaryView[]).map((view) => (
        <a
          key={view}
          href={hrefs[view]}
          aria-current={active === view ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(view);
          }}
        >
          {labels[view]}
        </a>
      ))}
    </nav>
  );
}

export default PrimaryViewNav;

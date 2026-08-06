import { PRIMARY_VIEWS, type PrimaryView } from '../view-state';

export type PrimaryViewNavProps = {
  active: PrimaryView;
  knowledgeAvailable: boolean;
  hrefs: Record<PrimaryView, string>;
  onNavigate(view: PrimaryView): void;
};

const labels: Record<PrimaryView, string> = {
  course: '课程脉络',
  knowledge: '知识山河',
};

export function PrimaryViewNav({
  active,
  knowledgeAvailable,
  hrefs,
  onNavigate,
}: PrimaryViewNavProps) {
  return (
    <nav className="primary-view-nav" aria-label="主视图">
      {PRIMARY_VIEWS.filter((view) => view === 'course' || knowledgeAvailable).map((view) => (
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

import { PRIMARY_VIEWS, type PrimaryView } from '../view-state';

export type PrimaryViewNavProps = {
  active: PrimaryView;
  hrefs: Record<PrimaryView, string>;
  hasCourse?: boolean;
  onNavigate(view: PrimaryView): void;
};

const labels: Record<PrimaryView, string> = {
  home: '学习首页',
  assets: '学习资料',
  course: '课程脉络',
};

export function PrimaryViewNav({
  active,
  hrefs,
  hasCourse = true,
  onNavigate,
}: PrimaryViewNavProps) {
  return (
    <nav className="primary-view-nav" aria-label="主视图">
      {PRIMARY_VIEWS.filter((view) => view !== 'course' || hasCourse).map((view) => (
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

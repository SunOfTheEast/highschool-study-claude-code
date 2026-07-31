import type { ReactNode } from 'react';
import { CurrentSelectionChip } from './CurrentSelectionChip';
import { PrimaryViewNav } from './PrimaryViewNav';
import type { PrimaryView } from '../view-state';

export type AppShellProps = {
  title: string;
  activeView: PrimaryView;
  viewHrefs: Record<PrimaryView, string>;
  selectionLabel: string;
  connection: 'open' | 'connecting' | 'closed';
  viewLoading: boolean;
  viewError: string | null;
  personaControl: ReactNode;
  onNavigate(view: PrimaryView): void;
  onReturnCourse(): void;
  children: ReactNode;
};

export function AppShell({
  title,
  activeView,
  viewHrefs,
  selectionLabel,
  connection,
  viewLoading,
  viewError,
  personaControl,
  onNavigate,
  onReturnCourse,
  children,
}: AppShellProps) {
  return (
    <div className="workspace-shell" data-primary-view={activeView}>
      <header className="workspace-header">
        <a
          className="workspace-brand"
          href={viewHrefs.course}
          onClick={(event) => {
            event.preventDefault();
            onNavigate('course');
          }}
        >
          StudyForge · {title}
        </a>
        <PrimaryViewNav
          active={activeView}
          hrefs={viewHrefs}
          onNavigate={onNavigate}
        />
        <CurrentSelectionChip label={selectionLabel} onClick={onReturnCourse} />
        <div className="persona-control">{personaControl}</div>
        <span className="connection-state" data-state={connection}>
          {connection === 'open'
            ? '已连接'
            : connection === 'connecting'
              ? '连接中'
              : '正在重连'}
        </span>
      </header>
      {viewError ? (
        <p className="workspace-notice" role="alert">{viewError}</p>
      ) : viewLoading ? (
        <p className="workspace-notice" role="status">正在整理当前页面…</p>
      ) : null}
      {children}
    </div>
  );
}

export default AppShell;

import type { ReactNode } from 'react';
import { PrimaryViewNav } from './PrimaryViewNav';
import type { PrimaryView } from '../view-state';

export type AppShellProps = {
  title: string;
  activeView: PrimaryView;
  knowledgeAvailable: boolean;
  connection: 'open' | 'connecting' | 'closed';
  notice?: string | null;
  onNavigate(view: PrimaryView): void;
  children: ReactNode;
};

export function AppShell({
  title,
  activeView,
  knowledgeAvailable,
  connection,
  notice = null,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="workspace-shell" data-primary-view={activeView}>
      <header className="workspace-header">
        <a
          className="workspace-brand"
          href="/course"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('course');
          }}
        >
          <span className="brand-seal" aria-hidden="true">学</span>
          <span className="brand-copy">
            <strong>StudyForge</strong>
            <small>{title}</small>
          </span>
        </a>
        <PrimaryViewNav
          active={activeView}
          knowledgeAvailable={knowledgeAvailable}
          hrefs={{ course: '/course', knowledge: '/knowledge' }}
          onNavigate={onNavigate}
        />
        <span className="connection-state" data-state={connection}>
          {connection === 'open' ? '本地已连接' : connection === 'connecting' ? '连接中' : '正在重连'}
        </span>
      </header>
      {notice && <p className="workspace-notice" role="status">{notice}</p>}
      {children}
    </div>
  );
}

export default AppShell;

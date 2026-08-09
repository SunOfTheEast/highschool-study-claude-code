import type { ReactNode } from 'react';
import { PrimaryViewNav } from './PrimaryViewNav';
import type { PrimaryView } from '../view-state';
import { useDesktopTools } from '../desktop/DesktopContext';

export type AppShellProps = {
  title: string;
  activeView: PrimaryView;
  connection: 'open' | 'connecting' | 'closed';
  hasCourse: boolean;
  notice?: string | null;
  onNavigate(view: PrimaryView): void;
  children: ReactNode;
};

export function AppShell({
  title,
  activeView,
  connection,
  hasCourse,
  notice = null,
  onNavigate,
  children,
}: AppShellProps) {
  const desktopTools = useDesktopTools();
  return (
    <div className="workspace-shell" data-primary-view={activeView}>
      <header className="workspace-header">
        <a
          className="workspace-brand"
          href="/home"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('home');
          }}
        >
          <span className="brand-seal seal-mark" aria-hidden="true">学</span>
          <span className="brand-copy">
            <strong>StudyForge</strong>
            <small>{title}</small>
          </span>
        </a>
        <PrimaryViewNav
          active={activeView}
          hrefs={{ home: '/home', assets: '/assets', course: '/course' }}
          hasCourse={hasCourse}
          onNavigate={onNavigate}
        />
        <div className="workspace-utilities">
          {desktopTools && (
            <>
              <button type="button" onClick={desktopTools.openSettings}>设置</button>
              <button type="button" onClick={desktopTools.openHelp}>帮助</button>
            </>
          )}
          <span className="connection-state" data-state={connection}>
            {connection === 'open' ? '本地已连接' : connection === 'connecting' ? '连接中' : '正在重连'}
          </span>
        </div>
      </header>
      {notice && <p className="workspace-notice" role="status">{notice}</p>}
      {children}
    </div>
  );
}

export default AppShell;

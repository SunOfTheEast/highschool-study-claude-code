import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthType } from '@earendil-works/pi-ai';
import type { DesktopModelSelection } from '../../desktop/contracts';
import { App } from '../App';
import { configureTransport, resetTransport } from '../transport';
import { desktopApi, type DesktopAuthFlow, type DesktopStatus } from './api';
import {
  tauriDesktopBridge,
  type DesktopBridge,
  type RuntimeConnection,
} from './bridge';
import { DesktopToolsProvider } from './DesktopContext';
import { DiagnosticPage, type DesktopIssue } from './DiagnosticPage';
import { FirstRun } from './FirstRun';
import { HelpPage, type HelpDocument } from './HelpPage';
import {
  ModelSettings,
  type DesktopModelCatalog,
  type ModelAuthFlow,
} from './ModelSettings';
import { publicErrorText } from '../public-errors';

type DesktopPage = 'learning' | 'models' | 'help';

function errorMessage(error: unknown): string {
  return publicErrorText(error, '本地工作台暂时无法继续，请稍后重试。');
}

function publicAuthFlow(flow: DesktopAuthFlow): ModelAuthFlow {
  return {
    status: flow.status,
    events: flow.events,
    prompt: flow.prompt,
    error: flow.error ? publicErrorText(flow.error, '连接模型服务时没有完成，请重试。') : null,
  };
}

function runtimeIssue(connection: RuntimeConnection | null): DesktopIssue {
  const state = connection?.state;
  const code = state?.status === 'crashed' ? state.code : null;
  return {
    code: 'RUNTIME_FAILURE',
    detail: code === null ? '本地服务尚未就绪' : '本地服务意外停止',
  };
}

function DesktopLoading() {
  return (
    <main className="desktop-canvas desktop-page-reveal">
      <section className="desktop-waking-sheet" role="status">
        <span className="desktop-seal seal-mark" aria-hidden="true">学</span>
        <p className="desktop-eyebrow">StudyForge</p>
        <h1>正在铺开书桌</h1>
        <p>读取本地学习集与教师配置…</p>
        <i aria-hidden="true" />
      </section>
    </main>
  );
}

function DesktopApp({ bridge }: { bridge: DesktopBridge }) {
  const [connection, setConnection] = useState<RuntimeConnection | null>(null);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [catalog, setCatalog] = useState<DesktopModelCatalog | null>(null);
  const [page, setPage] = useState<DesktopPage>('learning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<DesktopAuthFlow | null>(null);
  const [help, setHelp] = useState<HelpDocument[]>([]);
  const authRevision = useRef(0);

  const loadSetup = useCallback(async (next: RuntimeConnection) => {
    if (!next.apiBase || !next.token) return;
    configureTransport({ apiBase: next.apiBase, token: next.token });
    const [nextStatus, nextCatalog] = await Promise.all([
      desktopApi.status(),
      desktopApi.models(),
    ]);
    setStatus(nextStatus);
    setCatalog(nextCatalog);
  }, []);

  const refreshConnection = useCallback(async () => {
    const next = await bridge.runtimeConnection();
    setConnection(next);
    if (next.state.status === 'ready') await loadSetup(next);
  }, [bridge, loadSetup]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const next = await bridge.runtimeConnection();
        if (cancelled) return;
        setConnection(next);
        if (next.state.status === 'ready' && next.apiBase && next.token) {
          await loadSetup(next);
          return;
        }
        if (next.state.status === 'starting') timer = setTimeout(poll, 180);
      } catch (nextError) {
        if (!cancelled) {
          setConnection({
            state: { status: 'crashed', code: null },
            apiBase: null,
            token: null,
            error: errorMessage(nextError),
          });
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bridge, loadSetup]);

  const restartAndWait = useCallback(async () => {
    resetTransport();
    setStatus(null);
    setConnection({ state: { status: 'starting' }, apiBase: null, token: null, error: null });
    await bridge.restartRuntime();
    for (;;) {
      const next = await bridge.runtimeConnection();
      setConnection(next);
      if (next.state.status === 'ready') {
        await loadSetup(next);
        return;
      }
      if (next.state.status === 'crashed' || next.state.status === 'stopped') return;
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }, [bridge, loadSetup]);

  const mutate = async (action: () => Promise<unknown>, restart = false) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (restart) await restartAndWait();
      else if (connection?.state.status === 'ready') await loadSetup(connection);
      return true;
    } catch (nextError) {
      setError(errorMessage(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selectExisting = async () => {
    const path = await bridge.chooseLearningSetFolder();
    if (path) await mutate(() => desktopApi.selectExisting(path), true);
  };

  const pollAuth = async (flowId: string, revision: number) => {
    for (;;) {
      const next = await desktopApi.auth(flowId);
      if (authRevision.current !== revision) return;
      setAuthFlow(next);
      if (next.status === 'completed' || next.status === 'failed' || next.status === 'cancelled') {
        if (next.status === 'completed') setCatalog(await desktopApi.models());
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  const startAuth = async (provider: string, type: AuthType) => {
    setError(null);
    try {
      const { flowId } = await desktopApi.startAuth(provider, type);
      const revision = ++authRevision.current;
      await pollAuth(flowId, revision);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  };

  const respondAuth = async (value: string) => {
    if (!authFlow) return;
    await desktopApi.respondAuth(authFlow.flowId, value);
    const revision = ++authRevision.current;
    await pollAuth(authFlow.flowId, revision);
  };

  const openHelp = async () => {
    setPage('help');
    if (help.length > 0) return;
    try {
      const [firstLearning, installation] = await Promise.all([
        desktopApi.help('first-learning'),
        desktopApi.help('macos-installation'),
      ]);
      setHelp([
        { id: 'first-learning', title: '第一次学习', markdown: firstLearning },
        { id: 'macos-installation', title: '安装与模型', markdown: installation },
      ]);
    } catch {
      setHelp([]);
    }
  };

  if (!connection || connection.state.status === 'starting') return <DesktopLoading />;
  if (connection.state.status === 'crashed' || connection.state.status === 'stopped') {
    return (
      <DiagnosticPage
        issue={runtimeIssue(connection)}
        onRetry={() => void restartAndWait()}
        onSelectLearningSet={() => void selectExisting()}
        onOpenModels={() => setPage('models')}
      />
    );
  }
  if (!status || !catalog) return <DesktopLoading />;

  if (page === 'help') return <HelpPage documents={help} onBack={() => setPage('learning')} />;
  if (page === 'models' || status.state === 'needs-models') {
    return (
      <ModelSettings
        key={`${status.teacher?.model ?? 'new'}:${status.scout?.model ?? 'new'}`}
        catalog={catalog}
        teacher={status.teacher}
        scout={status.scout}
        authFlow={authFlow ? publicAuthFlow(authFlow) : null}
        busy={busy}
        error={error}
        onLogin={startAuth}
        onRespond={respondAuth}
        onOpenUrl={(url) => bridge.openExternalUrl(url)}
        onSave={async (teacher: DesktopModelSelection, scout: DesktopModelSelection) => {
          const saved = await mutate(() => desktopApi.saveModels(teacher, scout), true);
          if (saved) setPage('learning');
        }}
        onBack={status.state === 'ready' ? () => setPage('learning') : null}
        onShowCompanion={bridge.companion
          ? () => void bridge.companion?.showCompanion()
          : null}
      />
    );
  }
  if (status.state === 'needs-learning-set') {
    return (
      <FirstRun
        busy={busy}
        error={error}
        onBlank={async (name) => { await mutate(() => desktopApi.createBlank(name), true); }}
        onExisting={selectExisting}
        onExample={async (name) => { await mutate(() => desktopApi.createExample(name), true); }}
      />
    );
  }
  if (status.state !== 'ready') {
    return (
      <DiagnosticPage
        issue={status.issue ?? { code: 'RUNTIME_FAILURE', detail: '未知的本地状态' }}
        onRetry={() => void refreshConnection()}
        onSelectLearningSet={() => void selectExisting()}
        onOpenModels={() => setPage('models')}
      />
    );
  }

  return (
    <DesktopToolsProvider value={{
      openSettings: () => setPage('models'),
      openHelp: () => void openHelp(),
      companion: bridge.companion ?? null,
    }}>
      <div className="desktop-ready-shift" key={connection.token ?? 'ready'}>
        <App />
      </div>
    </DesktopToolsProvider>
  );
}

export function DesktopRoot({ bridge = tauriDesktopBridge }: { bridge?: DesktopBridge }) {
  return bridge.isDesktop ? <DesktopApp bridge={bridge} /> : <App />;
}

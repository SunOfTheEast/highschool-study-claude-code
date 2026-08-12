import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthType } from '@earendil-works/pi-ai';
import type {
  DesktopModelSelection,
  DesktopVisionSelection,
} from '../../desktop/contracts';
import { App } from '../App';
import { api } from '../api';
import { configureTransport, resetTransport } from '../transport';
import {
  desktopApi,
  type DesktopAuthFlow,
  type DesktopStatus,
  type PeerSkinStatus,
} from './api';
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
import type {
  CalendarAppointment,
  LearningContextReference,
} from '../../shared/contracts';
import { calendarNotificationRequests } from '../calendar-navigation';

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
  const [peerSkin, setPeerSkin] = useState<PeerSkinStatus | null>(null);
  const [page, setPage] = useState<DesktopPage>('learning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<DesktopAuthFlow | null>(null);
  const [help, setHelp] = useState<HelpDocument[]>([]);
  const authRevision = useRef(0);
  const launchBusy = useRef(false);
  const previousPeerSkin = useRef<PeerSkinStatus['state'] | null>(null);

  const loadSetup = useCallback(async (next: RuntimeConnection) => {
    if (!next.apiBase || !next.token) return;
    configureTransport({ apiBase: next.apiBase, token: next.token });
    const [nextStatus, nextCatalog, nextPeerSkin] = await Promise.all([
      desktopApi.status(),
      desktopApi.models(),
      desktopApi.peerSkinStatus(),
    ]);
    setStatus(nextStatus);
    setCatalog(nextCatalog);
    setPeerSkin(nextPeerSkin);
  }, []);

  useEffect(() => {
    if (!peerSkin || !bridge.companion) return;
    const previous = previousPeerSkin.current;
    previousPeerSkin.current = peerSkin.state;
    if (peerSkin.state === 'missing') {
      void bridge.companion.hideCompanion();
    } else if (previous !== 'installed') {
      void bridge.companion.showCompanion();
    }
  }, [bridge.companion, peerSkin]);

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
    try {
      await bridge.restartRuntime();
    } catch (restartError) {
      try {
        setConnection(await bridge.runtimeConnection());
      } catch {
        setConnection({
          state: { status: 'crashed', code: null },
          apiBase: null,
          token: null,
          error: errorMessage(restartError),
        });
      }
      return;
    }
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

  const openCalendarAppointment = useCallback(async (appointment: CalendarAppointment) => {
    setBusy(true);
    setError(null);
    try {
      if (status?.currentLearningSet !== appointment.learningSetPath) {
        await desktopApi.selectExisting(appointment.learningSetPath);
        await restartAndWait();
      }
      const launched = await api.launchCalendarAppointment(appointment.id, appointment.revision);
      window.history.pushState(null, '', launched.route);
      window.dispatchEvent(new PopStateEvent('popstate'));
      const snapshot = await api.calendar();
      await bridge.reconcileCalendarNotifications(
        calendarNotificationRequests(snapshot.appointments),
      );
    } catch (nextError) {
      setError(errorMessage(nextError));
      throw nextError;
    } finally {
      setBusy(false);
    }
  }, [bridge, restartAndWait, status?.currentLearningSet]);

  const openReview = useCallback(async (
    learningSetPath: string,
    contexts: LearningContextReference[],
  ) => {
    setBusy(true);
    setError(null);
    try {
      if (status?.currentLearningSet !== learningSetPath) {
        await desktopApi.selectExisting(learningSetPath);
        await restartAndWait();
      }
      const created = await api.createFreeLearning(contexts, 'review');
      window.history.pushState(null, '', created.route);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (nextError) {
      setError(errorMessage(nextError));
      throw nextError;
    } finally {
      setBusy(false);
    }
  }, [restartAndWait, status?.currentLearningSet]);

  useEffect(() => {
    if (status?.state !== 'ready') return;
    let disposed = false;

    const resolveLaunchIntent = async () => {
      if (launchBusy.current) return;
      const intent = await bridge.takeCalendarLaunchIntent();
      if (!intent || disposed) return;
      launchBusy.current = true;
      try {
        const snapshot = await api.calendar();
        const appointment = snapshot.appointments.find((candidate) => (
          candidate.id === intent.appointmentId && candidate.revision === intent.revision
        ));
        if (appointment) {
          await openCalendarAppointment(appointment);
          return;
        }
        const latest = snapshot.appointments.find((candidate) => (
          candidate.id === intent.appointmentId
        ));
        const query = latest ? `?appointment=${encodeURIComponent(latest.id)}` : '';
        window.history.pushState(null, '', `/calendar${query}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await bridge.reconcileCalendarNotifications(
          calendarNotificationRequests(snapshot.appointments),
        );
      } catch (nextError) {
        setError(errorMessage(nextError));
      } finally {
        launchBusy.current = false;
      }
    };

    void api.calendar().then((snapshot) => bridge.reconcileCalendarNotifications(
      calendarNotificationRequests(snapshot.appointments),
    )).then(() => resolveLaunchIntent(), () => {});
    const timer = window.setInterval(() => void resolveLaunchIntent(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [bridge, openCalendarAppointment, status?.state]);

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

  const beginWithBook = async () => {
    setBusy(true);
    setError(null);
    try {
      await desktopApi.createBlank('我的学习集');
      await restartAndWait();
      const selected = await bridge.chooseBookFile();
      if (!selected) return;
      try {
        const receipt = await desktopApi.importBookPath({
          requestId: crypto.randomUUID(),
          title: selected.originalFilename.replace(/\.pdf$/i, ''),
          absolutePath: selected.absolutePath,
        });
        await api.bootstrapMaterialBook(receipt.id, receipt.revision);
        const route = `/assets/books/${encodeURIComponent(receipt.id)}`;
        window.history.replaceState(null, '', route);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } finally {
        await bridge.discardBookFile(selected.absolutePath).catch(() => {});
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
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
        vision={status.vision}
        authFlow={authFlow ? publicAuthFlow(authFlow) : null}
        busy={busy}
        error={error}
        onLogin={startAuth}
        onRespond={respondAuth}
        onOpenUrl={(url) => bridge.openExternalUrl(url)}
        onSave={async (
          teacher: DesktopModelSelection,
          scout: DesktopModelSelection,
          vision: DesktopVisionSelection,
        ) => {
          const saved = await mutate(() => desktopApi.saveModels(teacher, scout, vision), true);
          if (saved) setPage('learning');
        }}
        onBack={status.state === 'ready' ? () => setPage('learning') : null}
        peerSkin={peerSkin}
        onChoosePeerSkin={() => bridge.choosePeerSkinFolder()}
        onChooseLive2DCore={() => bridge.chooseLive2DCoreFile()}
        onImportPeerSkin={async (source, core) => {
          const next = await desktopApi.importPeerSkin(source, core);
          previousPeerSkin.current = next.state;
          setPeerSkin(next);
          if (next.state === 'installed' && bridge.companion) {
            await bridge.companion.reloadCompanion();
            await new Promise((resolve) => setTimeout(resolve, 180));
            await bridge.companion.showCompanion();
          }
          return next;
        }}
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
        onBook={beginWithBook}
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
      showNotification: (title, body) => bridge.showNotification(title, body),
      reconcileCalendarNotifications: (appointments) => bridge.reconcileCalendarNotifications(
        calendarNotificationRequests(appointments),
      ),
      openCalendarAppointment,
      openReview,
      importBook: async (title) => {
        const selected = await bridge.chooseBookFile();
        if (!selected) return null;
        try {
          return await desktopApi.importBookPath({
            requestId: crypto.randomUUID(),
            title: title.trim() || selected.originalFilename.replace(/\.pdf$/i, ''),
            absolutePath: selected.absolutePath,
          });
        } finally {
          await bridge.discardBookFile(selected.absolutePath).catch(() => {});
        }
      },
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

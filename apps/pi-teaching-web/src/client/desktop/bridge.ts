import { invoke } from '@tauri-apps/api/core';
import { tauriCompanionBridge } from '../companion/bridge';
import type { CompanionBridge } from '../companion/contracts';
import type {
  CalendarLaunchIntent,
  CalendarNotificationRequest,
} from '../calendar-navigation';

export type CalendarNotificationStatus = {
  permission: 'granted' | 'denied' | 'unsupported';
  scheduled: number;
};

export type RuntimeConnection = {
  state:
    | { status: 'starting' }
    | { status: 'ready'; port: number; workspace: 'setup' | 'selected' }
    | { status: 'stopped' }
    | { status: 'crashed'; code: number | null };
  apiBase: string | null;
  token: string | null;
  error: string | null;
};

export type StagedBookFile = {
  absolutePath: string;
  originalFilename: string;
};

export type DesktopBridge = {
  readonly isDesktop: boolean;
  readonly companion?: CompanionBridge | null;
  runtimeConnection(): Promise<RuntimeConnection>;
  restartRuntime(): Promise<void>;
  chooseLearningSetFolder(): Promise<string | null>;
  chooseBookFile(): Promise<StagedBookFile | null>;
  discardBookFile(absolutePath: string): Promise<void>;
  choosePeerSkinFolder(): Promise<string | null>;
  chooseLive2DCoreFile(): Promise<string | null>;
  revealInFinder(path: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
  reconcileCalendarNotifications(
    requests: CalendarNotificationRequest[],
  ): Promise<CalendarNotificationStatus>;
  takeCalendarLaunchIntent(): Promise<CalendarLaunchIntent | null>;
};

export function isDesktopEnvironment(value: unknown = globalThis): boolean {
  if (!value || typeof value !== 'object') return false;
  return '__TAURI_INTERNALS__' in value;
}

export const tauriDesktopBridge: DesktopBridge = {
  isDesktop: typeof window !== 'undefined' && isDesktopEnvironment(window),
  companion: tauriCompanionBridge,
  runtimeConnection: () => invoke<RuntimeConnection>('runtime_connection'),
  restartRuntime: () => invoke<void>('restart_runtime'),
  chooseLearningSetFolder: () => invoke<string | null>('choose_learning_set_folder'),
  chooseBookFile: () => invoke<StagedBookFile | null>('choose_book_file'),
  discardBookFile: (absolutePath) => invoke<void>('discard_book_file', { absolutePath }),
  choosePeerSkinFolder: () => invoke<string | null>('choose_peer_skin_folder'),
  chooseLive2DCoreFile: () => invoke<string | null>('choose_live2d_core_file'),
  revealInFinder: (path) => invoke<void>('reveal_in_finder', { path }),
  openExternalUrl: (url) => invoke<void>('open_external_url', { url }),
  showNotification: (title, body) => invoke<void>('show_studyforge_notification', { title, body }),
  reconcileCalendarNotifications: (requests) => invoke<CalendarNotificationStatus>(
    'reconcile_calendar_notifications',
    { requests },
  ),
  takeCalendarLaunchIntent: () => invoke<CalendarLaunchIntent | null>(
    'take_calendar_launch_intent',
  ),
};
